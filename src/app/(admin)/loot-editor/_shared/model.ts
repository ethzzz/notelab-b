// 摸金行动 · 共享数据模型
// 类型 / 草稿工厂 / 净化 / 展示标签 / EV 计算。
// ⚠️ 净化口径必须与 notelab-java 的 LootContentController 及 notelab-c/lib/loot-engine.ts **完全一致**
//    （空值丢弃、数值夹取范围、id 规则），否则同一份文档在两端往返后形态不同 → 误报「有未保存改动」。

// ---------------- 稀有度 ----------------
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary"

/** ⚠️ 顺序不可变：权重展示与保底判定都依赖它，两端硬编码同一份顺序 */
export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "普通", uncommon: "精良", rare: "稀有", epic: "史诗", legendary: "传说",
}

/** 中文语境：越高档越"红"（暖），普通用灰 */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "default", uncommon: "green", rare: "blue", epic: "purple", legendary: "orange",
}

export type RarityWeights = Record<Rarity, number>

// ---------------- 物品 ----------------
export interface ItemDef {
  id: string
  name: string
  rarity: Rarity
  baseValue: number
  /** 覆盖回收价；null = 用 balance.recycleRate 计算 */
  recycleValue: number | null
  stack: number
  emoji: string
  tags: string[]
  desc: string
}

// ---------------- 容器 ----------------
export interface Pity {
  afterRuns: number
  minRarity: Rarity
}

export interface ContainerDef {
  id: string
  name: string
  slots: number
  slotMs: number
  rarityWeights: RarityWeights
  riskCost: number
  /** 保底配置；null = 无保底 */
  pity: Pity | null
  tableId: string
  emoji: string
}

// ---------------- 掉落表 ----------------
export interface PoolEntry {
  itemId: string
  weight: number
}

export interface TableDef {
  id: string
  name: string
  pool: PoolEntry[]
}

// ---------------- 地图 ----------------
export interface EntryItem {
  itemId: string
  qty: number
}

export interface EntryReq {
  coins: number
  items: EntryItem[]
  minExtracts: number
  groups: string[]
}

export interface MapCtn {
  containerId: string
  count: number
}

export interface MapDef {
  id: string
  name: string
  timeLimitSec: number
  riskLimit: number
  valueMult: number
  tierBoost: number
  entry: EntryReq
  containers: MapCtn[]
  extractPoints: number
}

// ---------------- 全局参数 ----------------
export interface Balance {
  recycleRate: number
  extractRate: number
  backpackCap: number
  initialCoins: number
  rescueCoins: number
  rescueCooldownSec: number
  extractHoldMs: number
  riskPerSlot: number
  evWarnRatio: number
  evRejectRatio: number
}

/** 一份完整的待落库文档（五切片） */
export interface LootDoc {
  items: ItemDef[]
  containers: ContainerDef[]
  tables: TableDef[]
  maps: MapDef[]
  balance: Balance
}

// ---------------- 工具 ----------------
/** 唯一 id 生成（36 进制时间戳 + 随机尾），用于新建草稿 */
export const uid36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

const clampInt = (v: any, lo: number, hi: number, dft: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dft
}
const clampDbl = (v: any, lo: number, hi: number, dft: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dft
}
const str = (v: any, dft = "") => (typeof v === "string" && v.trim() ? v.trim() : dft)

// ---------------- 草稿工厂 ----------------
/** 新建容器/地图时的默认权重（PRD §5.1 的"容器级默认值"） */
export const DEFAULT_WEIGHTS = (): RarityWeights => ({
  common: 55, uncommon: 28, rare: 12, epic: 4.5, legendary: 0.5,
})

export const blankItem = (): ItemDef => ({
  id: `it-${uid36()}`, name: "", rarity: "common", baseValue: 50, recycleValue: null,
  stack: 1, emoji: "📦", tags: [], desc: "",
})

export const blankContainer = (): ContainerDef => ({
  id: `ct-${uid36()}`, name: "", slots: 2, slotMs: 800, rarityWeights: DEFAULT_WEIGHTS(),
  riskCost: 1, pity: null, tableId: "", emoji: "📦",
})

export const blankTable = (): TableDef => ({
  id: `lt-${uid36()}`, name: "", pool: [],
})

export const blankMap = (): MapDef => ({
  id: `map-${uid36()}`, name: "", timeLimitSec: 300, riskLimit: 20, valueMult: 0.35, tierBoost: 0,
  entry: { coins: 200, items: [], minExtracts: 0, groups: [] },
  containers: [], extractPoints: 2,
})

export const blankBalance = (): Balance => ({
  recycleRate: 0.6, extractRate: 0.55, backpackCap: 8, initialCoins: 500, rescueCoins: 200,
  rescueCooldownSec: 86400, extractHoldMs: 5000, riskPerSlot: 1, evWarnRatio: 1.15, evRejectRatio: 3.0,
})

// ---------------- 净化（结构非法丢该条；数值夹取与后端同口径） ----------------
export function sanitizeItem(raw: any): ItemDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  if (!RARITIES.includes(raw.rarity)) return null
  const rv = raw.recycleValue
  return {
    id, name, rarity: raw.rarity,
    baseValue: clampInt(raw.baseValue, 1, 9_999_999, 50),
    recycleValue: typeof rv === "number" && Number.isFinite(rv) ? clampInt(rv, 0, 9_999_999, 0) : null,
    stack: clampInt(raw.stack, 1, 99, 1),
    emoji: str(raw.emoji, "📦"),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.trim()) : [],
    desc: typeof raw.desc === "string" ? raw.desc : "",
  }
}

/** 五档权重：五档全在、每档 ≥ 0、总和 > 0；否则 null（丢该条） */
export function sanitizeWeights(raw: any): RarityWeights | null {
  if (!raw || typeof raw !== "object") return null
  const out = {} as RarityWeights
  let sum = 0
  for (const r of RARITIES) {
    const v = raw[r]
    if (typeof v !== "number" || !Number.isFinite(v)) return null
    const c = Math.max(0, Math.min(999, v))
    out[r] = c
    sum += c
  }
  return sum > 0 ? out : null
}

export function sanitizePity(raw: any): Pity | null {
  if (!raw || typeof raw !== "object") return null
  if (!RARITIES.includes(raw.minRarity)) return null
  return { afterRuns: clampInt(raw.afterRuns, 2, 50, 12), minRarity: raw.minRarity }
}

export function sanitizeContainer(raw: any): ContainerDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  const name = str(raw.name)
  const tableId = str(raw.tableId)
  if (!id || !name || !tableId) return null
  const w = sanitizeWeights(raw.rarityWeights)
  if (!w) return null
  return {
    id, name,
    slots: clampInt(raw.slots, 1, 6, 1),
    slotMs: clampInt(raw.slotMs, 100, 10_000, 800),
    rarityWeights: w,
    riskCost: clampInt(raw.riskCost, 0, 10, 1),
    pity: sanitizePity(raw.pity),
    tableId,
    emoji: str(raw.emoji, "📦"),
  }
}

export function sanitizeTable(raw: any): TableDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  if (!id) return null
  const pool: PoolEntry[] = []
  for (const p of (Array.isArray(raw.pool) ? raw.pool : [])) {
    if (!p || typeof p !== "object") continue
    const itemId = str(p.itemId)
    if (!itemId) continue
    pool.push({ itemId, weight: clampInt(p.weight, 0, 999, 1) })
    if (pool.length >= 200) break
  }
  return { id, name: str(raw.name, id), pool }
}

export function sanitizeEntry(raw: any): EntryReq {
  const out: EntryReq = { coins: 0, items: [], minExtracts: 0, groups: [] }
  if (!raw || typeof raw !== "object") return out
  out.coins = clampInt(raw.coins, 0, 9_999_999, 0)
  out.minExtracts = clampInt(raw.minExtracts, 0, 9999, 0)
  out.items = (Array.isArray(raw.items) ? raw.items : [])
    .filter((i: any) => i && typeof i === "object" && str(i.itemId))
    .map((i: any) => ({ itemId: str(i.itemId), qty: clampInt(i.qty, 1, 99, 1) }))
  out.groups = Array.isArray(raw.groups) ? raw.groups.filter((g: any) => typeof g === "string" && g.trim()).map((g: string) => g.trim()) : []
  return out
}

export function sanitizeMap(raw: any): MapDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  if (!id) return null
  const containers: MapCtn[] = (Array.isArray(raw.containers) ? raw.containers : [])
    .filter((c: any) => c && typeof c === "object" && str(c.containerId))
    .map((c: any) => ({ containerId: str(c.containerId), count: clampInt(c.count, 0, 99, 1) }))
  return {
    id, name: str(raw.name, id),
    timeLimitSec: clampInt(raw.timeLimitSec, 30, 3600, 300),
    riskLimit: clampInt(raw.riskLimit, 1, 999, 20),
    valueMult: clampDbl(raw.valueMult, 0.01, 100, 0.35),
    tierBoost: clampDbl(raw.tierBoost, 0, 10, 0),
    entry: sanitizeEntry(raw.entry),
    containers,
    extractPoints: clampInt(raw.extractPoints, 1, 9, 2),
  }
}

export function sanitizeBalance(raw: any): Balance {
  const b = blankBalance()
  if (!raw || typeof raw !== "object") return b
  return {
    recycleRate: clampDbl(raw.recycleRate, 0, 1, b.recycleRate),
    extractRate: clampDbl(raw.extractRate, 0, 1, b.extractRate),
    backpackCap: clampInt(raw.backpackCap, 1, 50, b.backpackCap),
    initialCoins: clampInt(raw.initialCoins, 0, 9_999_999, b.initialCoins),
    rescueCoins: clampInt(raw.rescueCoins, 0, 9_999_999, b.rescueCoins),
    rescueCooldownSec: clampInt(raw.rescueCooldownSec, 0, 30 * 86400, b.rescueCooldownSec),
    extractHoldMs: clampInt(raw.extractHoldMs, 500, 60_000, b.extractHoldMs),
    riskPerSlot: clampInt(raw.riskPerSlot, 0, 10, b.riskPerSlot),
    evWarnRatio: clampDbl(raw.evWarnRatio, 1, 100, b.evWarnRatio),
    evRejectRatio: clampDbl(raw.evRejectRatio, 1, 100, b.evRejectRatio),
  }
}

// ---------------- EV 计算（B 端 balance 页校验面板用） ----------------
export interface MapEv {
  mapId: string
  name: string
  /** 全摸满并成功撤离的期望金币（未乘门槛） */
  gross: number
  /** 期望收益 / 门槛金币 */
  ratio: number
  level: "ok" | "warn" | "reject"
}

/** 单容器单槽的期望面值：按容器权重抽档 → 取该档在掉落表池子里的平均面值 */
export function slotEv(ctn: ContainerDef, table: TableDef | undefined, items: ItemDef[]): number {
  if (!table) return 0
  const byId = new Map(items.map((i) => [i.id, i]))
  const boost = 1 // 容器自身的 tierBoost 由地图提供，见 mapEv
  const w = { ...ctn.rarityWeights } as RarityWeights
  void boost
  const total = RARITIES.reduce((s, r) => s + (w[r] || 0), 0)
  if (total <= 0) return 0
  let ev = 0
  for (const r of RARITIES) {
    const share = (w[r] || 0) / total
    if (share <= 0) continue
    const candidates = table.pool.filter((p) => byId.get(p.itemId)?.rarity === r)
    if (!candidates.length) continue // 该档池子空 → 贡献 0（也是"该档轮盘空手"的量化体现）
    const avg = candidates.reduce((s, p) => s + (byId.get(p.itemId)?.baseValue || 0), 0) / candidates.length
    ev += share * avg
  }
  return ev
}

/** 地图期望收益与 EV 倍率：gross → ×价值倍率 ×回收率 ×撤离率 → ÷门票 */
export function evalMap(map: MapDef, containers: ContainerDef[], tables: TableDef[], items: ItemDef[], balance: Balance): MapEv {
  const ctnById = new Map(containers.map((c) => [c.id, c]))
  const tblById = new Map(tables.map((t) => [t.id, t]))
  let gross = 0
  for (const mc of map.containers) {
    const c = ctnById.get(mc.containerId)
    if (!c) continue
    const table = tblById.get(c.tableId)
    // tierBoost 只作用于 rare/epic/legendary
    let ev = 0
    const byId = new Map(items.map((i) => [i.id, i]))
    if (table) {
      const total = RARITIES.reduce((s, r) => s + (c.rarityWeights[r] || 0), 0)
      if (total > 0) {
        for (const r of RARITIES) {
          const w = (c.rarityWeights[r] || 0) * (map.tierBoost > 0 && r !== "common" && r !== "uncommon" ? 1 + map.tierBoost : 1)
          if (w <= 0) continue
          const candidates = table.pool.filter((p) => byId.get(p.itemId)?.rarity === r)
          if (!candidates.length) continue
          const avg = candidates.reduce((s, p) => s + (byId.get(p.itemId)?.baseValue || 0), 0) / candidates.length
          ev += (w / total) * avg
        }
      }
    }
    gross += ev * c.slots * mc.count
  }
  const net = gross * map.valueMult * balance.recycleRate * balance.extractRate
  const gate = Math.max(1, map.entry.coins)
  const ratio = net / gate
  const level: MapEv["level"] = ratio > balance.evRejectRatio ? "reject" : ratio > balance.evWarnRatio ? "warn" : "ok"
  return { mapId: map.id, name: map.name, gross: Math.round(gross), ratio, level }
}
