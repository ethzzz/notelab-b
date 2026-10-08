// 内置角色组常量与展示口径。
//
// ⚠️ code 必须与后端 PermService.ROLE_* 一一对应（users.role / perm_roles.code）。
// 内置 = 不可删除、不可在「角色组管理」里删掉的那几个；它们的差异不只是"名字好看"：
//   super_admin 天然拥有全部路由（含未来新增），无需也不能分配；
//   user        普通用户，路由由后台每次启动按规则重算 api 权限；
//   external    外部账号，默认只给仪表盘，且不可提升为超管、不可进后台之外的服务。
export const ROLE_SUPER_ADMIN = "super_admin"
export const ROLE_USER = "user"
export const ROLE_EXTERNAL = "external"

const BUILTIN = new Set<string>([ROLE_SUPER_ADMIN, ROLE_USER, ROLE_EXTERNAL])

/** 是否内置角色组（内置不可删除） */
export function isBuiltinRole(code: string): boolean {
  return BUILTIN.has(code)
}

/** 是否外部账号（只由超管建号/改密、只允许在 B 端后台内使用） */
export function isExternalRole(code?: string | null): boolean {
  return code === ROLE_EXTERNAL
}

/** 角色组图标；未知角色组用盾牌兜底 */
export function roleIcon(code: string): string {
  if (code === ROLE_SUPER_ADMIN) return "👑"
  if (code === ROLE_USER) return "🙋"
  if (code === ROLE_EXTERNAL) return "🏷️"
  return "🛡️"
}

/** 角色组的「内置」说明文案；自建角色组返回通用文案 */
export function roleHint(code: string): string {
  if (code === ROLE_SUPER_ADMIN) return "默认拥有全部路由（含未来自动注册的新路由），无需分配"
  if (code === ROLE_USER) return "分配路由组后，成员菜单即时生效"
  if (code === ROLE_EXTERNAL) return "外部账号：默认只给仪表盘，其余需手工分配"
  return "分配路由组后，成员菜单即时生效"
}

/** 分配路由弹窗里针对该角色组的额外提示（无则返回 null） */
export function roleAssignNotice(code: string): string | null {
  if (code !== ROLE_EXTERNAL) return null
  return "外部账号默认只勾了「仪表盘」。它不持有任何 api 权限码，所以只加页面路由可能仍打不开功能——" +
    "需要连同该功能用到的 api 路由一起勾（可整组勾选）。"
}
