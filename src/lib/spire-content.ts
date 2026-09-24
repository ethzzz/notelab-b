// 爬塔尖塔内容工坊：自定义卡/角色/技能 + 角色授权白名单的服务端存取（存 ui_config JSON 的 spire 键）
import { apiJson, postJson } from "./api"

/** 内置基础角色（只读镜像，由后端 GET /api/spire-content 下发，仅 B 端授权界面用于展示） */
export interface SpireBaseChar {
  id: string
  name: string
  icon: string
}

export interface SpireCustomContent {
  cards: any[]
  characters: any[]
  skills: any[]
  /** 角色授权：{C 端用户组码: [该组可选择的角色 id...]}；缺失/无该组键 → C 端不筛选（fail-open） */
  charAccess?: Record<string, string[]>
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

export async function loadSpireContent(): Promise<SpireCustomContent> {
  try {
    const d = await apiJson("/api/spire-content")
    return {
      cards: Array.isArray(d.cards) ? d.cards : [],
      characters: Array.isArray(d.characters) ? d.characters : [],
      skills: Array.isArray(d.skills) ? d.skills : [],
      charAccess: cleanCharAccess(d.charAccess),
      baseCharacters: Array.isArray(d.baseCharacters)
        ? d.baseCharacters.filter((c: any) => c && typeof c.id === "string" && c.id)
        : [],
    }
  } catch {
    return { cards: [], characters: [], skills: [], charAccess: {}, baseCharacters: [] }
  }
}

export function saveSpireContent(c: SpireCustomContent) {
  // baseCharacters 是后端只读常量，不回传
  const { baseCharacters: _drop, ...body } = c
  return postJson("/api/spire-content", {
    ...body,
    charAccess: c.charAccess && typeof c.charAccess === "object" ? c.charAccess : {},
  })
}
