// 摸金行动 · B 端平衡模拟器（balance 页「跑 N 局」按钮用）
//
// ⚠️ 本文件是 **notelab-c/lib/loot-engine.ts + loot-sim.ts 的同构端口**。
//    两个仓（notelab-b / notelab-c）不能互相 import，所以只能有两份实现 ——
//    代价是"改一边忘另一边"会悄悄漂移。兜法是跨端指纹断言：
//    同 seed + 同配置下，B 端与本文件 vs C 端引擎抽出的物品序列必须**逐位一致**。
//    **改这里必须同步改 notelab-c/lib/loot-engine.ts + loot-sim.ts，并重跑跨端对拍。**
//
// 与 model.ts 的分工：model 负责"净化 + 解析 EV"（确定性公式），本文件负责"抽样"（蒙特卡洛）。
//
// ⚠️ 2026-10-06 形状化：容器 = cols×rows 网格（尺寸随机）+ 物品带形状（俄罗斯方块式占位），
//    背包也是网格（自动找位塞入）。所有"件数/槽位"口径全部改成"格数"。
// ⚠️ 稀有度不再写死五档，一律走 doc.rarities 的 order。
//
// ⚠️ LLM 依赖：无。

import {
  findPlacement, rarityOrder, shapeSize,
  type Balance, type ContainerDef, type ItemDef, type MapDef, type PoolEntry, type TableDef,
  type Rarity, type RarityDef,
} from "./model"

type PityState = Record<string, number>

const ZERO = (order: string[]): Record<string, number> => {
  const o: Record<string, number> = {}
  for (const r of order) o[r] = 0
  return o
}

// ---------------- RNG（与 C 端逐位一致） ----------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** [lo, hi] 闭区间取整数（rng 消费 1 个随机数） */
function randInt(rng: () => number, lo: number, hi: number): number {
  const a = Math.max(1, Math.floor(Number(lo) || 1))
  const b = Math.max(a, Math.floor(Number(hi) || a))
  return a + Math.floor(rng() * (b - a + 1))
}

/** 掷容器网格尺寸 —— 与 C 端 rollGrid 同式（"几×几随机"的唯一入口） */
export function rollGrid(def: ContainerDef, rng: () => number): { cols: number; rows: number } {
  return { cols: randInt(rng, def.colsMin, def.colsMax), rows: randInt(rng, def.rowsMin, def.rowsMax) }
}

export function newGrid(cols: number, rows: number): boolean[] {
  return new Array(Math.max(1, cols) * Math.max(1, rows)).fill(false)
}

// ---------------- 抽取（全部带 order 参数，档位动态） ----------------

export function rollRarity(w: Record<string, number>, rng: () => number, order: string[], tierBoost = 0): Rarity {
  const boosted: Record<string, number> = { ...w }
  if (tierBoost > 0) {
    for (let i = 2; i < order.length; i++) boosted[order[i]] = (boosted[order[i]] || 0) * (1 + tierBoost)
  }
  const total = order.reduce((s, r) => s + Math.max(0, boosted[r] || 0), 0)
  if (total <= 0) return order[0] ?? "common"
  let x = rng() * total
  for (const r of order) { x -= Math.max(0, boosted[r] || 0); if (x < 0) return r }
  return order[0] ?? "common"
}

export function resolveRarity(
  w: Record<string, number>, table: TableDef | undefined, byId: Map<string, ItemDef>,
  rng: () => number, order: string[], tierBoost = 0,
): Rarity | null {
  if (!table || table.pool.length === 0) return null
  const drawn = rollRarity(w, rng, order, tierBoost)
  const has = (r: Rarity) => table.pool.some((p) => byId.get(p.itemId)?.rarity === r)
  if (has(drawn)) return drawn
  const idx = order.indexOf(drawn)
  if (idx < 0) return null
  for (let i = idx; i >= 0; i--) if (has(order[i])) return order[i]
  for (let i = idx + 1; i < order.length; i++) if (has(order[i])) return order[i]
  return null
}

export function rollItem(pool: PoolEntry[], rarity: Rarity, byId: Map<string, ItemDef>, rng: () => number): ItemDef | null {
  const cands = pool.filter((p) => byId.get(p.itemId)?.rarity === rarity && (p.weight || 0) > 0)
  if (cands.length === 0) return null
  const total = cands.reduce((s, p) => s + p.weight, 0)
  let x = rng() * total
  for (const p of cands) { x -= p.weight; if (x < 0) return byId.get(p.itemId) ?? null }
  return byId.get(cands[cands.length - 1].itemId) ?? null
}

/** 保底抽取：minRarity 及以上找候选 → 都没有则退到池内最好的一档（与 C 端一致） */
export function pickAtLeast(pool: PoolEntry[], minRarity: Rarity, byId: Map<string, ItemDef>, rng: () => number, order: string[]): ItemDef | null {
  const from = Math.max(0, order.indexOf(minRarity))
  for (let i = from; i < order.length; i++) { const it = rollItem(pool, order[i], byId, rng); if (it) return it }
  for (let i = from - 1; i >= 0; i--) { const it = rollItem(pool, order[i], byId, rng); if (it) return it }
  return null
}

// ---------------- 容器布局（与 C 端 generateLayout 同式） ----------------

export interface PlacedItem { itemId: string; x: number; y: number; rot: number; cells: [number, number][] }

/**
 * 记账器：把"抽到了什么"和"摆进去没有"分开。
 * ⚠️ 形状摆不下的大件往往又是高稀有度 —— 不分开记的话，这个**形状副作用**
 *    会被卡方检验误报成"轮盘不准"（见 C 端 loot-sim 的同名注释）。
 */
export interface LayoutTally { attempts: number; byRarity: Record<string, number> }

export function generateLayout(input: {
  def: ContainerDef
  table: TableDef | undefined
  byId: Map<string, ItemDef>
  rng: () => number
  order: string[]
  tierBoost?: number
  forceRarity?: Rarity | null
  cols: number
  rows: number
  tally?: LayoutTally
}): PlacedItem[] {
  const { def, table, byId, rng, order, tierBoost = 0, forceRarity = null, cols, rows, tally } = input
  const grid = newGrid(cols, rows)
  const out: PlacedItem[] = []
  const fill = Math.min(1, Math.max(0, Number(def.fillRate) || 0))
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y * cols + x]) continue
      const forced = out.length === 0 && !!forceRarity
      if (!forced && rng() > fill) continue
      let item: ItemDef | null = null
      if (forced) item = pickAtLeast(table?.pool ?? [], forceRarity as string, byId, rng, order)
      else {
        const r = resolveRarity(def.rarityWeights, table, byId, rng, order, tierBoost)
        if (r) item = rollItem(table?.pool ?? [], r, byId, rng)
      }
      if (!item) continue
      if (tally) {
        tally.attempts++
        tally.byRarity[item.rarity] = (tally.byRarity[item.rarity] || 0) + 1
      }
      const place = findPlacement(item.shape, cols, rows, grid)
      if (!place) continue
      for (const [cx, cy] of place.cells) grid[cy * cols + cx] = true
      out.push({ itemId: item.id, x: place.x, y: place.y, rot: place.rot, cells: place.cells })
    }
  }
  return out
}

// ---------------- 保底计数 ----------------

export function pendingPity(state: PityState, ctn: ContainerDef): Rarity | null {
  const p = ctn.pity
  if (!p) return null
  return (state[ctn.id] || 0) >= p.afterRuns ? p.minRarity : null
}

/** 与 C 端 applyPity 同语义：到顶**停在顶**（不清零），被消费（forced）才归零 */
export function applyPity(
  state: PityState, ctn: ContainerDef, maxRarity: Rarity | null, forced = false, order: string[] = [],
): { state: PityState; force: Rarity | null } {
  const p = ctn.pity
  if (!p) return { state, force: null }
  const cur = state[ctn.id] || 0
  if (forced) return { state: { ...state, [ctn.id]: 0 }, force: null }
  const met = maxRarity != null && order.indexOf(maxRarity) >= order.indexOf(p.minRarity)
  if (met) {
    if (cur === 0) return { state, force: null }
    return { state: { ...state, [ctn.id]: 0 }, force: null }
  }
  const next = Math.min(cur + 1, p.afterRuns)
  const ns = { ...state, [ctn.id]: next }
  return { state: ns, force: next >= p.afterRuns ? p.minRarity : null }
}

// ---------------- 卡方 ----------------

function lnGamma(x: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000000190015
  for (let j = 0; j < 6; j++) ser += g[j] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function gammaQ(s: number, x: number): number {
  const FPMIN = 1e-300
  if (x < 0 || s <= 0) return NaN
  if (x === 0) return 1
  if (x < s + 1) {
    let ap = s, sum = 1 / s, del = sum
    for (let n = 1; n < 500; n++) {
      ap++
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(-x + s * Math.log(x) - lnGamma(s))
  }
  let b = x + 1 - s, c = 1 / FPMIN, d = 1 / b, h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s)
    b += 2
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(-x + s * Math.log(x) - lnGamma(s)) * h
}

export function chi2P(chi2: number, df: number): number {
  if (df <= 0 || !(chi2 > 0)) return 1
  return gammaQ(df / 2, chi2 / 2)
}

// ---------------- 报告 ----------------

export interface RarityShare { rarity: Rarity; expected: number; observed: number; hits: number; delta: number }
export interface PityReport {
  containerId: string; name: string; afterRuns: number; minRarity: Rarity
  coveredCount: number; triggers: number; forcedOk: number; forcedFail: number
}
export interface SimReport {
  mapId: string; mapName: string; runs: number; gate: number
  /** 背包总格数（cols×rows） */
  bagCells: number
  /** 地图期望总格数 */
  totalCells: number
  rolls: number
  share: RarityShare[]
  chi2: number; df: number; p: number; maxDelta: number
  avgGrossAll: number; avgKept: number; avgPayout: number
  avgContainers: number; avgRisk: number; avgDiscarded: number; avgCells: number
  ratioExtract: number; ratioWithRate: number
  pity: PityReport[]
  issues: string[]
}

export interface SimDoc {
  rarities?: RarityDef[]
  containers: ContainerDef[]; tables: TableDef[]; items: ItemDef[]; maps: MapDef[]; balance: Balance
}

// ---------------- 主模拟 ----------------

interface Inst { def: ContainerDef; table: TableDef | undefined; evPerCell: number }

/** 单格期望值：复用 model.slotEv（解析式），只用来给容器排序 */
function cellEvOf(
  ctn: ContainerDef, table: TableDef | undefined, items: ItemDef[], order: string[], tierBoost = 0,
): number {
  if (!table || !table.pool.length) return 0
  const byId = new Map(items.map((i) => [i.id, i]))
  const boosted: Record<string, number> = { ...ctn.rarityWeights }
  if (tierBoost > 0) {
    for (let i = 2; i < order.length; i++) boosted[order[i]] = (boosted[order[i]] || 0) * (1 + tierBoost)
  }
  const total = order.reduce((s, r) => s + Math.max(0, boosted[r] || 0), 0)
  if (total <= 0) return 0
  let evValue = 0
  let evCells = 0
  for (const r of order) {
    const share = Math.max(0, boosted[r] || 0) / total
    if (share <= 0) continue
    const cands = table.pool.filter((p) => byId.get(p.itemId)?.rarity === r && (p.weight || 0) > 0)
    if (!cands.length) continue
    const wsum = cands.reduce((s, p) => s + p.weight, 0)
    evValue += share * (cands.reduce((s, p) => s + p.weight * (byId.get(p.itemId)?.baseValue || 0), 0) / wsum)
    evCells += share * Math.max(1, cands.reduce((s, p) => s + p.weight * shapeSize(byId.get(p.itemId)?.shape), 0) / wsum)
  }
  if (evCells <= 0) return 0
  return (Math.min(1, Math.max(0, Number(ctn.fillRate) || 0)) * evValue) / evCells
}

/** 网格尺寸随机 → 期望格数取区间中点 */
function avgCells(c: ContainerDef): number {
  const cols = (Math.max(1, c.colsMin) + Math.max(c.colsMin, c.colsMax)) / 2
  const rows = (Math.max(1, c.rowsMin) + Math.max(c.rowsMin, c.rowsMax)) / 2
  return Math.max(1, cols * rows)
}

export function simulateMap(doc: SimDoc, map: MapDef, opts: { runs?: number; seed?: number } = {}): SimReport {
  const runs = Math.max(1, Math.floor(opts.runs ?? 10_000))
  const baseSeed = (opts.seed ?? seedFromString(`loot-sim:${map.id}`)) >>> 0
  const order = rarityOrder(doc)
  const byId = new Map(doc.items.map((i) => [i.id, i]))
  const balance = doc.balance
  const bagCols = Math.max(1, Math.floor(balance.backpackCols))
  const bagRows = Math.max(1, Math.floor(balance.backpackRows))
  const bagCells = bagCols * bagRows
  const limit = Math.max(1, Math.floor(map.riskLimit))
  const budgetMs = Math.max(1000, map.timeLimitSec * 1000)

  const insts: Inst[] = []
  for (const mc of map.containers) {
    const def = doc.containers.find((c) => c.id === mc.containerId)
    if (!def) continue
    const table = doc.tables.find((t) => t.id === def.tableId)
    const ev = cellEvOf(def, table, doc.items, order, map.tierBoost)
    const n = Math.max(0, Math.floor(mc.count))
    for (let i = 0; i < n; i++) insts.push({ def, table, evPerCell: ev })
  }
  const totalCells = insts.reduce((s, x) => s + avgCells(x.def), 0)

  // 分布记账：按「容器定义」聚合（同一容器在地图里出现多次也共用一个计数器）
  const tallyBy = new Map<string, LayoutTally>()
  const tallyOf = (id: string): LayoutTally => {
    let t = tallyBy.get(id)
    if (!t) { t = { attempts: 0, byRarity: {} }; tallyBy.set(id, t) }
    return t
  }

  const pityState: PityState = {}
  const pityAgg = new Map<string, PityReport>()
  for (const x of insts) {
    const p = x.def.pity
    if (!p || pityAgg.has(x.def.id)) continue
    const tbl = doc.tables.find((t) => t.id === x.def.tableId)
    const from = order.indexOf(p.minRarity)
    const coveredCount = (tbl?.pool ?? []).filter((e) => {
      const it = byId.get(e.itemId)
      return !!it && order.indexOf(it.rarity) >= from
    }).length
    pityAgg.set(x.def.id, {
      containerId: x.def.id, name: x.def.name, afterRuns: p.afterRuns, minRarity: p.minRarity,
      coveredCount, triggers: 0, forcedOk: 0, forcedFail: 0,
    })
  }

  const policyOrder = [...insts].sort((a, b) => b.evPerCell - a.evPerCell)
  // 与 C 端 loot-engine 的取整口径逐位一致（跨端对拍要能对上，别一边 round 一边不 round）
  const disp = (it: ItemDef) => Math.round(it.baseValue * map.valueMult)
  const rec = (it: ItemDef) => it.recycleValue != null
    ? Math.round(it.recycleValue * map.valueMult)
    : Math.round(it.baseValue * map.valueMult * balance.recycleRate)

  let rolls = 0, sumGrossAll = 0, sumKept = 0, sumPayout = 0
  let sumCtn = 0, sumRisk = 0, sumDiscard = 0, sumCells = 0

  for (let run = 0; run < runs; run++) {
    const rngDist = mulberry32((baseSeed + Math.imul(run + 1, 0x9E3779B1)) >>> 0)
    const rngPlay = mulberry32((baseSeed ^ Math.imul(run + 1, 0x85EBCA77)) >>> 0)

    // ① 全清抽样（不带保底：测的是轮盘本身）
    for (const x of policyOrder) {
      const { cols, rows } = rollGrid(x.def, rngDist)
      const layout = generateLayout({
        def: x.def, table: x.table, byId, rng: rngDist, order,
        tierBoost: map.tierBoost, cols, rows, tally: tallyOf(x.def.id),
      })
      for (const p of layout) {
        const it = byId.get(p.itemId)
        if (it) sumGrossAll += disp(it)
      }
    }

    // ② 政策模拟（带保底 / 背包网格 / 风险上限 / 时限）
    const grid = newGrid(bagCols, bagRows)
    let risk = 0, kept = 0, payout = 0, opened = 0, usedMs = 0, discarded = 0, touched = 0, filled = 0
    for (const x of policyOrder) {
      if (filled >= bagCells) break
      const { cols, rows } = rollGrid(x.def, rngPlay)
      const cells = cols * rows
      if (usedMs + cells * x.def.slotMs > budgetMs) continue
      if (risk + x.def.riskCost > limit) continue

      const p = x.def.pity
      const force = pendingPity(pityState, x.def)
      const agg = p ? pityAgg.get(x.def.id) : undefined
      if (force && agg) agg.triggers++

      const layout = generateLayout({
        def: x.def, table: x.table, byId, rng: rngPlay, order,
        tierBoost: map.tierBoost, forceRarity: force, cols, rows,
      })
      risk += x.def.riskCost
      opened++
      usedMs += cells * x.def.slotMs
      touched += cells

      if (force && agg) {
        const first = layout.length ? byId.get(layout[0].itemId) : undefined
        if (first) {
          agg.forcedOk++
          if (order.indexOf(first.rarity) < order.indexOf(p!.minRarity) && agg.coveredCount === 0) agg.coveredCount = -1
        } else agg.forcedFail++
      }

      for (const pl of layout) {
        const it = byId.get(pl.itemId)
        if (!it) continue
        const place = findPlacement(it.shape, bagCols, bagRows, grid)
        if (!place) { discarded++; continue }
        const add = balance.riskPerSlot * Math.max(1, place.cells.length)
        if (balance.riskPerSlot > 0 && risk + add > limit) break
        for (const [cx, cy] of place.cells) grid[cy * bagCols + cx] = true
        filled += place.cells.length
        risk += add
        kept += disp(it)
        payout += rec(it)
      }

      let maxIdx = -1
      for (const pl of layout) {
        const it = byId.get(pl.itemId)
        if (it) maxIdx = Math.max(maxIdx, order.indexOf(it.rarity))
      }
      if (p) pityState[x.def.id] = applyPity(pityState, x.def, maxIdx >= 0 ? order[maxIdx] : null, force != null, order).state[x.def.id] ?? 0
      if (usedMs >= budgetMs) break
    }
    sumKept += kept; sumPayout += payout; sumCtn += opened
    sumRisk += risk; sumDiscard += discarded; sumCells += touched
  }

  // ---- 期望频率：按**实际抽取次数**（tally.attempts）加权，实测也取自 tally（含摆不下的）----
  const uniq = new Map<string, Inst>()
  for (const x of insts) if (!uniq.has(x.def.id)) uniq.set(x.def.id, x)
  const hits = ZERO(order)
  const expShare = ZERO(order)
  let totalAttempts = 0
  for (const t of tallyBy.values()) totalAttempts += t.attempts
  rolls = totalAttempts
  for (const t of tallyBy.values()) for (const r of order) hits[r] = (hits[r] || 0) + (t.byRarity[r] || 0)
  if (totalAttempts > 0) {
    for (const x of uniq.values()) {
      const n = tallyBy.get(x.def.id)?.attempts ?? 0
      if (n <= 0) continue
      const w = n / totalAttempts
      const boosted: Record<string, number> = { ...x.def.rarityWeights }
      if (map.tierBoost > 0) {
        for (let i = 2; i < order.length; i++) boosted[order[i]] = (boosted[order[i]] || 0) * (1 + map.tierBoost)
      }
      const tot = order.reduce((s, r) => s + Math.max(0, boosted[r] || 0), 0)
      if (tot <= 0) continue
      for (const r of order) expShare[r] = (expShare[r] || 0) + w * (Math.max(0, boosted[r] || 0) / tot)
    }
  }

  const share: RarityShare[] = order.map((r) => {
    const observed = rolls > 0 ? (hits[r] || 0) / rolls : 0
    return { rarity: r, expected: expShare[r] || 0, observed, hits: hits[r] || 0, delta: Math.abs(observed - (expShare[r] || 0)) }
  })
  let chi2 = 0
  for (const s of share) {
    const e = s.expected * rolls
    if (e <= 0) continue
    chi2 += ((s.hits - e) * (s.hits - e)) / e
  }
  const df = share.filter((s) => s.expected * rolls > 0).length - 1
  const p = chi2P(chi2, df)

  const gate = Math.max(1, map.entry.coins || 0)
  const avgPayout = sumPayout / runs
  const ratioExtract = avgPayout / gate
  const ratioWithRate = (avgPayout * balance.extractRate) / gate
  const pity = [...pityAgg.values()]

  return {
    mapId: map.id, mapName: map.name, runs, gate, bagCells, totalCells: Math.round(totalCells), rolls, share,
    chi2, df, p, maxDelta: share.reduce((m, s) => Math.max(m, s.delta), 0),
    avgGrossAll: sumGrossAll / runs, avgKept: sumKept / runs, avgPayout,
    avgContainers: sumCtn / runs, avgRisk: sumRisk / runs, avgDiscarded: sumDiscard / runs, avgCells: sumCells / runs,
    ratioExtract, ratioWithRate, pity,
    issues: collectIssues({ doc, map, insts, order, byId, totalCells, bagCells, limit, balance, share, ratioWithRate, pity, p }),
  }
}

function collectIssues(a: {
  doc: SimDoc; map: MapDef; insts: Inst[]; order: string[]; byId: Map<string, ItemDef>
  totalCells: number; bagCells: number; limit: number; balance: Balance
  share: RarityShare[]; ratioWithRate: number; pity: PityReport[]; p: number
}): string[] {
  const { doc, map, insts, order, byId, totalCells, bagCells, limit, balance, ratioWithRate, pity, p } = a
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of insts) {
    if (seen.has(x.def.id)) continue
    seen.add(x.def.id)
    if (!x.table || x.table.pool.length === 0) { out.push(`容器「${x.def.name}」的掉落表为空 → 每格都会空手`); continue }
    const missing = order.filter((r) => (x.def.rarityWeights[r] || 0) > 0
      && !x.table!.pool.some((e) => byId.get(e.itemId)?.rarity === r))
    if (missing.length) out.push(`容器「${x.def.name}」的掉落表里没有 ${missing.join("/")} 候选 → 抽到这些档会降档（分布检验失真）`)
  }
  for (const pr of pity) {
    if (pr.coveredCount === 0) out.push(`容器「${pr.name}」的保底要求 ${pr.minRarity}，但掉落表里没有该档及以上候选 → 保底只能退到更低档`)
    if (pr.coveredCount === -1) out.push(`容器「${pr.name}」保底触发时退档兜底（补一个 ${pr.minRarity} 候选即可）`)
    if (pr.coveredCount > 0 && pr.triggers === 0) out.push(`容器「${pr.name}」配了保底但 ${map.name} 里一次都没触发（容器数太少或概率太高）`)
  }
  if (bagCells < totalCells) out.push(`背包 ${bagCells} 格 < 地图期望 ${Math.round(totalCells)} 格 → 有一部分永远带不走`)
  const riskFor = insts.reduce((s, x) => s + x.def.riskCost, 0) + bagCells * balance.riskPerSlot
  if (limit < riskFor) out.push(`风险上限 ${limit} < 吃满背包约需 ${riskFor} → 风险先于背包成为瓶颈（设计选择，不是错误）`)
  if (ratioWithRate > balance.evRejectRatio) out.push(`EV 倍率 ${ratioWithRate.toFixed(2)}× 超过拒绝阈值 ${balance.evRejectRatio}× → 经济过厚`)
  else if (ratioWithRate > balance.evWarnRatio) out.push(`EV 倍率 ${ratioWithRate.toFixed(2)}× 超过警告阈值 ${balance.evWarnRatio}×（设计目标 [1.5, 3.5]）`)
  else if (ratioWithRate < 1.5) out.push(`EV 倍率 ${ratioWithRate.toFixed(2)}× 低于设计下限 1.5× → 打这张图不划算`)
  if (p <= 0.05) out.push(`卡方 p = ${p.toFixed(4)} ≤ 0.05：实测分布与配置权重显著不符（先看上面有没有"降档"类问题）`)
  void doc
  return out
}

/** 跨端对拍用：同 seed 抽 N 次，返回物品指纹序列（C 端 rollFingerprint 必须给出同一串） */
export function rollFingerprint(
  doc: SimDoc, mapId: string, containerId: string, draws: number, seed = 12345,
): string[] {
  const def = doc.containers.find((c) => c.id === containerId)
  const byId = new Map(doc.items.map((i) => [i.id, i]))
  const order = rarityOrder(doc)
  if (!def) throw new Error(`容器 ${containerId} 不存在`)
  const table = doc.tables.find((t) => t.id === def.tableId)
  const map = doc.maps.find((m) => m.id === mapId)
  const rng = mulberry32(seed)
  const out: string[] = []
  for (let i = 0; i < draws; i++) {
    const { cols, rows } = rollGrid(def, rng)
    const layout = generateLayout({
      def, table, byId, rng, order, tierBoost: map?.tierBoost ?? 0, cols, rows,
    })
    out.push(layout.map((p) => {
      const it = byId.get(p.itemId)
      return it ? `${it.id}:${it.rarity}:${p.cells.length}@${p.x},${p.y}r${p.rot}` : "null"
    }).join("|"))
  }
  return out
}
