// 摸金行动 · B 端平衡模拟器（balance 页「跑 N 局」按钮用）
//
// ⚠️ 本文件是 **notelab-c/lib/loot-engine.ts + loot-sim.ts 的同构端口**。
//    两个仓（notelab-b / notelab-c）不能互相 import，所以只能有两份实现 ——
//    代价是"改一边忘另一边"会悄悄漂移。兜法是 `loot-w3` 验收里的跨端指纹断言：
//    同 seed + 同配置下，B 端与本文件 vs C 端引擎抽出的物品序列必须**逐位一致**。
//    **改这里必须同步改 notelab-c/lib/loot-engine.ts，并重跑跨端对拍。**
//
// 与 model.ts 的分工：model 负责"净化 + 解析 EV"（确定性公式），本文件负责"抽样"（蒙特卡洛）。
// 单格期望值不在这里重写，直接复用 model.slotEv，避免同一个公式两种写法。
//
// ⚠️ LLM 依赖：无。

import {
  RARITIES, slotEv,
  type Balance, type ContainerDef, type ItemDef, type MapDef, type PoolEntry, type TableDef, type Rarity,
} from "./model"

type PityState = Record<string, number>
const ZERO = (): Record<Rarity, number> => ({ common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 })

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

// ---------------- 抽取 ----------------

export function rollRarity(w: Record<Rarity, number>, rng: () => number, tierBoost = 0): Rarity {
  const boosted: Record<Rarity, number> = { ...w }
  if (tierBoost > 0) {
    for (const r of RARITIES) {
      if (r === "common" || r === "uncommon") continue
      boosted[r] = (boosted[r] || 0) * (1 + tierBoost)
    }
  }
  const total = RARITIES.reduce((s, r) => s + Math.max(0, boosted[r] || 0), 0)
  if (total <= 0) return "common"
  let x = rng() * total
  for (const r of RARITIES) { x -= Math.max(0, boosted[r] || 0); if (x < 0) return r }
  return "common"
}

export function resolveRarity(
  w: Record<Rarity, number>, table: TableDef | undefined, byId: Map<string, ItemDef>,
  rng: () => number, tierBoost = 0,
): Rarity | null {
  if (!table || table.pool.length === 0) return null
  const drawn = rollRarity(w, rng, tierBoost)
  const has = (r: Rarity) => table.pool.some((p) => byId.get(p.itemId)?.rarity === r)
  if (has(drawn)) return drawn
  const idx = RARITIES.indexOf(drawn)
  for (let i = idx; i >= 0; i--) if (has(RARITIES[i])) return RARITIES[i]
  for (let i = idx + 1; i < RARITIES.length; i++) if (has(RARITIES[i])) return RARITIES[i]
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
export function pickAtLeast(pool: PoolEntry[], minRarity: Rarity, byId: Map<string, ItemDef>, rng: () => number): ItemDef | null {
  const from = Math.max(0, RARITIES.indexOf(minRarity))
  for (let i = from; i < RARITIES.length; i++) {
    const it = rollItem(pool, RARITIES[i], byId, rng)
    if (it) return it
  }
  for (let i = from - 1; i >= 0; i--) {
    const it = rollItem(pool, RARITIES[i], byId, rng)
    if (it) return it
  }
  return null
}

export interface SearchResult { picks: (ItemDef | null)[]; maxRarity: Rarity | null }

export function searchContainer(input: {
  container: ContainerDef; table: TableDef | undefined; byId: Map<string, ItemDef>
  rng: () => number; tierBoost?: number; forceRarity?: Rarity | null
}): SearchResult {
  const { container, table, byId, rng, tierBoost = 0, forceRarity = null } = input
  const picks: (ItemDef | null)[] = []
  let maxIdx = -1
  const n = Math.max(1, container.slots)
  for (let i = 0; i < n; i++) {
    let pick: ItemDef | null = null
    if (i === 0 && forceRarity) pick = pickAtLeast(table?.pool ?? [], forceRarity, byId, rng)
    else {
      const r = resolveRarity(container.rarityWeights, table, byId, rng, tierBoost)
      pick = r ? rollItem(table?.pool ?? [], r, byId, rng) : null
    }
    if (pick) maxIdx = Math.max(maxIdx, RARITIES.indexOf(pick.rarity))
    picks.push(pick)
  }
  return { picks, maxRarity: maxIdx >= 0 ? RARITIES[maxIdx] : null }
}

// ---------------- 保底计数 ----------------

export function pendingPity(state: PityState, ctn: ContainerDef): Rarity | null {
  const p = ctn.pity
  if (!p) return null
  return (state[ctn.id] || 0) >= p.afterRuns ? p.minRarity : null
}

/** 与 C 端 applyPity 同语义：到顶**停在顶**（不清零），被消费（forced）才归零 */
export function applyPity(
  state: PityState, ctn: ContainerDef, maxRarity: Rarity | null, forced = false,
): { state: PityState; force: Rarity | null } {
  const p = ctn.pity
  if (!p) return { state, force: null }
  const cur = state[ctn.id] || 0
  if (forced) return { state: { ...state, [ctn.id]: 0 }, force: null }
  const met = maxRarity != null && RARITIES.indexOf(maxRarity) >= RARITIES.indexOf(p.minRarity)
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
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += g[j] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function gammaQ(s: number, x: number): number {
  if (!(x >= 0) || s <= 0) return NaN
  if (x === 0) return 1
  const FPMIN = 1e-300
  if (x < s + 1) {
    let ap = s, sum = 1 / s, del = sum
    for (let n = 1; n < 500; n++) {
      ap++; del *= x / ap; sum += del
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
  mapId: string; mapName: string; runs: number; gate: number; cap: number
  totalSlots: number; rolls: number
  share: RarityShare[]
  chi2: number; df: number; p: number; maxDelta: number
  avgGrossAll: number; avgKept: number; avgPayout: number
  avgContainers: number; avgRisk: number; avgDiscarded: number; avgSlots: number
  ratioExtract: number; ratioWithRate: number
  pity: PityReport[]
  issues: string[]
}

export interface SimDoc {
  containers: ContainerDef[]; tables: TableDef[]; items: ItemDef[]; maps: MapDef[]; balance: Balance
}

export function simulateMap(doc: SimDoc, map: MapDef, opts: { runs?: number; seed?: number } = {}): SimReport {
  const runs = Math.max(1, Math.floor(opts.runs ?? 10_000))
  const baseSeed = (opts.seed ?? seedFromString(`loot-sim:${map.id}`)) >>> 0
  const byId = new Map(doc.items.map((i) => [i.id, i]))
  const balance = doc.balance
  const cap = Math.max(1, Math.floor(balance.backpackCap))
  const limit = Math.max(1, Math.floor(map.riskLimit))
  const budgetMs = Math.max(1000, map.timeLimitSec * 1000)

  const insts: { def: ContainerDef; table: TableDef | undefined; evPerSlot: number }[] = []
  for (const mc of map.containers) {
    const def = doc.containers.find((c) => c.id === mc.containerId)
    if (!def) continue
    const table = doc.tables.find((t) => t.id === def.tableId)
    const ev = slotEv(def, table, doc.items, map.tierBoost)
    const n = Math.max(0, Math.floor(mc.count))
    for (let i = 0; i < n; i++) insts.push({ def, table, evPerSlot: ev })
  }
  const totalSlots = insts.reduce((s, x) => s + Math.max(1, x.def.slots), 0)

  const expShare = ZERO()
  let denom = 0
  for (const x of insts) {
    const slots = Math.max(1, x.def.slots)
    denom += slots
    const boosted: Record<Rarity, number> = { ...x.def.rarityWeights }
    if (map.tierBoost > 0) {
      for (const r of RARITIES) {
        if (r === "common" || r === "uncommon") continue
        boosted[r] = (boosted[r] || 0) * (1 + map.tierBoost)
      }
    }
    const tot = RARITIES.reduce((s, r) => s + Math.max(0, boosted[r] || 0), 0)
    if (tot <= 0) continue
    for (const r of RARITIES) expShare[r] += (Math.max(0, boosted[r] || 0) / tot) * slots
  }
  if (denom > 0) for (const r of RARITIES) expShare[r] /= denom

  const hits = ZERO()
  const pityState: PityState = {}
  const pityAgg = new Map<string, PityReport>()
  for (const x of insts) {
    const p = x.def.pity
    if (!p || pityAgg.has(x.def.id)) continue
    const tbl = doc.tables.find((t) => t.id === x.def.tableId)
    const from = RARITIES.indexOf(p.minRarity)
    const coveredCount = (tbl?.pool ?? []).filter((e) => {
      const it = byId.get(e.itemId)
      return !!it && RARITIES.indexOf(it.rarity) >= from
    }).length
    pityAgg.set(x.def.id, {
      containerId: x.def.id, name: x.def.name, afterRuns: p.afterRuns, minRarity: p.minRarity,
      coveredCount, triggers: 0, forcedOk: 0, forcedFail: 0,
    })
  }

  const order = [...insts].sort((a, b) => b.evPerSlot - a.evPerSlot)
  // 与 C 端 loot-engine 的取整口径逐位一致（跨端对拍要能对上，别一边 round 一边不 round）
  const disp = (it: ItemDef) => Math.round(it.baseValue * map.valueMult)
  const rec = (it: ItemDef) => it.recycleValue != null
    ? Math.round(it.recycleValue * map.valueMult)
    : Math.round(it.baseValue * map.valueMult * balance.recycleRate)
  let rolls = 0, sumGrossAll = 0, sumKept = 0, sumPayout = 0
  let sumCtn = 0, sumRisk = 0, sumDiscard = 0, sumSlots = 0

  for (let run = 0; run < runs; run++) {
    const rngDist = mulberry32((baseSeed + Math.imul(run + 1, 0x9E3779B1)) >>> 0)
    const rngPlay = mulberry32((baseSeed ^ Math.imul(run + 1, 0x85EBCA77)) >>> 0)

    for (const x of order) {
      const res = searchContainer({ container: x.def, table: x.table, byId, rng: rngDist, tierBoost: map.tierBoost })
      for (const p of res.picks) {
        if (!p) continue
        hits[p.rarity]++; rolls++
        sumGrossAll += disp(p)
      }
    }

    let bag = 0, risk = 0, kept = 0, payout = 0, opened = 0, usedMs = 0, discarded = 0, touched = 0
    for (const x of order) {
      if (bag >= cap) break
      const slots = Math.max(1, x.def.slots)
      if (usedMs + slots * x.def.slotMs > budgetMs) continue
      if (risk + x.def.riskCost > limit) continue
      const p = x.def.pity
      const force = pendingPity(pityState, x.def)
      const agg = p ? pityAgg.get(x.def.id) : undefined
      if (force && agg) agg.triggers++
      const res = searchContainer({
        container: x.def, table: x.table, byId, rng: rngPlay, tierBoost: map.tierBoost, forceRarity: force,
      })
      risk += x.def.riskCost
      opened++
      usedMs += slots * x.def.slotMs
      if (force && agg) {
        const first = res.picks[0]
        if (first) {
          agg.forcedOk++
          if (RARITIES.indexOf(first.rarity) < RARITIES.indexOf(p!.minRarity) && agg.coveredCount === 0) agg.coveredCount = -1
        } else agg.forcedFail++
      }
      for (const it of res.picks) {
        touched++
        if (!it) continue
        if (bag >= cap) { discarded++; continue }
        if (balance.riskPerSlot > 0 && risk + balance.riskPerSlot > limit) break
        bag++
        risk += balance.riskPerSlot
        kept += disp(it)
        payout += rec(it)
      }
      if (p) pityState[x.def.id] = applyPity(pityState, x.def, res.maxRarity, force != null).state[x.def.id] ?? 0
      if (usedMs >= budgetMs) break
    }
    sumKept += kept; sumPayout += payout; sumCtn += opened
    sumRisk += risk; sumDiscard += discarded; sumSlots += touched
  }

  const share: RarityShare[] = RARITIES.map((r) => {
    const observed = rolls > 0 ? hits[r] / rolls : 0
    return { rarity: r, expected: expShare[r], observed, hits: hits[r], delta: Math.abs(observed - expShare[r]) }
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

  return {
    mapId: map.id, mapName: map.name, runs, gate, cap, totalSlots, rolls, share,
    chi2, df, p, maxDelta: share.reduce((m, s) => Math.max(m, s.delta), 0),
    avgGrossAll: sumGrossAll / runs, avgKept: sumKept / runs, avgPayout,
    avgContainers: sumCtn / runs, avgRisk: sumRisk / runs, avgDiscarded: sumDiscard / runs, avgSlots: sumSlots / runs,
    ratioExtract: avgPayout / gate,
    ratioWithRate: (avgPayout * balance.extractRate) / gate,
    pity: [...pityAgg.values()],
    issues: [],
  }
}

/** 跨端对拍用：同 seed 抽 N 次，返回物品指纹序列（C 端 rollFingerprint 必须给出同一串） */
export function rollFingerprint(
  doc: SimDoc, mapId: string, containerId: string, draws: number, seed = 12345,
): string[] {
  const def = doc.containers.find((c) => c.id === containerId)
  const byId = new Map(doc.items.map((i) => [i.id, i]))
  if (!def) throw new Error(`容器 ${containerId} 不存在`)
  const table = doc.tables.find((t) => t.id === def.tableId)
  const map = doc.maps.find((m) => m.id === mapId)
  const rng = mulberry32(seed)
  const out: string[] = []
  for (let i = 0; i < draws; i++) {
    const res = searchContainer({ container: def, table, byId, rng, tierBoost: map?.tierBoost ?? 0 })
    out.push(res.picks.map((p) => (p ? `${p.id}:${p.rarity}` : "null")).join("|"))
  }
  return out
}
