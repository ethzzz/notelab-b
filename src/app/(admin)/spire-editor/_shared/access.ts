// 爬塔工坊 · 角色授权（C 端用户组 × 可选角色白名单）
import type { SpireBaseChar } from "@/lib/spire-content"
import type { CharacterDef } from "@/lib/spire-engine"

/** 角色授权：C 端用户组（GET /api/c-admin/groups 的 items） */
export interface CGroup { code: string; name: string; member_count?: number }

/** VIP 组码：默认全勾；default 组默认排除下面这批"需授权"角色 */
export const VIP_GROUP = "vip"
/** 普通用户（default 组）默认不勾的角色 id：武诸葛为 VIP 专属 */
export const DEFAULT_LOCKED_IDS = ["wuzhuge"]

/** 授权池里的一项：内置角色与工坊自定义角色统一形态，`custom` 仅供界面打标签 */
export interface PoolChar { id: string; name: string; icon: string; custom: boolean }

/** 全量可选角色池 = 工坊自定义角色 + 内置基础角色（按 id 去重，自定义优先） */
export function allCharPool(baseChars: SpireBaseChar[], chars: CharacterDef[]): PoolChar[] {
  const seen = new Set<string>()
  const out: PoolChar[] = []
  for (const c of chars) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id); out.push({ id: c.id, name: c.name || c.id, icon: c.icon || "🧙", custom: true })
  }
  for (const c of baseChars) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id); out.push({ id: c.id, name: c.name || c.id, icon: c.icon || "🎭", custom: false })
  }
  return out
}

/** 某组首次无配置时的预填白名单（fail-open 友好，便于运维直接发布） */
export function presetAccess(groupCode: string, pool: { id: string }[]): string[] {
  if (groupCode === "default") return pool.map((c) => c.id).filter((id) => !DEFAULT_LOCKED_IDS.includes(id))
  return pool.map((c) => c.id) // vip 与其它组：默认全勾
}
