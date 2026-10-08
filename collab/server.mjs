// NoteLab 协作画布 · 同步服务
//
// 职责：为每个房间维护一个权威 TLSocketRoom（@tldraw/sync-core），在 WebSocket 客户端之间
//       转发变更，并把文档状态持久化到本地 SQLite。
//
// 为什么单独一个进程：
//   1) tldraw sync 要求「同一房间全局只有一个 room 实例」——Next 的多实例 / hot-reload 做不到；
//   2) 与 B 端 Next 解耦：重启前端不断协作连接，反之亦然。
//
// 鉴权：WebSocket 握手时读 cookie，转发给 Java /api/auth/verify 校验，只放行 B 端登录会话
//       （scope=b）。未登录直接 401 拒绝升级，不让匿名连接进来。
//
// 端点（nginx 把 /collab/ 前缀剥掉后到达本进程）：
//   WS     /connect/<roomId>   协作连接
//   GET    /health             健康检查
//   DELETE /rooms/<roomId>     清理房间（仅本机调用，Java 删画布时触发）
//
// 持久化：单文件 SQLite（data/rooms.db），每个房间一个 tablePrefix（room_<id>_）。
//         node:sqlite 是 Node 内置模块（22.5+，实验性），避免 better-sqlite3 的原生编译依赖。

import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { WebSocketServer } from 'ws'
import { TLSocketRoom, SQLiteSyncStorage, NodeSqliteWrapper } from '@tldraw/sync-core'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.COLLAB_PORT || 3030)
const DB_PATH = process.env.COLLAB_DB || resolve(HERE, 'data/rooms.db')
const AUTH_VERIFY = process.env.COLLAB_AUTH_VERIFY || 'http://127.0.0.1:8001/api/auth/verify'
/** 房间号必须与 Java 侧 CanvasController.newRoomId() 的格式一致：16 位 hex */
const ROOM_ID_RE = /^[0-9a-f]{16}$/

mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

/** roomId → TLSocketRoom（保证「一个房间全局只有一个实例」） */
const rooms = new Map()

function tablePrefixOf(roomId) {
  return `room_${roomId}_`
}

function getRoom(roomId) {
  let room = rooms.get(roomId)
  if (room) return room
  const sql = new NodeSqliteWrapper(db, { tablePrefix: tablePrefixOf(roomId) })
  const storage = new SQLiteSyncStorage({ sql })
  room = new TLSocketRoom({ storage })
  rooms.set(roomId, room)
  console.log(`[room] opened ${roomId}`)
  return room
}

/** 校验 cookie：转发给 Java /api/auth/verify，仅认 B 端会话 */
async function authOf(cookie) {
  if (!cookie) return null
  try {
    const r = await fetch(AUTH_VERIFY, {
      headers: { cookie },
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    return j && j.scope === 'b' ? j : null
  } catch {
    // Java 不可达时按未登录处理（fail-closed，不放大门）
    return null
  }
}

function json(res, code, body) {
  const s = JSON.stringify(body)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(s),
  })
  res.end(s)
}

function rejectUpgrade(socket, code, reason) {
  try {
    socket.write(
      `HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    )
  } catch {
    /* ignore */
  }
  socket.destroy()
}

/** 删除某房间在 SQLite 里的全部表（先确保没有活跃 room 实例） */
function dropRoomTables(roomId) {
  const prefix = tablePrefixOf(roomId)
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?")
    .all(`${prefix}%`)
  for (const row of rows) {
    const name = String(row.name).replace(/"/g, '""')
    db.exec(`DROP TABLE IF EXISTS "${name}"`)
  }
  return rows.length
}

/** 是否为本机调用（内部端点只对 127.0.0.1 开放） */
function isLocal(req) {
  const ip = req.socket.remoteAddress || ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  // 内部端点（健康检查 / 房间清理）只认本机：nginx 侧只放行 /collab/connect/，
  // 这里再兜一道，避免将来误配把删除口暴露到公网（defense in depth）
  const local = isLocal(req)

  if (req.method === 'GET' && url.pathname === '/health') {
    if (!local) return json(res, 404, { error: 'not found' })
    return json(res, 200, { ok: true, rooms: rooms.size, db: DB_PATH })
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/rooms/')) {
    if (!local) return json(res, 404, { error: 'not found' })
    const roomId = url.pathname.slice('/rooms/'.length)
    if (!ROOM_ID_RE.test(roomId)) return json(res, 400, { error: 'bad room id' })
    const room = rooms.get(roomId)
    if (room) {
      try {
        room.close()
      } catch {
        /* 老版本无 close 时的兜底 */
      }
      rooms.delete(roomId)
    }
    let dropped = 0
    try {
      dropped = dropRoomTables(roomId)
    } catch (e) {
      return json(res, 500, { error: String(e && e.message ? e.message : e) })
    }
    console.log(`[room] dropped ${roomId} (tables=${dropped}, wasOpen=${!!room})`)
    return json(res, 200, { ok: true, tables: dropped, wasOpen: !!room })
  }

  json(res, 404, { error: 'not found' })
})

const wss = new WebSocketServer({ noServer: true })

// 握手即鉴权：未登录 / 非 B 端会话一律不升级
server.on('upgrade', async (req, socket, head) => {
  let pathname = ''
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname
  } catch {
    return rejectUpgrade(socket, 400, 'Bad Request')
  }
  const m = pathname.match(/^\/connect\/([0-9a-f]{16})$/)
  if (!m) return rejectUpgrade(socket, 404, 'Not Found')

  const who = await authOf(req.headers.cookie)
  if (!who) {
    console.log(`[auth] reject ${pathname} (no valid b-session)`)
    return rejectUpgrade(socket, 401, 'Unauthorized')
  }

  const roomId = m[1]
  wss.handleUpgrade(req, socket, head, (ws) => {
    const sessionId = randomUUID()
    const room = getRoom(roomId)
    try {
      room.handleSocketConnect({ sessionId, socket: ws })
    } catch (e) {
      console.error(`[room] connect failed ${roomId}:`, e)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      return
    }
    ws.on('close', () => {
      try {
        room.handleSocketClose(sessionId)
      } catch {
        /* ignore */
      }
    })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[collab] listening on 127.0.0.1:${PORT}  db=${DB_PATH}  auth=${AUTH_VERIFY}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[collab] ${sig} → shutting down`)
    try {
      server.close()
      db.close()
    } catch {
      /* ignore */
    }
    process.exit(0)
  })
}
