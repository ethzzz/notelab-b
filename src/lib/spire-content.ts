// 爬塔尖塔内容工坊：自定义卡/角色/技能 + 角色授权 + 素材资源 + 地图方案
// 的服务端存取（存 ui_config JSON 的 spire 键，整包覆盖写）
import { apiJson, postJson } from "./api"

/** 内置基础角色（只读镜像，由后端 GET /api/spire-content 下发，仅 B 端授权界面用于展示） */
export interface SpireBaseChar {
  id: string
  name: string
  icon: string
}

/** 内置基础敌人（只读镜像，由后端 GET /api/spire-content 下发，仅 B 端「敌人制作」页用于打标签） */
export interface SpireBaseEnemy {
  id: string
  name: string
  icon: string
}

/**
 * 素材资源槽位取值：{槽位 key: 素材路径}。
 * 路径形如 `/games/spire/art/icon-normal.png`（**必须带 C 端 basePath 前缀 `/games`**，
 * 与 C 端 NODE_META.art / spire-audio 的 SOUND_DIR 同一套约定）。
 * 空串或未配置 → C 端回落到内置默认。
 */
export type SpireAssetMap = Record<string, string>

/**
 * 素材**资源池**：{槽位 key: [素材路径...]}。
 *
 * 与 assets 的分工：池子 = 该类型登记了哪些候选素材（可多个）；
 * assets = 当前**使用**哪一个（必须属于池子，池子为空时回落内置默认）。
 * 「同类多个、用时选一个」就落在这两个键上 —— 运营换图时只需在池子里切换，
 * 不用重新找素材路径，也不会因为换图把旧图路径丢掉。
 */
export type SpireAssetPool = Record<string, string[]>

/** 单槽位资源池条目上限（与后端 MAX_POOL_PER_SLOT 对齐，防呆） */
export const MAX_ASSET_POOL_PER_SLOT = 50

/** 一套地图方案（含整套 3 幕的节点配置） */
export interface SpireMapPack {
  /** 方案 id（稳定标识，用于选默认） */
  id: string
  /** 方案名（展示用） */
  name: string
  /** 生成参数快照（便于复现与回溯，C 端不消费） */
  params?: Record<string, unknown>
  /** 各幕地图：下标无关，按 act 字段取值 */
  acts: { act: number; layers: number; nodes: any[] }[]
  /** 生成时间（ISO） */
  createdAt?: string
}

/** 地图配置文档：多套命名方案 + 指定默认发布哪一套 */
export interface SpireMapDoc {
  /** 当前选中的方案 id（发布时取这一套；缺省取列表第一个） */
  defaultId?: string
  packs: SpireMapPack[]
}

export interface SpireCustomContent {
  cards: any[]
  characters: any[]
  skills: any[]
  /** 敌人/Boss（缺失或空 → C 端回落内置 10） */
  enemies?: any[]
  /** 角色授权：{C 端用户组码: [该组可选择的角色 id...]}；缺失/无该组键 → C 端不筛选（fail-open） */
  charAccess?: Record<string, string[]>
  /** 素材资源槽位取值（缺失 → C 端全部走内置默认） */
  assets?: SpireAssetMap
  /** 素材资源池：同类可登记多个候选（缺失 → 只有 assets 那一个在用） */
  assetPool?: SpireAssetPool
  /** 地图方案（缺失或空 → C 端回落到本地生成） */
  maps?: SpireMapDoc
  /** 只读：后端下发的内置角色清单，提交时可省 */
  baseCharacters?: SpireBaseChar[]
  /** 只读：后端下发的内置敌人清单，提交时可省 */
  baseEnemies?: SpireBaseEnemy[]
}

/** 净化后端返回的 charAccess：只保留 {字符串键: 字符串数组} 形态 */
export function cleanCharAccess(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue
    out[k] = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []
  }
  return out
}

/**
 * 净化素材槽位表：只保留 {非空字符串键: 非空字符串值}。
 * 空值**丢弃而不是存空串**（语义上「未配置 = 回落内置默认」），后端也是同一口径 ——
 * 两边不一致会让「文档指纹」在保存往返后变化，从而误报「有未保存改动」。
 */
export function cleanAssets(raw: any): SpireAssetMap {
  const out: SpireAssetMap = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue
    if (typeof v === "string" && v.trim()) out[k] = v.trim()
  }
  return out
}

/**
 * 净化资源池：只保留 {非空字符串键: 非空字符串数组}。
 * 与 cleanAssets 同一口径（值 trim、空值丢弃、去重、保序），
 * 保证「保存往返后文档指纹不变」，否则会误报「有未保存改动」。
 */
export function cleanAssetPool(raw: any): SpireAssetPool {
  const out: SpireAssetPool = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue
    if (!Array.isArray(v)) continue
    const list: string[] = []
    for (const x of v) {
      if (typeof x !== "string") continue
      const p = x.trim()
      if (!p || list.includes(p)) continue
      list.push(p)
      if (list.length >= MAX_ASSET_POOL_PER_SLOT) break
    }
    if (list.length) out[k] = list
  }
  return out
}

/** 净化地图方案文档：结构非法的方案直接丢弃，缺 id/name 的补默认值 */
export function cleanMaps(raw: any): SpireMapDoc {
  const empty: SpireMapDoc = { defaultId: undefined, packs: [] }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty
  const packs: SpireMapPack[] = []
  const list = Array.isArray(raw.packs) ? raw.packs : []
  for (const p of list) {
    if (!p || typeof p !== "object") continue
    const acts = Array.isArray(p.acts)
      ? p.acts
          .filter((a: any) => a && typeof a === "object" && Array.isArray(a.nodes))
          .map((a: any, i: number) => ({
            act: Number.isFinite(Number(a.act)) ? Number(a.act) : i + 1,
            layers: Number.isFinite(Number(a.layers)) ? Number(a.layers) : a.nodes.length,
            nodes: a.nodes,
          }))
      : []
    if (!acts.length) continue
    packs.push({
      id: typeof p.id === "string" && p.id ? p.id : `pack_${packs.length + 1}`,
      name: typeof p.name === "string" && p.name ? p.name : `方案 ${packs.length + 1}`,
      params: p.params && typeof p.params === "object" ? p.params : undefined,
      acts,
      createdAt: typeof p.createdAt === "string" ? p.createdAt : undefined,
    })
  }
  const defaultId = packs.some((p) => p.id === raw.defaultId) ? raw.defaultId : packs[0]?.id
  return { defaultId, packs }
}

export async function loadSpireContent(): Promise<SpireCustomContent> {
  try {
    const d = await apiJson("/api/spire-content")
    return {
      cards: Array.isArray(d.cards) ? d.cards : [],
      characters: Array.isArray(d.characters) ? d.characters : [],
      skills: Array.isArray(d.skills) ? d.skills : [],
      enemies: Array.isArray(d.enemies) ? d.enemies : [],
      charAccess: cleanCharAccess(d.charAccess),
      assets: cleanAssets(d.assets),
      assetPool: cleanAssetPool(d.assetPool),
      maps: cleanMaps(d.maps),
      baseCharacters: Array.isArray(d.baseCharacters)
        ? d.baseCharacters.filter((c: any) => c && typeof c.id === "string" && c.id)
        : [],
      baseEnemies: Array.isArray(d.baseEnemies)
        ? d.baseEnemies.filter((e: any) => e && typeof e.id === "string" && e.id)
        : [],
    }
  } catch {
    return {
      cards: [], characters: [], skills: [], enemies: [], charAccess: {},
      assets: {}, assetPool: {}, maps: { packs: [] }, baseCharacters: [], baseEnemies: [],
    }
  }
}

export function saveSpireContent(c: SpireCustomContent) {
  // baseCharacters / baseEnemies 是后端只读常量，不回传
  const { baseCharacters: _dropC, baseEnemies: _dropE, ...body } = c
  return postJson("/api/spire-content", {
    ...body,
    enemies: c.enemies && Array.isArray(c.enemies) ? c.enemies : [],
    charAccess: c.charAccess && typeof c.charAccess === "object" ? c.charAccess : {},
    assets: c.assets && typeof c.assets === "object" ? c.assets : {},
    assetPool: c.assetPool && typeof c.assetPool === "object" ? c.assetPool : {},
    maps: c.maps && typeof c.maps === "object" ? c.maps : { packs: [] },
  })
}
