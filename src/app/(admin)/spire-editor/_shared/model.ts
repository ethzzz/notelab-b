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
// 地图生成规则复用 B 端权威生成器 spire-mapgen（DEFAULT_PARAMS / sanitizeParams / MapGenParams），
// 保证「地图生成」页表单初始化与保存净化口径与生成器完全一致，不会和后端/ C 端漂移。
import {
  DEFAULT_PARAMS, sanitizeParams,
  type MapGenParams,
} from "@/lib/spire-mapgen"

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

// ---------------- 敌人 / Boss ----------------
export type MoveKind = "atk" | "block" | "buff" | "debuff"
export const MOVE_KINDS: MoveKind[] = ["atk", "block", "buff", "debuff"]
export const MOVE_KIND_LABEL: Record<MoveKind, string> = {
  "atk": "攻击", "block": "格挡", "buff": "增益", "debuff": "减益",
}
export const DEBUFF_KINDS = ["weak", "vuln"] as const
export const DEBUFF_KIND_LABEL: Record<string, string> = { weak: "虚弱", vuln: "易伤" }

export interface Move {
  name: string
  kind: MoveKind
  amt: number
  hits: number
  icon: string
  debuffKind?: "weak" | "vuln"
}

export interface EnemyDef {
  id: string
  name: string
  icon: string
  hp: number
  elite?: boolean
  boss?: boolean
  moves: Move[]
}

export const blankEnemy = (): EnemyDef => ({
  id: `custom_e_${uid36()}`, name: "", icon: "👾", hp: 30,
  moves: [{ name: "普攻", kind: "atk", amt: 6, hits: 1, icon: "🗡️" }],
})

// ---------------- 平衡 / 难度参数 ----------------
export interface SpireBalance {
  totalActs: number
  mapRows: number
  actBossIds: string[]
  actScaleStep: number
}

export const blankBalance = (): SpireBalance => ({
  totalActs: 3, mapRows: 16, actBossIds: ["king", "jadeGolem", "spireLord"], actScaleStep: 0.3,
})

/** 规整 balance：数值夹到安全范围，actBossIds 补齐到 totalActs 个（不足循环复用） */
export function sanitizeBalance(raw: any): SpireBalance {
  const b = blankBalance()
  if (!raw || typeof raw !== "object") return b
  const totalActs = Math.max(1, Math.min(8, Math.floor(Number(raw.totalActs)) || b.totalActs))
  const mapRows = Math.max(1, Math.min(400, Math.floor(Number(raw.mapRows)) || b.mapRows))
  const step = Math.max(0, Math.min(5, Number(raw.actScaleStep)))
  const ids = Array.isArray(raw.actBossIds)
    ? raw.actBossIds.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
    : [...b.actBossIds]
  const pool = ids.length ? ids : [...b.actBossIds]
  const filled: string[] = []
  for (let i = 0; i < totalActs; i++) filled.push(pool[i % pool.length])
  return { totalActs, mapRows, actBossIds: filled, actScaleStep: Number.isFinite(step) ? step : b.actScaleStep }
}

// ---------------- 地图生成规则 ----------------
// 与敌人/平衡一致：运营在「地图生成」页改的是 mapRules（后端 spire 切片的 mapRules 键），
// 这里负责类型 + 草稿工厂 + 净化，口径对齐 B 端 spire-mapgen（= C 端生成器的移植版，
// DEFAULT_PARAMS / sanitizeParams 同源）。浏览器表单与保存往返都用同一份净化，避免漂移。
// SpireMapRules 直接复用 MapGenParams 结构，使 store.mapRules 可直接喂给 generateVerified。
export type SpireMapRules = MapGenParams

/** 草稿工厂：返回一份与 DEFAULT_PARAMS 等价的全新对象（pathCount 单独拷贝，避免共享可变元组） */
export const blankMapRules = (): SpireMapRules => ({
  ...DEFAULT_PARAMS,
  pathCount: [...DEFAULT_PARAMS.pathCount] as [number, number],
})

/** 净化 mapRules：越界夹到 LIMITS，结构非法回落 DEFAULT_PARAMS。与后端 sanitizeMapRules 同口径 */
export const sanitizeMapRules = sanitizeParams

/** 净化单条敌人：id/name 缺、无合法 move 直接丢弃；数值夹到安全范围 */
export function sanitizeEnemy(raw: any): EnemyDef | null {
  if (!raw || typeof raw !== "object") return null
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null
  if (!id || !name) return null
  const moves = (Array.isArray(raw.moves) ? raw.moves : [])
    .map((m: any): Move | null => {
      if (!m || !MOVE_KINDS.includes(m.kind)) return null
      const dk = m.debuffKind === "weak" || m.debuffKind === "vuln" ? m.debuffKind : undefined
      return {
        name: typeof m.name === "string" ? m.name : "",
        kind: m.kind,
        amt: Math.max(0, Math.min(99, Math.floor(Number(m.amt)) || 0)),
        hits: Math.max(1, Math.min(9, Math.floor(Number(m.hits)) || 1)),
        icon: typeof m.icon === "string" && m.icon.trim() ? m.icon.trim() : "❓",
        debuffKind: dk,
      }
    })
    .filter(Boolean) as Move[]
  if (moves.length === 0) return null
  return {
    id, name,
    icon: typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : "👾",
    hp: Math.max(1, Math.min(999, Math.floor(Number(raw.hp)) || 30)),
    elite: !!raw.elite,
    boss: !!raw.boss,
    moves,
  }
}

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
