"use client"
// Excalidraw 引擎 —— 协作画布。
//
// 与 tldraw 那套完全独立：不共享组件、不共享协议、不共享持久化。改这套不会碰到那套。
//
// ⚠️ 只在浏览器渲染（canvas-host 用 next/dynamic ssr:false 引入）：Excalidraw 依赖 window。
//
// ── 三条必须知道的实现要点 ──────────────────────────────────────────────────
// 1. **先拿到 init 再挂编辑器**。Excalidraw 的 initialData 只在挂载时读一次，挂载后再传新的
//    会被忽略。所以本组件在收到服务端 init 之前只渲染占位，拿到快照才挂 <Excalidraw>。
// 2. **用官方 reconcileElements 做合并**。Excalidraw 的元素自带 version / versionNonce，
//    服务端也是按这两个字段判新旧（同口径），所以直接用官方函数最不容易出偏差。
// 3. **远端更新必须重置「已同步基线」**。否则远端内容会被 onChange 当成"本地新变化"再回发，
//    A→B→A 来回放大（虽然服务端有判重能兜住，但会白烧带宽）。见 applyRemote 里的注释。
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { CaptureUpdateAction, Excalidraw, reconcileElements, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import "@excalidraw/excalidraw/index.css"
import { Spin } from "antd"
import { apiJson } from "@/lib/api"
import { collabUri } from "@/lib/canvas"
import {
  ExcalidrawCollab, stampOf,
  type ConnStatus, type Diff, type Peer, type RawElement, type RawFile, type Scene,
} from "./collab"

/** 发送节流：拖动一个矩形会触发几十次 onChange，攒 120ms 再发一次，手感不变但流量降一个量级 */
const SEND_INTERVAL_MS = 120

/** 光标广播节流。与内容发送同频但**互不影响**：presence 丢了下一帧就补上，不需要可靠性 */
const PRESENCE_INTERVAL_MS = 120

/** 自己的显示名：整页只取一次，多个画布组件共享同一个 Promise（取不到就匿名显示，不影响协作） */
let myNamePromise: Promise<string> | null = null
function loadMyName(): Promise<string> {
  if (!myNamePromise) {
    myNamePromise = apiJson<{ username?: string }>("/api/me")
      .then((me) => me?.username || "")
      .catch(() => "")
  }
  return myNamePromise
}

type Pending = {
  elements: Map<string, RawElement>
  files: Record<string, RawFile>
  removed: Set<string>
  timer: ReturnType<typeof setTimeout> | null
}

const emptyPending = (): Pending => ({ elements: new Map(), files: {}, removed: new Set(), timer: null })

/**
 * @param readonly 画布里的 view 权限 → 编辑器只读（界面层）。
 *   ⚠️ **服务端才是权威**：那条 WS 连接已被标记 readonly，写请求会被协作服务直接丢弃
 *   （rooms/excalidraw-room.mjs）。这里只是为了不让只读者对着一个能画但存不下的界面发呆。
 */
export default function Board({ roomId, readonly = false }: { roomId: string; readonly?: boolean }) {
  const [scene, setScene] = useState<Scene | null>(null)
  const [status, setStatus] = useState<ConnStatus>("connecting")
  /** 服务端在 init 里声明的只读（只允许把状态**收紧**，不允许放宽 —— 见 CollabHandlers.onReadonly） */
  const [serverReadonly, setServerReadonly] = useState(false)
  const readOnly = readonly || serverReadonly

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const collabRef = useRef<ExcalidrawCollab | null>(null)
  /** id → "version:versionNonce"：**已经同步给服务端的最后版本**，onChange 拿它做 diff */
  const stampedRef = useRef<Map<string, string>>(new Map())
  /** 已发过的图片 id（图片写入后内容不再变，按 id 去重足够） */
  const sentFilesRef = useRef<Set<string>>(new Set())
  const pendingRef = useRef<Pending>(emptyPending())
  /** 是否已经用 init 挂载过编辑器（重连时的 init 要走 updateScene 而不是重新挂载） */
  const mountedRef = useRef(false)
  /** 别人的光标：peerId → Peer。与文档元素两条**完全独立**的通道，不参与版本判定 */
  const peersRef = useRef<Map<string, Peer>>(new Map())
  const meNameRef = useRef<string>("")
  const lastPresenceRef = useRef(0)

  /**
   * 把 peersRef 渲染成 Excalidraw 的 `appState.collaborators`。
   *
   * <p>⚠️ 这里走的是 `updateScene({ collaborators })`，**不碰 elements** ——
   * 所以既不会触发我们的 onChange 发送（diff 为空），也不会进 undo 栈。
   */
  const renderPeers = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const map = new Map<string, unknown>()
    for (const p of peersRef.current.values()) {
      map.set(p.peerId, {
        id: p.peerId,
        username: p.username || undefined,
        color: p.color,
        pointer: { x: p.x, y: p.y, tool: p.tool === "laser" ? "laser" : "pointer" },
        button: p.button === "down" ? "down" : "up",
      })
    }
    api.updateScene({ collaborators: map as never })
  }, [])

  /**
   * 广播自己的光标。
   *
   * <p>⚠️ 必须把**视口坐标换算成场景坐标**：Excalidraw 的 `Collaborator.pointer` 用的是场景坐标，
   * 这样别人缩放 / 平移画布后，你的光标仍然钉在同一个图形上（直接用屏幕坐标会随缩放飘走）。
   */
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const api = apiRef.current
    const collab = collabRef.current
    if (!api || !collab) return
    const now = Date.now()
    if (now - lastPresenceRef.current < PRESENCE_INTERVAL_MS) return
    lastPresenceRef.current = now
    const scene = viewportCoordsToSceneCoords(
      { clientX: e.clientX, clientY: e.clientY },
      api.getAppState() as never,
    )
    collab.sendPresence({ x: scene.x, y: scene.y, username: meNameRef.current })
  }, [])

  const flush = useCallback(() => {
    const q = pendingRef.current
    q.timer = null
    const diff: Diff = {}
    if (q.elements.size) diff.elements = [...q.elements.values()]
    if (Object.keys(q.files).length) diff.files = q.files
    if (q.removed.size) diff.removed = [...q.removed]
    if (!diff.elements && !diff.files && !diff.removed) return
    q.elements.clear()
    q.files = {}
    q.removed.clear()
    collabRef.current?.send(diff)
  }, [])

  const queue = useCallback(
    (diff: Diff) => {
      const q = pendingRef.current
      for (const el of diff.elements || []) {
        q.elements.set(el.id, el)
        q.removed.delete(el.id) // 同一批里「又改又删」时以最后动作为准
      }
      Object.assign(q.files, diff.files || {})
      for (const id of diff.removed || []) {
        q.removed.add(id)
        q.elements.delete(id)
      }
      if (q.timer) return
      q.timer = setTimeout(flush, SEND_INTERVAL_MS)
    },
    [flush],
  )

  /** 把服务端来的内容并进编辑器 */
  const applyRemote = useCallback((elements: RawElement[], files: Record<string, RawFile>, removed: string[]) => {
    const api = apiRef.current
    if (!api) return

    const local = api.getSceneElementsIncludingDeleted() as unknown as RawElement[]
    let merged = local
    if (elements.length || removed.length) {
      merged = reconcileElements(local as never, elements as never, api.getAppState()) as unknown as RawElement[]
    }

    // ⚠️ 基线重置为「合并后的全量」，不是「本次增量」。
    //    合并结果里既有远端的也有本地更新的版本，把它整份记为"已同步"之后，
    //    随后的 onChange 就不会把远端内容当成本地新变化再回传一次。
    const stamp = new Map<string, string>()
    for (const el of merged) stamp.set(el.id, stampOf(el))
    stampedRef.current = stamp

    api.updateScene({
      elements: merged as never,
      // 远端更新不能进本地 undo 栈，否则用户按 Ctrl+Z 会把别人画的东西撤掉
      captureUpdate: CaptureUpdateAction.NEVER,
    })

    const list = Object.values(files || {}).filter((f) => f && typeof f.dataURL === "string")
    if (list.length) api.addFiles(list as never)
    for (const id of Object.keys(files || {})) sentFilesRef.current.add(id)
  }, [])

  /** 本地变化 → 与服务端比差异 → 只在真有变化时发送 */
  const onChange = useCallback(
    (elements: readonly unknown[], _appState: unknown, files: unknown) => {
      if (!apiRef.current) return
      // 只读：本地根本不产生「要发出去的差异」。服务端也会丢弃，这里只是不做无用功。
      if (readOnly) return
      const stamped = stampedRef.current
      const changed: RawElement[] = []
      const seen = new Set<string>()

      for (const raw of elements as RawElement[]) {
        seen.add(raw.id)
        const s = stampOf(raw)
        if (stamped.get(raw.id) !== s) {
          changed.push(raw)
          stamped.set(raw.id, s)
        }
      }
      const removed: string[] = []
      for (const id of Array.from(stamped.keys())) {
        if (!seen.has(id)) {
          removed.push(id)
          stamped.delete(id)
        }
      }
      const fresh: Record<string, RawFile> = {}
      for (const [id, f] of Object.entries((files || {}) as Record<string, RawFile>)) {
        if (!f || typeof f.dataURL !== "string") continue
        if (!sentFilesRef.current.has(id)) {
          fresh[id] = f
          sentFilesRef.current.add(id)
        }
      }

      if (!changed.length && !removed.length && !Object.keys(fresh).length) return
      queue({ elements: changed, files: fresh, removed })
    },
    [queue, readOnly],
  )

  useEffect(() => {
    // readonly 由 EditorView 在拿到 meta（/api/canvas/{roomId}）之后才渲染本组件传入，
    // 所以它在挂载时已经确定、不会中途变化 —— 刻意不进依赖数组（否则会白白重连一次 WS）。
    const collab = new ExcalidrawCollab(collabUri("excalidraw", roomId), {
      onInit: (s) => {
        if (!mountedRef.current) {
          // 首次连上：把快照作为初始数据，让编辑器一次就带着内容挂起来
          mountedRef.current = true
          const stamp = new Map<string, string>()
          for (const el of s.elements) stamp.set(el.id, stampOf(el))
          stampedRef.current = stamp
          sentFilesRef.current = new Set(Object.keys(s.files || {}))
          setScene(s)
        } else {
          // 重连：编辑器已经在了，只能走 updateScene 把差异补上
          applyRemote(s.elements, s.files, [])
        }
      },
      onDiff: (d) => applyRemote(d.elements, d.files, d.removed),
      onStatus: setStatus,
      onReadonly: (v) => { if (v) setServerReadonly(true) },
      onPresence: (ev) => {
        if (ev.kind === "snapshot") {
          peersRef.current = new Map(ev.peers.map((p) => [p.peerId, p]))
        } else if (ev.kind === "update") {
          peersRef.current.set(ev.peer.peerId, ev.peer)
        } else {
          peersRef.current.delete(ev.peerId)
        }
        renderPeers()
      },
    }, readOnly)
    collabRef.current = collab
    collab.connect()
    // ⚠️ **必须在 return 之前**：useEffect 的回调在 return 之后就结束了，
    //    写在 return 之后等于死代码 —— 曾经就这么错过一次，表现为「光标标签一直是空的」。
    //    刻意不 await：显示名只是光标旁的标签，晚到一会儿无妨，不该阻塞连接。
    void loadMyName().then((n) => { meNameRef.current = n })
    return () => {
      collab.close()
      collabRef.current = null
    }
  }, [roomId, applyRemote, renderPeers])

  /** 把编辑器切到 / 切出 view mode（隐藏绘图工具、禁拖拽）。api 可能还没就绪，所以做成可重入 */
  const applyViewMode = useCallback((api: ExcalidrawImperativeAPI | null) => {
    if (!api) return
    // ⚠️ 用命令式 appState 而不是 Excalidraw 的 viewModeEnabled prop：本仓本地没装
    //    @excalidraw/excalidraw（类型在服务器上），prop 名一旦对不上就是构建期报错；
    //    updateScene 的 appState 是久经使用的入口。
    api.updateScene({ appState: { viewModeEnabled: readOnly } as never })
  }, [readOnly])

  useEffect(() => { applyViewMode(apiRef.current) }, [applyViewMode])

  const initialData = useMemo(() => {
    if (!scene) return null
    return {
      elements: scene.elements as never,
      files: scene.files as never,
      scrollToContent: scene.elements.some((e) => !e.isDeleted),
    }
  }, [scene])

  if (!initialData) {
    return (
      <div className="absolute inset-0 grid place-items-center rounded-xl border border-black/10 bg-white">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
          <Spin />
          <span>{status === "closed" ? "连接已断开，正在重连…" : "正在同步画布内容…"}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
      onPointerMove={onPointerMove}
    >
      {readOnly && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-amber-500/95 px-3 py-1 text-xs font-medium text-white shadow">
          👁 只读：你是本画布的查看者，改动不会被保存
        </div>
      )}
      <Excalidraw
        initialData={initialData}
        onChange={onChange as never}
        excalidrawAPI={(api) => {
          apiRef.current = api
          // ⚠️ 只读必须**在这里**设一次：组件在 scene 到达前走的是早退分支（apiRef 还是 null），
          //    所以那个 [readOnly] 的 effect 首次执行时无 api 可用、之后依赖又没变、不会补跑。
          applyViewMode(api)
          // 编辑器就绪时把已经收到的 peers 补渲一次（presence 可能比 api 先到）
          renderPeers()
        }}
        isCollaborating
        langCode="zh-CN"
        theme="light"
        aiEnabled={false}
        // 打开/另存本地文件会绕过服务端持久化（用户以为存了其实没有），直接从菜单里去掉
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: { saveFileToDisk: true },
            saveAsImage: true,
            toggleTheme: false,
            clearCanvas: true,
            changeViewBackgroundColor: true,
          },
        }}
      />
      {status !== "open" && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 shadow">
          {status === "connecting" ? "正在连接协作服务…" : "连接已断开，正在重连…"}
        </div>
      )}
    </div>
  )
}
