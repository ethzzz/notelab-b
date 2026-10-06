// 摸金行动 · 共享数据模型
// 类型 / 草稿工厂 / 净化 / 展示标签 / EV 计算。
// ⚠️ 净化口径必须与 notelab-java 的 LootContentController 及 notelab-c/lib/loot-engine.ts **完全一致**
//    （空值丢弃、数值夹取范围、id 规则），否则同一份文档在两端往返后形态不同 → 误报「有未保存改动」。
//
// ⚠️ 2026-10-06 形状化：物品带形状、容器变网格、背包变网格；
//    稀有度从代码常量改成后台数据（`loot.rarities`），档位可增删。

// ---------------- 稀有度（动态） ----------------

export type Rarity = string

export interface RarityDef {
  key: string
  label: string
  /** 色板 key（见本文件 PALETTE） */
  color: string
  /** 每格基准价值：物品面值的定价锚点（面值 ≈ unitValue × 占格数） */
  unitValue: number
}

/** 兜底五档：后台还没配 rarities 时用，也是「恢复默认」的来源 */
export const DEFAULT_RARITIES: RarityDef[] = [
  { key: "common", label: "普通", color: "slate", unitValue: 65 },
  { key: "uncommon", label: "精良", color: "blue", unitValue: 280 },
  { key: "rare", label: "稀有", color: "purple", unitValue: 830 },
  { key: "epic", label: "史诗", color: "amber", unitValue: 2250 },
  { key: "legendary", label: "传说", color: "red", unitValue: 7250 },
]

/**
 * 色板：后台「稀有度配置」页的下拉选项。
 * ⚠️ 与 C 端 `notelab-c/lib/loot-palette.ts` 是同构的两份（两个仓不能互相 import），
 *    key 集合必须一致 —— 后台选了什么色，前台就染什么色。
 */
export interface PaletteEntry {
  label: string
  /** antd Tag 的预设色名 */
  tag: string
  /** 色块预览（B 端自己也用 Tailwind） */
  swatch: string
}

export const PALETTE: Record<string, PaletteEntry> = {
  slate: { label: "灰白（普通）", tag: "default", swatch: "bg-slate-400" },
  blue: { label: "蓝", tag: "blue", swatch: "bg-blue-500" },
  cyan: { label: "青", tag: "cyan", swatch: "bg-cyan-500" },
  emerald: { label: "绿", tag: "green", swatch: "bg-emerald-500" },
  amber: { label: "黄（史诗）", tag: "gold", swatch: "bg-amber-500" },
  purple: { label: "紫（稀有）", tag: "purple", swatch: "bg-purple-500" },
  rose: { label: "玫红", tag: "magenta", swatch: "bg-rose-500" },
  red: { label: "红（传说）", tag: "red", swatch: "bg-red-500" },
}

export const PALETTE_KEYS = Object.keys(PALETTE)

/** 取色板项；未知 key 回落灰白（**绝不返回 undefined**） */
export function paletteOf(key?: string | null): PaletteEntry {
  return (key && PALETTE[key]) || PALETTE.slate
}

/** 稀有度顺序（数组顺序 = 由低到高） */
export function rarityOrder(doc: { rarities?: RarityDef[] } | null | undefined): string[] {
  const rs = doc?.rarities
  if (!Array.isArray(rs) || rs.length === 0) return DEFAULT_RARITIES.map((r) => r.key)
  const keys = rs.map((r) => r?.key).filter((k) => typeof k === "string" && k)
  return keys.length ? keys : DEFAULT_RARITIES.map((r) => r.key)
}

/** key → 中文名 */
export function labelMap(doc: { rarities?: RarityDef[] } | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of doc?.rarities?.length ? doc.rarities : DEFAULT_RARITIES) out[r.key] = r.label || r.key
  return out
}

/** key → antd Tag 色名 */
export function tagColorMap(doc: { rarities?: RarityDef[] } | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of doc?.rarities?.length ? doc.rarities : DEFAULT_RARITIES) out[r.key] = paletteOf(r.color).tag
  return out
}

/** key → 每格基准价 */
export function unitValueMap(doc: { rarities?: RarityDef[] } | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of doc?.rarities?.length ? doc.rarities : DEFAULT_RARITIES) out[r.key] = Number(r.unitValue) || 0
  return out
}

/** 建议面值 = 该稀有度每格基准价 × 占格数（定价提示，不参与结算） */
export function suggestValue(doc: { rarities?: RarityDef[] } | null | undefined, rarity: string, shapeId?: string | null): number {
  const uv = unitValueMap(doc)[rarity] ?? 0
  return Math.round(uv * shapeSize(shapeId))
}

// ---------------- 形状 ----------------

export type Cell = [number, number]

export interface ShapeDef { id: string; label: string; cells: Cell[] }

/** ⚠️ 与 C 端 loot-engine 的 SHAPES 逐字一致（改一边必须改另一边） */
export const SHAPES: ShapeDef[] = [
  { id: "1x1", label: "1×1 单格", cells: [[0, 0]] },
  { id: "1x2", label: "1×2 短条", cells: [[0, 0], [1, 0]] },
  { id: "1x3", label: "1×3 长条", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "2x2", label: "2×2 方块", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "L", label: "L 形（3 格）", cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "J", label: "J 形（3 格）", cells: [[1, 0], [1, 1], [0, 1]] },
  { id: "T", label: "T 形（4 格）", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "S", label: "S 形（4 格）", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
]

export const SHAPE_IDS = SHAPES.map((s) => s.id)

export function shapeOf(id?: string | null): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0]
}

/** 该形状占几格 */
export function shapeSize(id?: string | null): number {
  return shapeOf(id).cells.length
}

/** 顺时针旋转 rot×90° 并把结果平移回左上角对齐 */
export function rotateCells(cells: Cell[], rot: number): Cell[] {
  let out = cells.map(([x, y]) => [x, y] as Cell)
  const n = ((rot % 4) + 4) % 4
  for (let i = 0; i < n; i++) out = out.map(([x, y]) => [-y, x] as Cell)
  const mx = Math.min(...out.map((c) => c[0]))
  const my = Math.min(...out.map((c) => c[1]))
  return out.map(([x, y]) => [x - mx, y - my] as Cell)
}

/** 给形状在 cols×rows 网格里找安放点（先试 4 向旋转，再行优先扫位置） */
export function findPlacement(
  shapeId: string, cols: number, rows: number, grid: boolean[],
): { x: number; y: number; rot: number; cells: Cell[] } | null {
  const base = shapeOf(shapeId).cells
  for (let rot = 0; rot < 4; rot++) {
    const rc = rotateCells(base, rot)
    let w = 0
    let h = 0
    for (const [cx, cy] of rc) { if (cx + 1 > w) w = cx + 1; if (cy + 1 > h) h = cy + 1 }
    if (w > cols || h > rows) continue
    for (let y = 0; y + h <= rows; y++) {
      for (let x = 0; x + w <= cols; x++) {
        let ok = true
        for (const [cx, cy] of rc) {
          if (grid[(y + cy) * cols + (x + cx)]) { ok = false; break }
        }
        if (!ok) continue
        return { x, y, rot, cells: rc.map(([cx, cy]) => [x + cx, y + cy] as Cell) }
      }
    }
  }
  return null
}

/**
 * 容器档位 = 产出稀有度的**期望档**（rarityWeights 在 order 上加权平均后就近取整）。
 * 与 C 端 `loot-engine.containerTier` 同一口径 —— 后台显示什么档，前台就染什么色。
 * 口径理由（别改成"权重最高的档"或"能出的最高档"）见 C 端那份注释。
 */
export function containerTier(c: { rarityWeights?: Record<string, number> | null }, order: string[]): Rarity {
  let sum = 0
  let acc = 0
  for (let i = 0; i < order.length; i++) {
    const w = Math.max(0, c.rarityWeights?.[order[i]] ?? 0)
    sum += w
    acc += w * i
  }
  if (sum <= 0) return order[0] ?? "common"
  const idx = Math.min(order.length - 1, Math.max(0, Math.round(acc / sum)))
  return order[idx]
}

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
  /** 图片路径（C 端 public 下的路径，如 /loot/gold.png）；留空则显示 emoji */
  image: string
  /** 形状 id；空 = 1×1 */
  shape: string
  tags: string[]
  desc: string
}

// ---------------- 容器 ----------------

export interface Pity { afterRuns: number; minRarity: Rarity }

export interface ContainerDef {
  id: string
  name: string
  /** 网格列数区间（1-8），开局按 seed 掷 */
  colsMin: number
  colsMax: number
  /** 网格行数区间（1-8） */
  rowsMin: number
  rowsMax: number
  /** 每格被填上东西的概率（0-1） */
  fillRate: number
  slotMs: number
  rarityWeights: Record<string, number>
  riskCost: number
  /** 保底配置；null = 无保底 */
  pity: Pity | null
  tableId: string
  emoji: string
}

// ---------------- 掉落表 ----------------

export interface PoolEntry { itemId: string; weight: number }

export interface TableDef { id: string; name: string; pool: PoolEntry[] }

// ---------------- 地图 ----------------

export interface EntryItem { itemId: string; qty: number }

export interface EntryReq { coins: number; items: EntryItem[]; minExtracts: number; groups: string[] }

export interface MapCtn { containerId: string; count: number }

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
  /** 背包网格列数（1-8） */
  backpackCols: number
  /** 背包网格行数（1-8） */
  backpackRows: number
  initialCoins: number
  rescueCoins: number
  rescueCooldownSec: number
  extractHoldMs: number
  /** 每往背包塞**一格**加的风险 */
  riskPerSlot: number
  evWarnRatio: number
  evRejectRatio: number
}

/** 一份完整的待落库文档（六切片，rarities 是新增的那个） */
export interface LootDoc {
  rarities: RarityDef[]
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
/** 新建容器时的默认权重（PRD §5.1 的"容器级默认值"） */
export const DEFAULT_WEIGHTS = (order: string[]): Record<string, number> => {
  const preset: Record<string, number> = { common: 55, uncommon: 28, rare: 12, epic: 4.5, legendary: 0.5 }
  const out: Record<string, number> = {}
  for (const k of order) out[k] = preset[k] ?? 5
  return out
}

export const blankRarity = (): RarityDef => ({ key: `r-${uid36()}`, label: "", color: "slate", unitValue: 100 })

export const blankItem = (): ItemDef => ({
  id: `it-${uid36()}`, name: "", rarity: "common", baseValue: 50, recycleValue: null,
  stack: 1, emoji: "📦", image: "", shape: "1x1", tags: [], desc: "",
})

export const blankContainer = (order: string[]): ContainerDef => ({
  id: `ct-${uid36()}`, name: "", colsMin: 2, colsMax: 2, rowsMin: 2, rowsMax: 2,
  fillRate: 0.75, slotMs: 800, rarityWeights: DEFAULT_WEIGHTS(order),
  riskCost: 1, pity: null, tableId: "", emoji: "📦",
})

export const blankTable = (): TableDef => ({ id: `lt-${uid36()}`, name: "", pool: [] })

export const blankMap = (): MapDef => ({
  id: `map-${uid36()}`, name: "", timeLimitSec: 300, riskLimit: 20, valueMult: 0.18, tierBoost: 0,
  entry: { coins: 200, items: [], minExtracts: 0, groups: [] },
  containers: [], extractPoints: 2,
})

export const blankBalance = (): Balance => ({
  recycleRate: 0.6, extractRate: 0.55, backpackCols: 5, backpackRows: 3, initialCoins: 500, rescueCoins: 200,
  // ⚠️ 阈值必须与设计目标区间 [1.5, 3.5] 自洽：warn 取区间上限（超了才提示），reject 取 10× 门槛（崩到
  //    这个量级才拒绝保存）。旧值 1.15/3.0 的毛病是 warn 低于区间下限 → 健康图常驻告警；reject 紧贴上限
  //    → 手改 valueMult 一点点就被拒。形状化后实测：depot 2.15× / port 2.58× 应静默通过。
  rescueCooldownSec: 86400, extractHoldMs: 5000, riskPerSlot: 1, evWarnRatio: 3.5, evRejectRatio: 10.0,
})

// ---------------- 净化（结构非法丢该条；数值夹取与后端同口径） ----------------

export function sanitizeRarities(raw: any): RarityDef[] {
  if (!Array.isArray(raw)) return DEFAULT_RARITIES.map((r) => ({ ...r }))
  const out: RarityDef[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== "object") continue
    const key = str(r.key)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      label: str(r.label, key),
      color: PALETTE_KEYS.includes(str(r.color)) ? str(r.color) : "slate",
      unitValue: clampInt(r.unitValue, 0, 9_999_999, 0),
    })
  }
  return out.length ? out : DEFAULT_RARITIES.map((r) => ({ ...r }))
}

export function sanitizeItem(raw: any, order: string[]): ItemDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  if (!order.includes(str(raw.rarity))) return null
  const rv = raw.recycleValue
  return {
    id, name, rarity: str(raw.rarity),
    baseValue: clampInt(raw.baseValue, 1, 9_999_999, 50),
    recycleValue: typeof rv === "number" && Number.isFinite(rv) ? clampInt(rv, 0, 9_999_999, 0) : null,
    stack: clampInt(raw.stack, 1, 99, 1),
    emoji: str(raw.emoji, "📦"),
    image: str(raw.image, ""),
    // 形状必须是已知 id：写错的/还没跟上的一律回落 1×1，绝不留 undefined（放置算法会炸）
    shape: SHAPE_IDS.includes(str(raw.shape)) ? str(raw.shape) : "1x1",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.trim()) : [],
    desc: typeof raw.desc === "string" ? raw.desc : "",
  }
}

/** 各档权重：每档都必须是 ≥ 0 的有限数、总和 > 0；否则 null（丢该条） */
export function sanitizeWeights(raw: any, order: string[]): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null
  const out: Record<string, number> = {}
  let sum = 0
  for (const r of order) {
    const v = raw[r]
    if (typeof v !== "number" || !Number.isFinite(v)) return null
    const c = Math.max(0, Math.min(999, v))
    out[r] = c
    sum += c
  }
  return sum > 0 ? out : null
}

export function sanitizePity(raw: any, order: string[]): Pity | null {
  if (!raw || typeof raw !== "object") return null
  if (!order.includes(str(raw.minRarity))) return null
  return { afterRuns: clampInt(raw.afterRuns, 2, 50, 12), minRarity: str(raw.minRarity) }
}

/**
 * 旧配置（只有标量 slots、没有网格）的迁移。
 * ⚠️ 生产上已发布的那份配置就是这种形态 —— 不迁移的话容器会被整条丢掉，
 *    C 端关键切片为空 → 回落内置默认包，表现为"后台配的东西全没了但没报错"。
 */
function gridFromSlots(slots: number) {
  const n = Math.max(1, Math.floor(Number(slots) || 1))
  if (n <= 1) return { colsMin: 1, colsMax: 1, rowsMin: 1, rowsMax: 1 }
  if (n === 2) return { colsMin: 2, colsMax: 2, rowsMin: 1, rowsMax: 1 }
  if (n <= 4) return { colsMin: 2, colsMax: 2, rowsMin: 2, rowsMax: 2 }
  return { colsMin: 3, colsMax: 3, rowsMin: 2, rowsMax: 2 }
}

export function sanitizeContainer(raw: any, order: string[]): ContainerDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = str(raw.id)
  const name = str(raw.name)
  const tableId = str(raw.tableId)
  if (!id || !name || !tableId) return null
  const w = sanitizeWeights(raw.rarityWeights, order)
  if (!w) return null
  const legacy = gridFromSlots(raw.slots)
  const colsMin = clampInt(raw.colsMin ?? legacy.colsMin, 1, 8, legacy.colsMin)
  const colsMax = clampInt(raw.colsMax ?? legacy.colsMax, colsMin, 8, legacy.colsMax)
  const rowsMin = clampInt(raw.rowsMin ?? legacy.rowsMin, 1, 8, legacy.rowsMin)
  const rowsMax = clampInt(raw.rowsMax ?? legacy.rowsMax, rowsMin, 8, legacy.rowsMax)
  return {
    id, name,
    colsMin, colsMax, rowsMin, rowsMax,
    fillRate: clampDbl(raw.fillRate, 0, 1, 0.75),
    slotMs: clampInt(raw.slotMs, 100, 10_000, 800),
    rarityWeights: w,
    riskCost: clampInt(raw.riskCost, 0, 10, 1),
    pity: sanitizePity(raw.pity, order),
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
    valueMult: clampDbl(raw.valueMult, 0.01, 100, 0.18),
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
    backpackCols: clampInt(raw.backpackCols, 1, 8, b.backpackCols),
    backpackRows: clampInt(raw.backpackRows, 1, 8, b.backpackRows),
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
// ⚠️ 2026-10-06 形状化：格子 ≠ 件数。单格价值 = 填充率 × 平均面值 ÷ 平均占格数，
//    背包容量也从"件数"改成"格数"。
export interface MapEv {
  mapId: string
  name: string
  /** 全部格子的毛收益（不设上限，只作参考，不要拿它判经济） */
  grossAll: number
  /** 按背包上限择优能带走的毛收益（**这个才是真实可达值**） */
  gross: number
  /** 期望收益 / 门槛金币 */
  ratio: number
  level: "ok" | "warn" | "reject"
  /** 吃满背包所需风险（容器风险成本 + 每格风险） */
  riskNeeded: number
  riskLimit: number
  /** 风险放得下吗（false = 风险先于背包成为瓶颈，玩家被迫少拿） */
  riskOk: boolean
  /** 背包装不下的格数（> 0 说明容器配比偏多） */
  wastedSlots: number
}

/** 一个容器网格的期望格数（尺寸随机，取区间中点） */
function avgCells(c: ContainerDef): number {
  const cols = (Math.max(1, c.colsMin) + Math.max(c.colsMin, c.colsMax)) / 2
  const rows = (Math.max(1, c.rowsMin) + Math.max(c.rowsMin, c.rowsMax)) / 2
  return Math.max(1, cols * rows)
}

/** 单容器单格的期望面值（价值密度）：fillRate × 加权平均面值 ÷ 加权平均占格数 */
export function slotEv(
  ctn: ContainerDef, table: TableDef | undefined, items: ItemDef[], order: string[], tierBoost = 0,
): number {
  if (!table || !table.pool.length) return 0
  const byId = new Map(items.map((i) => [i.id, i]))
  const w = { ...ctn.rarityWeights } as Record<string, number>
  if (tierBoost > 0) {
    for (let i = 2; i < order.length; i++) w[order[i]] = (w[order[i]] || 0) * (1 + tierBoost)
  }
  const total = order.reduce((s, r) => s + Math.max(0, w[r] || 0), 0)
  if (total <= 0) return 0
  let evValue = 0
  let evCells = 0
  for (const r of order) {
    const share = Math.max(0, w[r] || 0) / total
    if (share <= 0) continue
    const cands = table.pool.filter((p) => byId.get(p.itemId)?.rarity === r && p.weight > 0)
    if (!cands.length) continue // 该档池子空 → 引擎会降档，这里记 0（别假装有收益）
    const wsum = cands.reduce((s, p) => s + p.weight, 0)
    const wavgValue = cands.reduce((s, p) => s + p.weight * (byId.get(p.itemId)?.baseValue || 0), 0) / wsum
    const wavgCells = cands.reduce((s, p) => s + p.weight * shapeSize(byId.get(p.itemId)?.shape), 0) / wsum
    evValue += share * wavgValue
    evCells += share * Math.max(1, wavgCells)
  }
  if (evCells <= 0) return 0
  return ((ctn.fillRate ?? 0.75) * evValue) / evCells
}

/** 地图期望收益与 EV 倍率：毛收益（择优带入背包）→ ×价值倍率 ×回收率 ×撤离率 → ÷门票 */
export function evalMap(doc: LootDoc): (map: MapDef) => MapEv {
  const { containers, tables, items, balance, rarities } = doc
  const order = rarityOrder({ rarities })
  const ctnById = new Map(containers.map((c) => [c.id, c]))
  const tblById = new Map(tables.map((t) => [t.id, t]))
  const bagCells = Math.max(1, balance.backpackCols * balance.backpackRows)

  return (map: MapDef): MapEv => {
    // 按地图配比展开成「容器实例」，每个实例记自己的单格期望值 / 期望格数 / 风险成本
    const groups: { ev: number; cells: number; riskCost: number }[] = []
    let grossAll = 0
    let allCells = 0
    for (const mc of map.containers) {
      const c = ctnById.get(mc.containerId)
      if (!c) continue
      const ev = slotEv(c, tblById.get(c.tableId), items, order, map.tierBoost)
      const cells = avgCells(c)
      const n = Math.max(0, Math.floor(mc.count))
      for (let i = 0; i < n; i++) {
        groups.push({ ev, cells, riskCost: c.riskCost })
        grossAll += ev * cells
        allCells += cells
      }
    }

    // 会算账的玩家：单格期望值高的容器先开；装满背包就撤；会把自己撑爆的格子不拿
    const limit = Math.max(1, Math.floor(map.riskLimit))
    const per = Math.max(0, balance.riskPerSlot)
    let bag = 0, risk = 0, gross = 0
    for (const g of [...groups].sort((a, b) => b.ev - a.ev)) {
      if (bag >= bagCells) break
      if (risk + g.riskCost > limit) continue
      const want = Math.min(g.cells, bagCells - bag)
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
      wastedSlots: Math.max(0, Math.round(allCells) - bagCells),
    }
  }
}
