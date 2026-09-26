// 爬塔工坊 · 共享数据模型
// 从原单体 page.tsx 抽出的类型 / 草稿工厂 / 净化 / 展示标签。
// ⚠️ 这些类型来自 B 端自己的 `@/lib/spire-engine`（该文件是 C 端引擎的**陈旧副本**：
//    MAP_ROWS 仍是 7、generateMap 仍是无参老版本）。卡片/角色/技能的净化与卡面渲染只用
//    其中稳定的那部分（sanitizeCard / sanitizeCharacter / cardDesc / CATEGORIES...），
//    地图生成**不要**用它的 generateMap —— 见 `@/lib/spire-mapgen`。
import {
  CARDS, sanitizeCard, sanitizeCharacter, cardDesc,
  CATEGORIES, EFFECT_TYPES, EFFECT_TYPE_LABEL, PASSIVE_KINDS, PASSIVE_KIND_LABEL,
  SKILL_KINDS, SKILL_KIND_LABEL,
  type CardDef, type CardEffect, type CharacterDef, type CardCategory,
  type EffectType, type PassiveKind, type SkillKind,
} from "@/lib/spire-engine"

/** 技能模板：主动（SkillKind）或被动（PassiveKind），可在角色制作时引用（以拷贝形式嵌入角色） */
export interface SkillTpl {
  id: string
  stype: "active" | "passive"
  kind: string
  name: string
  icon: string
  desc: string
  value: number
  cooldown: number
  cardId?: string
}

/** 唯一 id 生成（36 进制时间戳 + 随机尾），用于新建草稿 */
export const uid36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

export const blankCard = (): CardDef => ({
  id: `custom_c_${uid36()}`, name: "", icon: "🎴", cost: 1, category: "attack", rarity: 0,
  effects: [{ type: "damage", amount: 6, target: "enemy", scope: { kind: "single" } }],
})

export const blankChar = (): CharacterDef => ({
  id: `custom_h_${uid36()}`, name: "", icon: "🧙", maxHp: 80, desc: "",
  startDeck: ["strike", "strike", "strike", "strike", "defend", "defend", "defend", "defend", "bash", "bash"],
  passives: [{ kind: "atk-bonus", name: "自定义被动", icon: "✨", desc: "", value: 1 }],
  skill: { kind: "draw-cards", name: "自定义技能", icon: "🌟", desc: "", cooldown: 3, value: 2 },
})

export const blankSkill = (stype: "active" | "passive"): SkillTpl => ({
  id: `custom_s_${uid36()}`, stype,
  kind: stype === "active" ? "draw-cards" : "atk-bonus",
  name: "", icon: stype === "active" ? "🌟" : "✨", desc: "",
  value: stype === "active" ? 2 : 1, cooldown: 3,
})

/** 轻量校验技能模板（结构非法的丢弃） */
export function cleanSkill(raw: any): SkillTpl | null {
  if (!raw || typeof raw !== "object") return null
  const stype = raw.stype === "passive" ? "passive" : raw.stype === "active" ? "active" : null
  if (!stype) return null
  const ok = stype === "active" ? SKILL_KINDS.includes(raw.kind) : PASSIVE_KINDS.includes(raw.kind)
  if (!ok || typeof raw.name !== "string" || !raw.name.trim()) return null
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `custom_s_${uid36()}`,
    stype, kind: raw.kind, name: raw.name.trim(),
    icon: typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : (stype === "active" ? "🌟" : "✨"),
    desc: typeof raw.desc === "string" ? raw.desc : "",
    value: Math.max(0, Math.min(99, Math.floor(Number(raw.value)) || 0)),
    cooldown: Math.max(0, Math.min(9, Math.floor(Number(raw.cooldown)) || 0)),
    cardId: typeof raw.cardId === "string" ? raw.cardId : undefined,
  }
}

export const kindLabel = (t: SkillTpl) =>
  (t.stype === "active" ? SKILL_KIND_LABEL : PASSIVE_KIND_LABEL)[t.kind as SkillKind & PassiveKind] || t.kind

export const catColor: Record<CardCategory, string> = {
  attack: "volcano", defense: "geekblue", buff: "gold", special: "magenta",
}

/** 列表/表单里反复用到的那几个常量与枚举，集中再导出一次，子页直接从 shared 取 */
export {
  CARDS, sanitizeCard, sanitizeCharacter, cardDesc,
  CATEGORIES, EFFECT_TYPES, EFFECT_TYPE_LABEL, PASSIVE_KINDS, PASSIVE_KIND_LABEL,
  SKILL_KINDS, SKILL_KIND_LABEL,
}
export type {
  CardDef, CardEffect, CharacterDef, CardCategory, EffectType, PassiveKind, SkillKind,
}
