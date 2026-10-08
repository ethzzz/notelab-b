// Excalidraw 引擎 —— 协作传输层。
//
// 刻意做成**不 import react、也不 import @excalidraw/excalidraw** 的纯模块：
//   · 协议与 UI 解耦，逻辑可以脱离浏览器测试
//   · 唯一的外部依赖是全局 WebSocket
//
// 协议（与服务端 rooms/excalidraw-room.mjs 一一对应）：
//   收  {type:"init",   elements, files}                 连上时的全量快照
//   收  {type:"update", elements, files, removed}       别人的增量
//   发  {type:"update", elements, files, removed}       自己的增量
//
// ⚠️ 类型刻意用结构化最小定义（只声明我们真正读写的字段），不 import Excalidraw 的官方类型：
//    官方 OrderedExcalidrawElement 是个很大的联合类型，两套版本一升就容易对不上；
//    这里只需要 id / version / versionNonce 三个字段就能做协调。

export type RawElement = {
  id: string
  version: number
  versionNonce: number
  isDeleted?: boolean
  [k: string]: unknown
}

export type RawFile = {
  id: string
  dataURL: string
  mimeType?: string
  created?: number
  [k: string]: unknown
}

/** 一份完整场景（= 服务端一条记录的内容） */
export type Scene = { elements: RawElement[]; files: Record<string, RawFile> }

/** 增量 */
export type Diff = {
  elements?: RawElement[]
  files?: Record<string, RawFile>
  removed?: string[]
}

export type ConnStatus = "connecting" | "open" | "closed"

/** 一位协作者的光标状态（peerId 与颜色由服务端在握手时分配，客户端只负责渲染） */
export type Peer = {
  peerId: string
  /** 服务端验过的账号 id（握手已要求 B 端登录，所以一定有值；仅作展示用） */
  userId?: number | null
  username?: string
  color: { background: string; stroke: string }
  /** ⚠️ **场景坐标**，不是屏幕坐标 —— Excalidraw 的 `Collaborator.pointer` 用的就是场景坐标
   *  （这样 A 缩放/平移画布后，B 看到的 A 光标仍钉在同一个图形上） */
  x: number
  y: number
  tool?: string
  button?: string
}

/**
 * presence 事件。三种形态共用一个回调，免得调用方注册三个 handler：
 *   snapshot —— 刚连上时服务端推的「当前房间有哪些人」
 *   update   —— 某人的光标动了
 *   gone     —— 某人断开
 */
export type PresenceEvent =
  | { kind: "snapshot"; peers: Peer[] }
  | { kind: "update"; peer: Peer }
  | { kind: "gone"; peerId: string }

export type CollabHandlers = {
  onInit: (scene: Scene) => void
  onDiff: (d: Required<Diff>) => void
  onStatus: (s: ConnStatus) => void
  /** 可选：不看别人光标时可以不实现 */
  onPresence?: (ev: PresenceEvent) => void
}

/** 版本戳：与服务端 isNewer() 同口径 */
export function stampOf(el: RawElement): string {
  return `${el.version}:${el.versionNonce}`
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000

type Backlog = { elements: Map<string, RawElement>; files: Record<string, RawFile>; removed: Set<string> }

function emptyBacklog(): Backlog {
  return { elements: new Map(), files: {}, removed: new Set() }
}

export class ExcalidrawCollab {
  private ws: WebSocket | null = null
  private disposed = false
  private retry = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  /**
   * 断线期间没发出去的增量，重连后补发。
   * 不攒的话：网络抖一下，用户在这期间画的东西就永久丢了（服务端从没收到过）。
   */
  private backlog: Backlog = emptyBacklog()

  constructor(
    private readonly uri: string,
    private readonly h: CollabHandlers,
  ) {}

  connect() {
    this.disposed = false
    this.open()
  }

  private open() {
    this.h.onStatus("connecting")
    let ws: WebSocket
    try {
      ws = new WebSocket(this.uri)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.retry = 0
      this.h.onStatus("open")
      this.flushBacklog()
    }

    ws.onmessage = (ev) => {
      let msg: {
        type?: string
        elements?: RawElement[]
        files?: Record<string, RawFile>
        removed?: string[]
        peers?: Peer[]
        peer?: Peer
        gone?: string
      } | null = null
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data))
      } catch {
        return
      }
      if (!msg) return
      if (msg.type === "init") {
        this.h.onInit({ elements: msg.elements || [], files: msg.files || {} })
      } else if (msg.type === "update") {
        this.h.onDiff({ elements: msg.elements || [], files: msg.files || {}, removed: msg.removed || [] })
      } else if (msg.type === "presence") {
        // presence 与文档内容**完全分道**：不入库、不参与版本判定、不进 backlog。
        // 丢一帧下一帧就补上了，所以这里不做任何可靠性处理。
        if (Array.isArray(msg.peers)) this.h.onPresence?.({ kind: "snapshot", peers: msg.peers })
        else if (msg.peer) this.h.onPresence?.({ kind: "update", peer: msg.peer })
        else if (typeof msg.gone === "string") this.h.onPresence?.({ kind: "gone", peerId: msg.gone })
      }
    }

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      if (this.disposed) return
      this.h.onStatus("closed")
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      /* onclose 随后必到，重连逻辑统一放那儿 */
    }
  }

  private scheduleReconnect() {
    if (this.disposed || this.timer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.retry, RECONNECT_MAX_MS)
    this.retry += 1
    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.disposed) this.open()
    }, delay)
  }

  private flushBacklog() {
    const b = this.backlog
    if (!b.elements.size && !Object.keys(b.files).length && !b.removed.size) return
    this.backlog = emptyBacklog()
    this.raw({
      elements: [...b.elements.values()],
      files: b.files,
      removed: [...b.removed],
    })
  }

  private raw(diff: Diff) {
    const ws = this.ws
    if (!ws || ws.readyState !== 1) return false
    try {
      ws.send(JSON.stringify({ type: "update", ...diff }))
      return true
    } catch {
      return false
    }
  }

  /** 发送增量；离线时攒进 backlog，重连后补发 */
  send(diff: Diff) {
    if (this.raw(diff)) return
    const b = this.backlog
    for (const el of diff.elements || []) {
      b.elements.set(el.id, el)
      b.removed.delete(el.id)
    }
    Object.assign(b.files, diff.files || {})
    for (const id of diff.removed || []) {
      b.removed.add(id)
      b.elements.delete(id)
    }
  }

  /**
   * 发送自己的光标位置（场景坐标）。
   *
   * ⚠️ 刻意**不走 backlog**：presence 是**瞬时状态**不是内容 —— 断线期间攒下的旧坐标
   * 补发出去毫无意义，反而会在重连瞬间闪现一串过时位置。丢了就等下一帧。
   * （节流在调用方 board.tsx 做，因为它才知道画布的实际事件频率。）
   */
  sendPresence(p: { x: number; y: number; tool?: string; button?: string }) {
    const ws = this.ws
    if (!ws || ws.readyState !== 1) return
    try {
      ws.send(JSON.stringify({
        type: "presence",
        x: p.x,
        y: p.y,
        tool: p.tool || "pointer",
        button: p.button || "up",
      }))
    } catch {
      /* ignore */
    }
  }

  close() {
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const ws = this.ws
    this.ws = null
    if (ws) {
      ws.onclose = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }
}
