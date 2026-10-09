// Excalidraw 房间（引擎 B，自建实时协作）。
//
// ── 为什么不直接用官方的 excalidraw-room ────────────────────────────────────
// 官方那个中继（github.com/excalidraw/excalidraw-room）已经归档不再维护，而且
// **不持久化**：最后一个人离开房间，内容就没了。我们的「画布列表 + 刷新不丢 +
// 删画布连带清理」三件事都要求落盘，所以自己实现一层。
//
// ── 数据模型 ────────────────────────────────────────────────────────────────
// 一个房间 = SQLite 里一张单行表：
//     exc_<roomId>_scene(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT, updated_at INTEGER)
//   data = {"elements":[...], "files":{...}}
// 这正是 Excalidraw 的原生结构，可以直接喂给 <Excalidraw initialData> 或
// api.updateScene()，中间不做任何转换 —— 转换层是 bug 的高发区。
//
// ── 协议（JSON over WebSocket）──────────────────────────────────────────────
//   服务端 → 客户端
//     {type:"init",     elements:[...], files:{...}}      连上时下发全量
//     {type:"update",   elements:[...], files:{...}, removed:[ids]}  别人的增量
//     {type:"presence", peers:[...] | peer:{...} | gone:"p3"}       光标（见下）
//   客户端 → 服务端
//     {type:"update",   elements:[...], files:{...}, removed:[ids]}  自己的增量
//     {type:"presence", x, y, tool?, button?, username?}             自己的光标
//
// ── presence（协作者光标）与文档内容**完全分道**──────────────────────────────
// presence **不落盘、不判重、不参与版本协调**，只做「改一下内存里的字段 + 转发给其他人」。
// 它丢一帧无所谓（下一帧就补上了），所以刻意不做任何可靠性处理 —— 反过来，
// 如果把它混进 update 流，光标移动会污染 dirty 标记（每动一下就触发落盘）。
// ⚠️ 坐标是**场景坐标**：客户端用 Excalidraw 的 viewportCoordsToSceneCoords 换算过，
//    这样别人缩放/平移画布后，你的光标仍钉在同一个图形上。
//
// ── 协调策略：元素级 LWW ─────────────────────────────────────────────────────
// 同 id 比 version，version 相同比 versionNonce。这与 Excalidraw 官方
// reconcileElements() 的口径一致，所以客户端可以直接用官方函数做合并，服务端
// 只需要保证「同一个 id 不会同时存在两个互相矛盾的版本」。
//
// ⚠️ 服务端**只广播真正发生变化的元素**（version 变了 / 新元素 / 真删除）。
//    这是打断「A 发→B 应用→B 回发→A 应用→…」回声放大循环的关键：B 应用远端更新后
//    必然触发一次 onChange，如果服务端不判重，这条回发会再次广播，形成无限往返。
import { db, tablesWithPrefix, dropTables, tableExists, quoteIdent, roomIdsWithPrefix, rowsUnderPrefix } from '../lib/db.mjs'

export const engine = 'excalidraw'

/** 表名前缀基座；具体房间为 `${BASE}${roomId}_` */
const BASE = 'exc_'
const prefixOf = (roomId) => `${BASE}${roomId}_`
const tableOf = (roomId) => `${prefixOf(roomId)}scene`

/** 落盘防抖：拖动一个矩形会触发几十次 onChange，攒一下再写 */
const FLUSH_DELAY_MS = 800
/** 场景上限：整份 JSON 超过就不落盘（保留内存态并告警），避免把库写爆 */
const MAX_SCENE_BYTES = 12 * 1024 * 1024

/** roomId → 内存态 */
const rooms = new Map()

let seq = 0

/** 协作者光标配色（沿用 Excalidraw 官方协作那套，视觉上和别处一致） */
const PEER_COLORS = [
  { background: '#FFC9C9', stroke: '#E03131' },
  { background: '#B2F2BB', stroke: '#2F9E44' },
  { background: '#A5D8FF', stroke: '#1971C2' },
  { background: '#FFEC99', stroke: '#F08C00' },
  { background: '#D0BFFF', stroke: '#7048E8' },
  { background: '#FFD8A8', stroke: '#E8590C' },
  { background: '#C3FAE8', stroke: '#0CA678' },
  { background: '#E599F7', stroke: '#9C36B5' },
]

/** 显示名上限：光标标签只是提示，截断防脏数据 */
const MAX_USERNAME = 40

/** 把一个连接上的 presence 字段聚成 peer 对象（给客户端直接喂 Collaborator 用） */
function peerOf(ws) {
  return {
    peerId: ws.__peerId,
    userId: ws.__userId ?? null,
    username: ws.__username || '',
    color: ws.__color,
    x: ws.__x ?? 0,
    y: ws.__y ?? 0,
    tool: ws.__tool || 'pointer',
    button: ws.__button || 'up',
  }
}

function getState(roomId) {
  let st = rooms.get(roomId)
  if (st) return st
  st = {
    elements: new Map(), // id → element（权威副本）
    files: {}, // fileId → BinaryFileData
    clients: new Set(),
    dirty: false,
    timer: null,
  }
  const saved = loadScene(roomId)
  if (saved) {
    if (Array.isArray(saved.elements)) {
      for (const el of saved.elements) {
        if (el && typeof el.id === 'string') st.elements.set(el.id, el)
      }
    }
    if (saved.files && typeof saved.files === 'object') {
      st.files = saved.files
    }
  }
  rooms.set(roomId, st)
  console.log(`[excalidraw] opened ${roomId} (elements=${st.elements.size})`)
  return st
}

function loadScene(roomId) {
  const t = tableOf(roomId)
  if (!tableExists(t)) return null
  const row = db.prepare(`SELECT data FROM ${quoteIdent(t)} WHERE id = 1`).get()
  if (!row) return null
  try {
    return JSON.parse(String(row.data))
  } catch (e) {
    console.warn(`[excalidraw] 场景 JSON 解析失败 ${roomId}:`, e && e.message)
    return null
  }
}

function flush(roomId) {
  const st = rooms.get(roomId)
  if (!st || !st.dirty) return
  st.dirty = false
  const payload = JSON.stringify({ elements: [...st.elements.values()], files: st.files })
  if (payload.length > MAX_SCENE_BYTES) {
    console.warn(
      `[excalidraw] 场景过大，跳过落盘 ${roomId} (${(payload.length / 1024 / 1024).toFixed(2)}MB > ${MAX_SCENE_BYTES / 1024 / 1024}MB)`,
    )
    return
  }
  const t = tableOf(roomId)
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(t)} (
       id INTEGER PRIMARY KEY CHECK (id = 1),
       data TEXT NOT NULL,
       updated_at INTEGER NOT NULL
     )`,
  )
  db.prepare(
    `INSERT OR REPLACE INTO ${quoteIdent(t)} (id, data, updated_at) VALUES (1, ?, ?)`,
  ).run(payload, Date.now())
}

function markDirty(roomId) {
  const st = rooms.get(roomId)
  if (!st) return
  st.dirty = true
  if (st.timer) return
  st.timer = setTimeout(() => {
    st.timer = null
    flush(roomId)
  }, FLUSH_DELAY_MS)
}

/** 版本戳：version 为主，versionNonce 破平 */
function stamp(el) {
  return `${el.version}:${el.versionNonce}`
}

/** a 是否比 b 新（缺字段时保守接受） */
function isNewer(a, b) {
  if (typeof a.version !== 'number' || typeof b.version !== 'number') return true
  if (a.version !== b.version) return a.version > b.version
  return (a.versionNonce ?? 0) > (b.versionNonce ?? 0)
}

/** 把客户端增量并进权威副本，返回**真正变化**的部分 */
function applyUpdate(st, msg) {
  const elements = []
  const files = {}
  const removed = []

  if (Array.isArray(msg.elements)) {
    for (const el of msg.elements) {
      if (!el || typeof el.id !== 'string') continue
      const prev = st.elements.get(el.id)
      if (prev && !isNewer(el, prev)) continue
      if (prev && stamp(prev) === stamp(el)) continue
      st.elements.set(el.id, el)
      elements.push(el)
    }
  }

  if (msg.files && typeof msg.files === 'object' && !Array.isArray(msg.files)) {
    for (const [id, f] of Object.entries(msg.files)) {
      if (!f || typeof f.dataURL !== 'string') continue
      const prev = st.files[id]
      // 图片内容一旦写入就不再变（改图=新 id），dataURL 相同即视为无变化
      if (prev && prev.dataURL === f.dataURL) continue
      st.files[id] = f
      files[id] = f
    }
  }

  if (Array.isArray(msg.removed)) {
    for (const id of msg.removed) {
      if (typeof id !== 'string') continue
      if (st.elements.delete(id)) removed.push(id)
    }
  }

  return { elements, files, removed }
}

function safeSend(ws, obj) {
  if (ws.readyState !== 1) return
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    /* 连接正在关闭 */
  }
}

/**
 * @param access 来自 {@code canvasPermission()}：{@code { permission, readonly }}。
 *        {@code readonly:true}（画布的 view 权限）= **服务端直接丢弃这条连接的 update**，
 *        不是只靠前端 {@code viewModeEnabled}（那种改一下 URL / 直连 WS 就绕过了）。
 *        presence（光标）仍放行 —— 只读者指一指别人某个位置是有用的，且它不写文档。
 */
export function attach(roomId, ws, who, access) {
  const st = getState(roomId)
  const cid = ++seq
  ws.__cid = cid
  ws.__readonly = !!(access && access.readonly)
  /** 只读连接累计被丢弃的写请求数（只在第一次记日志，避免刷屏） */
  ws.__rejected = 0
  // presence 身份：peerId 进程内唯一，颜色轮转分配，userId 来自服务端验过的会话
  ws.__peerId = `p${cid}`
  ws.__color = PEER_COLORS[cid % PEER_COLORS.length]
  ws.__userId = who && who.id != null ? who.id : null
  ws.__username = ''
  ws.__x = 0
  ws.__y = 0
  ws.__tool = 'pointer'
  ws.__button = 'up'
  st.clients.add(ws)

  // 连上先给全量：客户端拿到后作为 initialData 挂载编辑器
  // readonly 一并下发 —— 客户端据此把编辑器切到只读（界面层的第二道，服务端才是权威）
  safeSend(ws, { type: 'init', elements: [...st.elements.values()], files: st.files, readonly: ws.__readonly })
  // 再把"房间里当前有谁"推给新人（不含自己）—— 否则要等别人先动一下才看得到光标
  const others = []
  for (const peer of st.clients) if (peer !== ws) others.push(peerOf(peer))
  safeSend(ws, { type: 'presence', peers: others })
  console.log(`[excalidraw] join ${roomId} #${cid} (clients=${st.clients.size}${ws.__readonly ? ', readonly' : ''})`)

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
    } catch {
      return
    }
    if (!msg) return

    // ── 光标：纯转发，不落盘、不判重、不碰 dirty ──────────────────────────
    if (msg.type === 'presence') {
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return
      ws.__x = msg.x
      ws.__y = msg.y
      if (msg.tool === 'laser' || msg.tool === 'pointer') ws.__tool = msg.tool
      if (msg.button === 'down' || msg.button === 'up') ws.__button = msg.button
      if (typeof msg.username === 'string' && msg.username) {
        ws.__username = msg.username.slice(0, MAX_USERNAME)
      }
      const out = { type: 'presence', peer: peerOf(ws) }
      for (const peer of st.clients) {
        if (peer !== ws) safeSend(peer, out)
      }
      return
    }

    if (msg.type !== 'update') return
    // view 权限：服务端**丢弃写请求**。这是只读的权威实现 —— 客户端 viewModeEnabled 只是界面层，
    // 直连 WS 或改前端都能绕过它。
    if (ws.__readonly) {
      ws.__rejected++
      if (ws.__rejected === 1) {
        console.log(`[excalidraw] readonly 拒绝写请求 room=${roomId} #${cid} user=${ws.__userId}`)
      }
      return
    }
    const changed = applyUpdate(st, msg)
    if (!changed.elements.length && !Object.keys(changed.files).length && !changed.removed.length) {
      return // 无实质变化 → 不广播，回声放大在此终止
    }
    markDirty(roomId)
    const out = { type: 'update', elements: changed.elements, files: changed.files, removed: changed.removed, from: cid }
    for (const peer of st.clients) {
      if (peer !== ws) safeSend(peer, out)
    }
  })

  ws.on('close', () => {
    st.clients.delete(ws)
    // 广播"某人走了"，否则他的光标会一直停在最后的位置不消失。
    // ⚠️ 必须在 delete 之后发（否则退出的那个人自己也会收到）。
    const gone = { type: 'presence', gone: ws.__peerId }
    for (const peer of st.clients) safeSend(peer, gone)
    // 最后一个人走了就立刻落盘，不等防抖（否则进程正好在这 800ms 内挂掉会丢数据）
    if (st.clients.size === 0) {
      if (st.timer) {
        clearTimeout(st.timer)
        st.timer = null
      }
      flush(roomId)
    }
    console.log(`[excalidraw] leave ${roomId} #${cid} (clients=${st.clients.size})`)
  })

  ws.on('error', () => {
    /* close 会跟着来 */
  })
}

export function drop(roomId) {
  const st = rooms.get(roomId)
  if (st) {
    if (st.timer) {
      clearTimeout(st.timer)
      st.timer = null
    }
    st.dirty = false
    for (const ws of st.clients) {
      try {
        ws.close(1001, 'room dropped')
      } catch {
        /* ignore */
      }
    }
    st.clients.clear()
    rooms.delete(roomId)
  }
  const tables = dropTables(tablesWithPrefix(prefixOf(roomId)))
  return { tables, wasOpen: !!st }
}

export function stats() {
  return { open: rooms.size }
}

/**
 * 磁盘上的房间清单（**只看表，不看内存缓存**）—— 供 server.mjs 的内部 `/rooms` 端点对账用。
 * 与 tldraw 侧同构：重启后 `rooms` 缓存是空的，但表还在，对账要的是磁盘现状。
 */
export function inventory() {
  return roomIdsWithPrefix(BASE).map((roomId) => ({
    roomId,
    tables: tablesWithPrefix(prefixOf(roomId)).length,
    rows: rowsUnderPrefix(prefixOf(roomId)),
  }))
}

/** 进程退出前把所有脏房间落盘 */
export function flushAll() {
  for (const roomId of rooms.keys()) {
    const st = rooms.get(roomId)
    if (st && st.timer) {
      clearTimeout(st.timer)
      st.timer = null
    }
    flush(roomId)
  }
}
