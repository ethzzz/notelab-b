// 爬塔地图生成器（B 端）
//
// ⚠️ 这是 C 端 notelab-c/lib/spire-engine.ts 里 generateMap 的**移植版**，语义必须保持一致，
//    否则「B 端预览的图」和「C 端回落到本地生成时的图」会长得不一样。移植时保留了三处刻意选择：
//      1) 连边用「互不重叠且递增的连续块」构造 —— 从构造上同时保证不交叉 / 无死路 / 全覆盖，
//         不依赖"生成完再修"；
//      2) 抖动斜边的候选区间被前后两端夹住，且必须**从后往前**推进，否则会造出交叉；
//      3) 开局两层只允许普通/未揭示；BOSS 前一整层强制补给。这三行是定死的，冲突时不能拿它们重 roll。
//    与 C 端的**唯一**差异：这里用带种子的 PRNG（可复现），C 端用 Math.random()。
//    因此本项目里 B 端生成是"作者端出成品"，C 端生成只在**没有已发布地图**时兜底。
//
// 参数语义与 public/spire/map-gen.config.json 一致（B 端仓库没有那份 JSON，故把默认值内联在此，
// 由「地图生成」页的表单覆盖；界面上的默认值就是这里导出的一份）。

export type NodeType = "enemy" | "elite" | "boss" | "rest" | "shop" | "event" | "random"

/** 参与权重 roll 的类型（boss 由末层固定放置，不参与） */
export type RollType = Exclude<NodeType, "boss">

export interface MapNode {
  id: string
  row: number
  col: number
  type: NodeType
  /** 指向下一层节点 id；末层为空数组 */
  next: string[]
}

export interface ActMap {
  act: number
  layers: number
  nodes: MapNode[]
}

export interface MapGenParams {
  /** 每幕层数 */
  layers: number
  /** 幕数（本项目 3） */
  acts: number
  /** 层内最大列数（纺锤最宽处） */
  maxColumns: number
  /** 并行主干条数区间 [lo, hi]，决定纺锤最宽处宽度，再被 maxColumns 夹住 */
  pathCount: [number, number]
  /** 各类型权重（相对值，按总和归一化） */
  weights: Record<RollType, number>
  /** 各类型最早可出现的层（0-based） */
  minLayer: Record<RollType, number>
  /** 未揭示节点的揭示池权重（不含 random 自身） */
  revealPool: Record<"normal" | "elite" | "shop" | "rest", number>
  /** 开局安全层数：这些层只允许普通/未揭示 */
  earlySafeLayers: number
}

/** 默认参数 = C 端 map-gen.config.json 的现值（event 权重 12 是项目扩展，配置原版没有） */
export const DEFAULT_PARAMS: MapGenParams = {
  layers: 16,
  acts: 3,
  maxColumns: 4,
  pathCount: [4, 6],
  weights: { enemy: 45, elite: 15, shop: 12, rest: 10, random: 18, event: 12 },
  minLayer: { enemy: 0, elite: 3, shop: 2, rest: 2, random: 0, event: 2 },
  revealPool: { normal: 45, elite: 15, shop: 12, rest: 10 },
  earlySafeLayers: 2,
}

/** 类型中文名（预览图例与校验报错用） */
export const TYPE_LABEL: Record<NodeType, string> = {
  enemy: "普通敌人", elite: "精英敌人", boss: "BOSS", rest: "补给营地",
  shop: "商店", event: "未知事件", random: "未知",
}

/** 参数字段的可调范围（表单与净化共用，避免两处各写一套边界） */
export const LIMITS = {
  layers: [4, 40] as [number, number],
  acts: [1, 8] as [number, number],
  maxColumns: [2, 8] as [number, number],
  pathCount: [1, 8] as [number, number],
  weight: [0, 999] as [number, number],
  minLayer: [0, 40] as [number, number],
}

/** mulberry32：小而稳的带种子 PRNG，让「换个种子重生成」可复现 */
function mulberry32(seed: number) {
  let a = (seed >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clampInt = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return def
  return Math.max(lo, Math.min(hi, n))
}

/** 净化外部传入的参数（表单/存档/导入都可能塞脏值），越界一律夹到 LIMITS */
export function sanitizeParams(raw: any): MapGenParams {
  const d = DEFAULT_PARAMS
  if (!raw || typeof raw !== "object") return { ...d }
  const w = (k: RollType) => clampInt(raw.weights?.[k], LIMITS.weight[0], LIMITS.weight[1], d.weights[k])
  const m = (k: RollType) => clampInt(raw.minLayer?.[k], LIMITS.minLayer[0], LIMITS.minLayer[1], d.minLayer[k])
  const pc = Array.isArray(raw.pathCount) ? raw.pathCount : d.pathCount
  return {
    layers: clampInt(raw.layers, LIMITS.layers[0], LIMITS.layers[1], d.layers),
    acts: clampInt(raw.acts, LIMITS.acts[0], LIMITS.acts[1], d.acts),
    maxColumns: clampInt(raw.maxColumns, LIMITS.maxColumns[0], LIMITS.maxColumns[1], d.maxColumns),
    pathCount: [
      clampInt(pc[0], LIMITS.pathCount[0], LIMITS.pathCount[1], d.pathCount[0]),
      clampInt(pc[1], LIMITS.pathCount[0], LIMITS.pathCount[1], d.pathCount[1]),
    ],
    weights: {
      enemy: w("enemy"), elite: w("elite"), shop: w("shop"),
      rest: w("rest"), random: w("random"), event: w("event"),
    },
    minLayer: {
      enemy: m("enemy"), elite: m("elite"), shop: m("shop"),
      rest: m("rest"), random: m("random"), event: m("event"),
    },
    // 揭示池：与权重同量纲，但语义是"未揭示节点揭示成什么"，单独一组
    revealPool: {
      normal: clampInt(raw.revealPool?.normal, 0, 999, d.revealPool.normal),
      elite: clampInt(raw.revealPool?.elite, 0, 999, d.revealPool.elite),
      shop: clampInt(raw.revealPool?.shop, 0, 999, d.revealPool.shop),
      rest: clampInt(raw.revealPool?.rest, 0, 999, d.revealPool.rest),
    },
    earlySafeLayers: clampInt(raw.earlySafeLayers, 0, 8, d.earlySafeLayers),
  }
}

/** 生成一幕地图。同一个 (params, act, seed) 必然得到同一张图 */
export function generateAct(params: MapGenParams, act: number, seed: number): ActMap {
  const p = params
  const rnd = mulberry32(seed)
  const rndInt = (n: number) => Math.floor(rnd() * Math.max(1, n))

  const L = Math.max(4, p.layers | 0)
  const maxCol = Math.max(2, p.maxColumns)
  const [pcLo, pcHi] = p.pathCount
  // pathCount = 并行主干条数，用于决定纺锤最宽处宽度，再被 maxColumns 夹住。
  // ⚠️ maxColumns 比 pcHi 小时这个区间看不出差别（当前默认 4 < 6，就是这种情况）；
  // 想让 5~6 条主干真正生效，要同时把 maxColumns 放开。
  const peak = Math.min(maxCol, Math.max(2, pcLo + rndInt(pcHi - pcLo + 1)))

  // ---- 1) 纺锤形铺层：第 0 层单入口、末层单 BOSS，中间按 sin 曲线先变宽后收窄 ----
  const counts: number[] = []
  for (let r = 0; r < L; r++) {
    if (r === 0 || r === L - 1) { counts.push(1); continue }
    const t = r / (L - 1)
    counts.push(Math.max(1, Math.min(peak, 1 + Math.round((peak - 1) * Math.sin(Math.PI * t)))))
  }
  // 曲线本身是确定性的，不抖动的话每张图骨架完全一样（层宽序列恒定），玩起来像同一张图。
  // 连边构造对任意 (m,n) 都成立，所以宽度怎么抖都不会破坏不交叉 / 无死路。
  for (let r = 1; r < L - 1; r++) {
    if (rnd() < 0.4) counts[r] = Math.max(1, Math.min(peak, counts[r] + (rnd() < 0.5 ? -1 : 1)))
  }

  // ---- 2) 建节点 ----
  const nodes: MapNode[] = []
  const ids: string[][] = []
  for (let r = 0; r < L; r++) {
    ids.push([])
    for (let c = 0; c < counts[r]; c++) {
      const id = `r${r}c${c}`
      ids[r].push(id)
      nodes.push({ id, row: r, col: c, type: "enemy", next: [] })
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n] as const))

  // ---- 3) 连边：不交叉 + 全覆盖 + 无死路 ----
  // 把下一层的 n 个节点按列切成 m 段**互不重叠且递增**的连续块，第 i 个源独占第 i 段：
  //   lo_i = floor(i·n/m)，hi_i = max(lo_i, floor((i+1)·n/m) − 1)
  // 于是天然成立 —— 不交叉（a<c ⇒ b<=d）、无死路（每段非空）、全覆盖（各段拼起来覆盖全部目标）。
  for (let r = 0; r < L - 1; r++) {
    const m = counts[r], n = counts[r + 1]
    const lo = (i: number) => Math.floor((i * n) / m)
    const hi = (i: number) => Math.max(lo(i), Math.floor(((i + 1) * n) / m) - 1)
    const sets: Set<number>[] = Array.from({ length: m }, () => new Set<number>())
    for (let i = 0; i < m; i++) for (let j = lo(i); j <= hi(i); j++) sets[i].add(j)
    // 抖动：补一条斜边，让路线有分叉而不是整齐的梯子。
    // 候选区间被两端夹住 —— 下界 hi(i−1) 保证不越过前一个源的最大目标，上界 upper 保证不越过后一个源的最小目标；
    // 必须从后往前推进才能一次把 upper 定死。
    let upper = n - 1
    for (let i = m - 1; i >= 0; i--) {
      const low = i > 0 ? hi(i - 1) : 0
      const cand: number[] = []
      for (let j = low; j <= upper; j++) if (!sets[i].has(j)) cand.push(j)
      if (cand.length > 0 && rnd() < 0.6) sets[i].add(cand[rndInt(cand.length)])
      upper = Math.min(upper, ...Array.from(sets[i]))
    }
    for (let i = 0; i < m; i++) {
      const src = byId.get(ids[r][i])!
      for (const j of [...sets[i]].sort((a, b) => a - b)) src.next.push(ids[r + 1][j])
    }
  }

  // ---- 4) 类型：按权重 roll，再逐条套硬约束 ----
  /** 入口 / BOSS 前一层 / BOSS 层这三行的类型是定死的，冲突时不能拿来重 roll */
  const fixedRow = (r: number) => r === 0 || r === L - 2 || r === L - 1
  const rollType = (layer: number, ban?: (t: RollType) => boolean): RollType => {
    const all: RollType[] = ["enemy", "elite", "shop", "rest", "random", "event"]
    const pool = all.filter((t) => layer >= p.minLayer[t] && !ban?.(t))
    // 兜底：约束叠加到没有候选时退化为普通敌人，绝不抛错
    return weightedPick(pool.length > 0 ? pool : (["enemy"] as RollType[]), (t) => p.weights[t], rndInt)
  }
  for (const n of nodes) {
    if (n.row === 0) { n.type = "enemy"; continue }       // 入口固定普通
    if (n.row === L - 1) { n.type = "boss"; continue }    // 末层单 BOSS
    if (L >= 3 && n.row === L - 2) { n.type = "rest"; continue } // BOSS 前一层强制补给
    // 开局若干层只允许普通 / 未揭示，避免一上来撞精英
    const ban = n.row < p.earlySafeLayers ? (t: RollType) => t !== "enemy" && t !== "random" : undefined
    n.type = rollType(n.row, ban)
  }
  // 商店与营地不得被同一条边直连：冲突时重 roll **可变的那一端**（上面三行是定死的），
  // 且排除 shop / rest 本身，兜底退化为普通敌人
  for (let pass = 0; pass < 12; pass++) {
    let changed = 0
    for (const n of nodes) {
      for (const id of n.next) {
        const m = byId.get(id)!
        const bad = (n.type === "shop" && m.type === "rest") || (n.type === "rest" && m.type === "shop")
        if (!bad) continue
        const target = !fixedRow(m.row) ? m : (!fixedRow(n.row) ? n : null)
        if (!target) continue
        target.type = rollType(target.row, (t) =>
          t === "shop" || t === "rest" || (target.row < p.earlySafeLayers && t !== "enemy" && t !== "random"))
        changed++
      }
    }
    if (changed === 0) break
  }

  return { act, layers: L, nodes }
}

/** 按权重抽一个（与 C 端 weightedPick 同构） */
function weightedPick<T>(list: T[], w: (t: T) => number, rndInt: (n: number) => number): T {
  let total = 0
  for (const t of list) total += w(t)
  let x = rndInt(Math.max(1, total))
  for (const t of list) { x -= w(t); if (x < 0) return t }
  return list[list.length - 1]
}

/** 生成整套（acts 幕）地图 */
export function generatePack(params: MapGenParams, seed: number): ActMap[] {
  const out: ActMap[] = []
  for (let a = 1; a <= params.acts; a++) {
    // 每幕换种子，否则三幕会涨成同一张图（同参同种子必然同图）
    out.push(generateAct(params, a, seed + a * 7919))
  }
  return out
}

// ---------------- 自校验：硬约束逐条断言 ----------------
// 之所以要有它：生成器是概率性的，"看着像对的"不等于每条约束都满足。
// 这里的规则与 C 端 map-gen.config.json 的 constraints 一一对应，改生成器后必须重跑。

export interface Violation { act: number; rule: string; detail: string }

/** 校验单幕，返回违规列表（空数组 = 全部通过） */
export function validateAct(act: ActMap, p: MapGenParams): Violation[] {
  const bad: Violation[] = []
  const add = (rule: string, detail: string) => bad.push({ act: act.act, rule, detail })
  const nodes = act.nodes
  const L = act.layers || 0
  const byId = new Map(nodes.map((n) => [n.id, n] as const))

  // 基础形状
  if (!nodes.length) { add("结构", "节点为空"); return bad }
  if (byId.size !== nodes.length) add("结构", `存在重复 id（${nodes.length} 个节点 / ${byId.size} 个唯一 id）`)
  const rowsOf = new Map<number, MapNode[]>()
  for (const n of nodes) {
    if (n.row < 0 || n.row >= L) add("结构", `节点 ${n.id} 的 row=${n.row} 越界（layers=${L}）`)
    if (!rowsOf.has(n.row)) rowsOf.set(n.row, [])
    rowsOf.get(n.row)!.push(n)
    for (const id of n.next) if (!byId.has(id)) add("结构", `节点 ${n.id} 指向不存在的 ${id}`)
  }
  for (let r = 0; r < L; r++) if (!rowsOf.has(r)) add("结构", `第 ${r} 层没有任何节点`)

  // 入口：第 0 层恰好 1 个、类型普通
  const row0 = rowsOf.get(0) || []
  if (row0.length !== 1) add("entrance", `第 0 层应为单入口，实际 ${row0.length} 个`)
  if (row0.length === 1 && row0[0].type !== "enemy") add("entrance", `入口类型应为普通敌人，实际 ${row0[0].type}`)

  // 唯一 BOSS 且在末层
  const bosses = nodes.filter((n) => n.type === "boss")
  if (bosses.length !== 1) add("single-boss", `BOSS 数量应为 1，实际 ${bosses.length}`)
  for (const b of bosses) if (b.row !== L - 1) add("single-boss", `BOSS ${b.id} 不在末层（row=${b.row}, 末层=${L - 1}）`)

  // 无死路（末层外的每个节点至少一条出边）
  for (const n of nodes) {
    if (n.row < L - 1 && n.next.length === 0) add("no-dead-end", `节点 ${n.id}（第 ${n.row} 层）没有出边`)
    if (n.row === L - 1 && n.next.length > 0) add("no-dead-end", `末层节点 ${n.id} 不该有出边`)
  }

  // 全覆盖（除第 0 层外每个节点至少一条入边）
  const indeg = new Map<string, number>()
  for (const n of nodes) for (const id of n.next) indeg.set(id, (indeg.get(id) || 0) + 1)
  for (const n of nodes) if (n.row > 0 && !indeg.get(n.id)) add("full-coverage", `节点 ${n.id}（第 ${n.row} 层）没有入边`)

  // 不交叉：同层内按 col 升序，任意两条边 (a→b)、(c→d) 若 a<c 则必须 b<=d
  for (let r = 0; r < L - 1; r++) {
    const src = (rowsOf.get(r) || []).slice().sort((x, y) => x.col - y.col)
    for (let i = 0; i < src.length; i++) {
      for (let j = i + 1; j < src.length; j++) {
        const a = src[i].next.map((id) => byId.get(id)!.col)
        const c = src[j].next.map((id) => byId.get(id)!.col)
        if (!a.length || !c.length) continue
        if (Math.max(...a) > Math.min(...c)) {
          add("no-crossing", `第 ${r}→${r + 1} 层：${src[i].id}(最大目标列 ${Math.max(...a)}) 与 ${src[j].id}(最小目标列 ${Math.min(...c)}) 的连线交叉`)
        }
      }
    }
  }

  // 边只能连到下一层
  for (const n of nodes) {
    for (const id of n.next) {
      const m = byId.get(id)!
      if (m.row !== n.row + 1) add("结构", `${n.id}(第 ${n.row} 层) → ${id}(第 ${m.row} 层)：连边只能跨一层`)
    }
  }

  // rest-before-boss：BOSS 前一层全是补给营地
  if (L >= 3) {
    for (const n of rowsOf.get(L - 2) || []) {
      if (n.type !== "rest") add("rest-before-boss", `BOSS 前一层的 ${n.id} 类型应为补给营地，实际 ${n.type}`)
    }
  }

  // early-tiers-safe：开局若干层只允许普通 / 未揭示
  for (const n of nodes) {
    if (n.row < p.earlySafeLayers && n.type !== "enemy" && n.type !== "random") {
      add("early-tiers-safe", `第 ${n.row} 层的 ${n.id} 类型为 ${n.type}，开局 ${p.earlySafeLayers} 层只允许普通敌人 / 未揭示`)
    }
  }

  // minLayer：精英 / 商店 / 营地 / 事件的最早层
  for (const n of nodes) {
    if (n.type === "boss") continue
    const min = p.minLayer[n.type as RollType]
    if (min != null && n.row < min) add("minLayer", `${n.id} 在第 ${n.row} 层出现 ${TYPE_LABEL[n.type]}（要求 >= ${min}）`)
  }

  // shop-rest-not-adjacent
  for (const n of nodes) {
    for (const id of n.next) {
      const m = byId.get(id)!
      if ((n.type === "shop" && m.type === "rest") || (n.type === "rest" && m.type === "shop")) {
        add("shop-rest-not-adjacent", `${n.id}(商店) 与 ${m.id}(营地) 被一条边直连`)
      }
    }
  }

  return bad
}

/** 校验整套 */
export function validatePack(acts: ActMap[], p: MapGenParams): Violation[] {
  return acts.flatMap((a) => validateAct(a, p))
}

/** 生成 + 自校验：返回整套地图与违规列表（违规为空才算合格） */
export function generateVerified(params: MapGenParams, seed: number): { acts: ActMap[]; violations: Violation[] } {
  const acts = generatePack(params, seed)
  return { acts, violations: validatePack(acts, params) }
}
