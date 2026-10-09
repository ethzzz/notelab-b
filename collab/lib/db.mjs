// SQLite 单例与通用表操作。
//
// 所有房间数据都落在同一个库文件（默认 data/rooms.db）。**不同引擎用不同的表前缀物理隔离**：
//   tldraw     → room_<roomId>_*   （@tldraw/sync-core 的 SQLiteSyncStorage 自己建 4 张表）
//   excalidraw → exc_<roomId>_*    （本服务自建，见 rooms/excalidraw-room.mjs）
// 一个 roomId 理论上只会被一个引擎使用，但前缀分开后「删画布清房间」与排查都不会串味。
//
// 用 Node 内置的 node:sqlite（22.5+，实验性），避免 better-sqlite3 的原生编译依赖 ——
// 服务器上 `npm install` 不需要任何 build toolchain。
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const DB_PATH = process.env.COLLAB_DB || resolve(ROOT, 'data/rooms.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

/** 某前缀下的全部表名（升序，便于日志比对） */
export function tablesWithPrefix(prefix) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name")
    .all(`${prefix}%`)
    .map((r) => String(r.name))
}

/** 表是否存在 */
export function tableExists(name) {
  const row = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name = ?").get(name)
  return !!row
}

/**
 * 从表名反解出 roomId 集合（表名形如 `<prefix><roomId>_<suffix>`）。
 *
 * 用途：**对账**。房间表是懒建的，进程内存里的 `rooms` 缓存重启就空 —— 但磁盘上的表还在。
 * 只扫 sqlite_master 才能拿到「真正有内容的房间」全集，这也是 Java 侧拿不到的那一半信息
 * （元数据在 MySQL，内容在 SQLite，两边必须靠这份清单对账）。
 * 返回按字典序，便于日志与断言比对。
 */
export function roomIdsWithPrefix(prefix) {
  const ids = new Set()
  for (const name of tablesWithPrefix(prefix)) {
    const rest = name.slice(prefix.length)
    const cut = rest.indexOf('_')
    const id = cut === -1 ? rest : rest.slice(0, cut)
    if (/^[0-9a-f]{16}$/.test(id)) ids.add(id)
  }
  return [...ids].sort()
}

/** 某前缀下所有表的总行数（粗粒度的「内容有多少」信号，别当字节数用） */
export function rowsUnderPrefix(prefix) {
  let total = 0
  for (const name of tablesWithPrefix(prefix)) {
    try {
      total += Number(db.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(name)}`).get().c)
    } catch {
      /* 表可能正被 drop（并发），忽略这一张 */
    }
  }
  return total
}

/** 删除给定表，返回删掉的张数 */
export function dropTables(names) {
  for (const n of names) {
    db.exec(`DROP TABLE IF EXISTS "${n.replace(/"/g, '""')}"`)
  }
  return names.length
}

/** 建表用标识符转义（表名由 roomId 拼出，roomId 已由调用方用正则校验过） */
export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}
