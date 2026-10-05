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

/**
 * 稀有度配色：**白 → 蓝 → 紫 → 黄 → 红**，由低到高。
 * ⚠️ 与 C 端 `notelab-c/app/(play)/play/loot/page.tsx` 的 RARITY_CLS / TIER_CLS 同序同语义，
 *    改一边必须改另一边（antd 预设色名：default=白灰 / blue / purple / gold=黄 / red）。
 */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "default", uncommon: "blue", rare: "purple", epic: "gold", legendary: "red",
}

/**
 * 容器档位 = 产出稀有度的期望档（rarityWeights 加权平均后就近取整）。
 * 与 C 端 `loot-engine.containerTier` 同一口径 —— 后台显示什么档，前台就染什么色。
 * 口径理由（别改成"权重最高的档"或"能出的最高档"）见 C 端那份注释。
 */
export function containerTier(c: { rarityWeights?: RarityWeights | null }): Rarity {
  let sum = 0
  let acc = 0
  for (let i = 0; i < RARITIES.length; i++) {
    const w = Math.max(0, c.rarityWeights?.[RARITIES[i]] ?? 0)
    sum += w
    acc += w * i
  }
  if (sum <= 0) return "common"
  const idx = Math.min(RARITIES.length - 1, Math.max(0, Math.round(acc / sum)))
  return RARITIES[idx]
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
  // ⚠️ 阈值必须与设计目标区间 [1.5, 3.5] 自洽：warn 取区间上限（超了才提示），reject 取 10× 门槛（崩到
  //    这个量级才拒绝保存）。旧值 1.15/3.0 的毛病是 warn 低于区间下限 → 健康图常驻告警；reject 紧贴上限
  //    → 手改 valueMult 一点点就被拒。W3 实测（线上配置）：depot 1.71× / port 2.30× 应静默通过。
  rescueCooldownSec: 86400, extractHoldMs: 5000, riskPerSlot: 1, evWarnRatio: 3.5, evRejectRatio: 10.0,
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
//
// ⚠️ 2026-10-03 修的两处**模型错误**（跑 10k 局模拟才暴露，模拟值 vs 面板值差 2.6 倍）：
//   ① 池内平均面值必须**按 weight 加权**，旧代码用候选的算术平均（权重 22:2 的池子里
//      便宜货的份量被放大 10 倍）。
//   ② **必须考虑背包上限**。旧的"全清毛收益"把 33 个槽位全算进去，但玩家只背得动 8 件 ——
//      港口那张图的 EV 因此被高估到 3.00×（真实值 2.30×，门槛还按错的数定成了 900）。
//      现在按"会算账的玩家"建模：单格期望值从高到低开容器，装满/风险放不下就收手。
export interface MapEv {
  mapId: string
  name: string
  /** 全部槽位的毛收益（不设上限，只作参考，不要拿它判经济） */
  grossAll: number
  /** 按背包上限择优能带走的毛收益（**这个才是真实可达值**） */
  gross: number
  /** 期望收益 / 门槛金币 */
  ratio: number
  level: "ok" | "warn" | "reject"
  /** 吃满背包所需风险（容器风险成本 + 每件风险） */
  riskNeeded: number
  riskLimit: number
  /** 风险放得下吗（false = 风险先于背包成为瓶颈，玩家被迫少拿） */
  riskOk: boolean
  /** 背包装不下的槽位数（> 0 说明容器配比偏多） */
  wastedSlots: number
}

/** 单容器单槽的期望面值：按容器权重抽档 → 取该档在掉落表池子里的**加权**平均面值 */
export function slotEv(ctn: ContainerDef, table: TableDef | undefined, items: ItemDef[], tierBoost = 0): number {
  if (!table || !table.pool.length) return 0
  const byId = new Map(items.map((i) => [i.id, i]))
  const w = { ...ctn.rarityWeights } as RarityWeights
  if (tierBoost > 0) {
    for (const r of RARITIES) {
      if (r === "common" || r === "uncommon") continue
      w[r] = (w[r] || 0) * (1 + tierBoost)
    }
  }
  const total = RARITIES.reduce((s, r) => s + Math.max(0, w[r] || 0), 0)
  if (total <= 0) return 0
  let ev = 0
  for (const r of RARITIES) {
    const share = Math.max(0, w[r] || 0) / total
    if (share <= 0) continue
    const cands = table.pool.filter((p) => byId.get(p.itemId)?.rarity === r && p.weight > 0)
    if (!cands.length) continue // 该档池子空 → 引擎会降档，这里记 0（别假装有收益）
    const wsum = cands.reduce((s, p) => s + p.weight, 0)
    const wavg = cands.reduce((s, p) => s + p.weight * (byId.get(p.itemId)?.baseValue || 0), 0) / wsum
    ev += share * wavg
  }
  return ev
}

/** 地图期望收益与 EV 倍率：毛收益（择优带入背包）→ ×价值倍率 ×回收率 ×撤离率 → ÷门票 */
export function evalMap(map: MapDef, containers: ContainerDef[], tables: TableDef[], items: ItemDef[], balance: Balance): MapEv {
  const ctnById = new Map(containers.map((c) => [c.id, c]))
  const tblById = new Map(tables.map((t) => [t.id, t]))

  // 按地图配比展开成「容器实例」，每个实例记自己的单格期望值 / 槽位 / 风险成本
  const groups: { ev: number; slots: number; riskCost: number }[] = []
  let grossAll = 0
  let allSlots = 0
  for (const mc of map.containers) {
    const c = ctnById.get(mc.containerId)
    if (!c) continue
    const ev = slotEv(c, tblById.get(c.tableId), items, map.tierBoost)
    const sl = Math.max(1, c.slots)
    const n = Math.max(0, Math.floor(mc.count))
    for (let i = 0; i < n; i++) {
      groups.push({ ev, slots: sl, riskCost: c.riskCost })
      grossAll += ev * sl
      allSlots += sl
    }
  }

  // 会算账的玩家：单格期望值高的容器先开；装满背包就撤；会把自己撑爆的格子不拿
  const cap = Math.max(1, Math.floor(balance.backpackCap))
  const limit = Math.max(1, Math.floor(map.riskLimit))
  const per = Math.max(0, balance.riskPerSlot)
  let bag = 0, risk = 0, gross = 0
  for (const g of [...groups].sort((a, b) => b.ev - a.ev)) {
    if (bag >= cap) break
    if (risk + g.riskCost > limit) continue
    const want = Math.min(g.slots, cap - bag)
    const room = per > 0 ? Math.floor((limit - risk - g.riskCost) / per) : want
    const take = Math.max(0, Math.min(want, room))
    if (take <= 0) continue
    risk += g.riskCost + take * per
    bag += take
    gross += g.ev * take
  }

  const net = gross * map.valueMult * balance.recycleRate * balance.extractRate
  const gate = Math.max(1, map.entry.coins)
  const ratio = net / gate
  const level: MapEv["level"] = ratio > balance.evRejectRatio ? "reject" : ratio > balance.evWarnRatio ? "warn" : "ok"
  return {
    mapId: map.id, name: map.name,
    grossAll: Math.round(grossAll), gross: Math.round(gross),
    ratio, level,
    riskNeeded: risk, riskLimit: limit, riskOk: risk <= limit,
    wastedSlots: Math.max(0, allSlots - cap),
  }
}
