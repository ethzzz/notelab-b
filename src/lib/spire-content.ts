// 爬塔尖塔内容工坊：自定义卡/角色/技能 + 角色授权 + 素材资源 + 地图方案
// 的服务端存取（存 ui_config JSON 的 spire 键，整包覆盖写）
import { apiJson, postJson } from "./api"

/** 内置基础角色（只读镜像，由后端 GET /api/spire-content 下发，仅 B 端授权界面用于展示） */
export interface SpireBaseChar {
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
  /** 角色授权：{C 端用户组码: [该组可选择的角色 id...]}；缺失/无该组键 → C 端不筛选（fail-open） */
  charAccess?: Record<string, string[]>
  /** 素材资源槽位取值（缺失 → C 端全部走内置默认） */
  assets?: SpireAssetMap
  /** 地图方案（缺失或空 → C 端回落到本地生成） */
  maps?: SpireMapDoc
  /** 只读：后端下发的内置角色清单，提交时可省 */
  baseCharacters?: SpireBaseChar[]
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
      charAccess: cleanCharAccess(d.charAccess),
      assets: cleanAssets(d.assets),
      maps: cleanMaps(d.maps),
      baseCharacters: Array.isArray(d.baseCharacters)
        ? d.baseCharacters.filter((c: any) => c && typeof c.id === "string" && c.id)
        : [],
    }
  } catch {
    return {
      cards: [], characters: [], skills: [], charAccess: {},
      assets: {}, maps: { packs: [] }, baseCharacters: [],
    }
  }
}

export function saveSpireContent(c: SpireCustomContent) {
  // baseCharacters 是后端只读常量，不回传
  const { baseCharacters: _drop, ...body } = c
  return postJson("/api/spire-content", {
    ...body,
    charAccess: c.charAccess && typeof c.charAccess === "object" ? c.charAccess : {},
    assets: c.assets && typeof c.assets === "object" ? c.assets : {},
    maps: c.maps && typeof c.maps === "object" ? c.maps : { packs: [] },
  })
}
