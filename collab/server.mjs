// NoteLab 协作画布 · 同步服务（多引擎入口）
//
// 职责：HTTP/WS 入口 + 鉴权 + **按引擎分派**。本文件不含任何引擎细节，
// 引擎各自实现在 rooms/<engine>-room.mjs，互不 import、互不影响。
//
// 为什么单独一个进程：
//   1) tldraw sync 要求「同一房间全局只有一个 room 实例」——Next 的多实例 / hot-reload 做不到；
//   2) 与 B 端 Next 解耦：重启前端不断协作连接，反之亦然。
//
// 鉴权：WebSocket 握手时读 cookie，转发给 Java /api/auth/verify，只放行 B 端登录会话
//       （scope=b）。未登录直接 401 拒绝升级，不让匿名连接进来。详见 lib/auth.mjs。
//
// 端点（nginx 把 /collab 前缀剥掉后到达本进程）：
//   WS     /connect/<engine>/<roomId>   协作连接（engine ∈ tldraw|excalidraw）
//   WS     /connect/<roomId>            兼容旧路径，等同 tldraw
//   GET    /health                      健康检查（仅本机）
//   DELETE /rooms/<roomId>              清理房间：**遍历所有引擎**逐个清（仅本机）
//
// ⚠️ 新增引擎只需两步：写 rooms/<name>-room.mjs（导出 engine/attach/drop/stats），
//    然后在下面的 ENGINES 里登记一行。server.mjs 与既有引擎都不用动。
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { db } from './lib/db.mjs'
import { json, rejectUpgrade, isLocal } from './lib/http.mjs'
import { authOf } from './lib/auth.mjs'

import * as tldraw from './rooms/tldraw-room.mjs'
import * as excalidraw from './rooms/excalidraw-room.mjs'

const PORT = Number(process.env.COLLAB_PORT || 3030)

/** 引擎注册表：URL 段 → 模块 */
const ENGINES = new Map([
  [tldraw.engine, tldraw],
  [excalidraw.engine, excalidraw],
])
const DEFAULT_ENGINE = tldraw.engine

/** 房间号必须与 Java 侧 CanvasController.newRoomId() 的格式一致：16 位 hex */
const ROOM_ID_RE = /^[0-9a-f]{16}$/

/** 新路径 /connect/<engine>/<id> 与旧路径 /connect/<id>（= tldraw） */
function parseConnect(pathname) {
  const full = pathname.match(/^\/connect\/([a-z][a-z0-9-]*)\/([0-9a-f]{16})$/)
  if (full) return { engine: full[1], roomId: full[2] }
  const legacy = pathname.match(/^\/connect\/([0-9a-f]{16})$/)
  if (legacy) return { engine: DEFAULT_ENGINE, roomId: legacy[1] }
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  // 内部端点（健康检查 / 房间清理）只认本机：nginx 侧只放行 /collab/connect/，
  // 这里再兜一道，避免将来误配把删除口暴露到公网（defense in depth）
  const local = isLocal(req)

  if (req.method === 'GET' && url.pathname === '/health') {
    if (!local) return json(res, 404, { error: 'not found' })
    const engines = {}
    for (const [name, mod] of ENGINES) engines[name] = mod.stats()
    return json(res, 200, { ok: true, engines })
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/rooms/')) {
    if (!local) return json(res, 404, { error: 'not found' })
    const roomId = url.pathname.slice('/rooms/'.length)
    if (!ROOM_ID_RE.test(roomId)) return json(res, 400, { error: 'bad room id' })
    // 一个 roomId 只会属于一个引擎，但这里遍历全部：既省掉「查引擎」的额外状态，
    // 也让将来加引擎时删除逻辑自动跟上（返回里能看到每个引擎清了几张表）。
    const result = {}
    for (const [name, mod] of ENGINES) {
      try {
        result[name] = mod.drop(roomId)
      } catch (e) {
        result[name] = { error: String(e && e.message ? e.message : e) }
      }
    }
    console.log(`[room] dropped ${roomId} ${JSON.stringify(result)}`)
    return json(res, 200, { ok: true, engines: result })
  }

  json(res, 404, { error: 'not found' })
})

// maxPayload：给图片 dataURL 留余量，但不能无限（ws 默认 100MB 太宽）
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 })

// 握手即鉴权：未登录 / 非 B 端会话一律不升级
server.on('upgrade', async (req, socket, head) => {
  // 只处理**真正的** WebSocket 升级。其它带 Upgrade 头的请求（典型：Java HttpClient 默认
  // HTTP/2，对明文 http:// 会先发 h2c 探测）必须放行给 HTTP 处理器语义，不能当非法 WS 路径拒掉。
  if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    console.log(`[ws] 忽略非 websocket 的 upgrade（${req.headers.upgrade || '空'} ${req.url}）`)
    return rejectUpgrade(socket, 400, 'Bad Request')
  }

  let pathname = ''
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname
  } catch {
    return rejectUpgrade(socket, 400, 'Bad Request')
  }

  const parsed = parseConnect(pathname)
  if (!parsed) return rejectUpgrade(socket, 404, 'Not Found')

  const mod = ENGINES.get(parsed.engine)
  if (!mod) {
    console.log(`[ws] 未知引擎 ${parsed.engine} ${pathname}`)
    return rejectUpgrade(socket, 404, 'Not Found')
  }

  const who = await authOf(req.headers.cookie)
  if (!who) {
    console.log(`[auth] reject ${pathname} (no valid b-session)`)
    return rejectUpgrade(socket, 401, 'Unauthorized')
  }

  const { roomId } = parsed
  wss.handleUpgrade(req, socket, head, (ws) => {
    try {
      mod.attach(roomId, ws)
    } catch (e) {
      console.error(`[${parsed.engine}] attach failed ${roomId}:`, e)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[collab] listening on 127.0.0.1:${PORT}  engines=${[...ENGINES.keys()].join(',')}  auth=${process.env.COLLAB_AUTH_VERIFY || 'default'}`,
  )
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[collab] ${sig} → shutting down`)
    try {
      // 先把脏房间落盘再关库，否则最后几秒的编辑会丢
      if (excalidraw.flushAll) excalidraw.flushAll()
      if (tldraw.closeAll) tldraw.closeAll()
      server.close()
      db.close()
    } catch {
      /* ignore */
    }
    process.exit(0)
  })
}
