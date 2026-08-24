// 爬塔尖塔内容工坊：自定义卡/角色的服务端存取（存 ui_config JSON 的 spire 键）
import { apiJson, postJson } from "./api"

export interface SpireCustomContent {
  cards: any[]
  characters: any[]
  skills: any[]
}

export async function loadSpireContent(): Promise<SpireCustomContent> {
  try {
    const d = await apiJson("/api/spire-content")
    return {
      cards: Array.isArray(d.cards) ? d.cards : [],
      characters: Array.isArray(d.characters) ? d.characters : [],
      skills: Array.isArray(d.skills) ? d.skills : [],
    }
  } catch {
    return { cards: [], characters: [], skills: [] }
  }
}

export function saveSpireContent(c: SpireCustomContent) {
  return postJson("/api/spire-content", c)
}
