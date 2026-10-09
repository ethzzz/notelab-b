// tldraw 房间（引擎 A）。
//
// 权威状态由 @tldraw/sync-core 的 TLSocketRoom 持有，持久化用它的 SQLiteSyncStorage，
// 每房间一组 tablePrefix = room_<roomId>_ 的表（documents/metadata/objects/tombstones）。
//
// ⚠️ 表前缀 **不要改**：线上已有数据按此前缀落盘，改了等于全体房间读不到内容。
//
// 为什么必须「一个房间全局只有一个 room 实例」：TLSocketRoom 内部维护文档的权威副本，
// 两个实例同时写同一个 storage 会互相覆盖。所以用 Map 缓存，进程内唯一。
import { randomUUID } from 'node:crypto'
import { TLSocketRoom, SQLiteSyncStorage, NodeSqliteWrapper } from '@tldraw/sync-core'
import { db, tablesWithPrefix, dropTables, roomIdsWithPrefix, rowsUnderPrefix } from '../lib/db.mjs'

export const engine = 'tldraw'

/** 表名前缀基座；具体房间为 `${BASE}${roomId}_` */
const BASE = 'room_'
const prefixOf = (roomId) => `${BASE}${roomId}_`

/** roomId → TLSocketRoom（进程内全局唯一） */
const rooms = new Map()

function getRoom(roomId) {
  let room = rooms.get(roomId)
  if (room) return room
  const sql = new NodeSqliteWrapper(db, { tablePrefix: prefixOf(roomId) })
  const storage = new SQLiteSyncStorage({ sql })
  room = new TLSocketRoom({ storage })
  rooms.set(roomId, room)
  console.log(`[tldraw] opened ${roomId}`)
  return room
}

/** 挂一个已鉴权的连接上去。sessionId 由本模块生成（每个连接一个） */
export function attach(roomId, ws) {
  const sessionId = randomUUID()
  const room = getRoom(roomId)
  room.handleSocketConnect({ sessionId, socket: ws })
  ws.on('close', () => {
    try {
      room.handleSocketClose(sessionId)
    } catch {
      /* room 可能已被 drop */
    }
  })
}

/** 丢弃房间：先关实例再删表（顺序反了会让 storage 又把表建回来） */
export function drop(roomId) {
  const room = rooms.get(roomId)
  if (room) {
    try {
      room.close()
    } catch {
      /* 老版本无 close 时的兜底 */
    }
    rooms.delete(roomId)
  }
  const tables = dropTables(tablesWithPrefix(prefixOf(roomId)))
  return { tables, wasOpen: !!room }
}

export function stats() {
  return { open: rooms.size }
}

/**
 * 磁盘上的房间清单（**只看表，不看内存缓存**）—— 供 server.mjs 的内部 `/rooms` 端点对账用。
 * ⚠️ 不能用 `rooms` 这个 Map：它是进程内的活跃房间缓存，重启即空，
 *    而磁盘上的表还在；对账要的恰恰是「磁盘上还剩什么」。
 */
export function inventory() {
  return roomIdsWithPrefix(BASE).map((roomId) => ({
    roomId,
    tables: tablesWithPrefix(prefixOf(roomId)).length,
    rows: rowsUnderPrefix(prefixOf(roomId)),
  }))
}

export function closeAll() {
  for (const [id, room] of rooms) {
    try {
      room.close()
    } catch {
      /* ignore */
    }
    rooms.delete(id)
  }
}
