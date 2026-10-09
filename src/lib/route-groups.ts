// 分配路由弹窗的「页面 ↔ 接口」归属映射（纯展示层约定，不影响后端鉴权）。
//
// 目标：分配路由时页面（page:*）与它用到的接口（api:*）在同一分组里一起勾，
// 避免「勾了页面没勾接口 → 菜单能看、功能 403」的错配。
//
// ⚠️ 这是手工维护表：后端新增页面/接口且归属变化时需同步改这里。
//    没映射到的接口不会丢——它们自动落进弹窗底部的「系统通用」分组。

/** 单个页面（路径与 PAGE_ROUTES 一致）对应的接口模块（模块键由 apiModuleKey 生成） */
export const PAGE_MODULES: Record<string, string[]> = {
  "/chat": ["chat", "conversations"],
  "/arena": ["arena"],
  "/rag": ["rag"],
  "/extract": ["extract"],
  "/english": ["english"],
  "/translate": ["translate", "admin/translate"],
  "/toolbox": ["toolbox"],
  "/docs": ["docs"],
  "/canvas": ["canvas"],
  "/notes": ["notes"],
  "/tools": ["tools"],
  "/stress-test": ["admin/stress-test"],
  "/trpg/gen": ["trpg"],
  "/practice/dev-summary": ["dev-notes"],
  "/analytics": ["analytics"],
  "/perm": ["perm"],
  "/user/accounts": ["perm/users"],
  "/user/roles": ["perm/roles"],
  "/user/invites": ["c-admin/invite-codes"],
  "/c-users": ["c-admin"],
  "/ui": ["ui-config"],
  "/ops": ["admin/ops", "arch"],
  "/login-audit": ["admin/ops/login-audit"],
  "/blog-gen": ["blog"],
}

/** 多个页面共用的接口模块 → 挂在哪个菜单分组节点上（分组 key 与 /api/menu 一致） */
export const SHARED_MODULES: Record<string, string[]> = {
  gc_spire: ["spire-content", "spire-assets"],
  gc_loot: ["loot-content", "loot-assets"],
}

/** 模块键 → 展示名；未登记的模块直接显示键名 */
export const MODULE_NAMES: Record<string, string> = {
  chat: "智能对话接口",
  conversations: "会话记录接口",
  arena: "竞技场接口",
  rag: "RAG 检索接口",
  extract: "结构化抽取接口",
  english: "英语学习接口",
  translate: "翻译接口",
  "admin/translate": "翻译管理接口",
  toolbox: "文本工具箱接口",
  docs: "文档接口",
  canvas: "画布接口",
  notes: "笔记接口",
  tools: "工具库接口",
  "admin/stress-test": "压测接口",
  trpg: "TRPG 接口",
  "dev-notes": "开发笔记接口",
  analytics: "埋点分析接口",
  perm: "权限总览接口",
  "perm/users": "账户接口",
  "perm/roles": "角色组接口",
  "c-admin": "C端用户接口",
  "c-admin/invite-codes": "邀请码接口",
  "ui-config": "界面配置接口",
  "admin/ops": "运维状态接口",
  "admin/ops/login-audit": "登录审计接口",
  arch: "架构守护接口",
  blog: "博客接口",
  "spire-content": "爬塔内容接口",
  "spire-assets": "爬塔素材接口",
  "loot-content": "摸金内容接口",
  "loot-assets": "摸金素材接口",
  // 系统通用组
  login: "登录",
  logout: "登出",
  register: "注册",
  me: "会话信息",
  menu: "菜单",
  models: "模型列表",
  error: "错误页",
  auth: "认证",
  health: "健康检查",
}

/**
 * 由接口路径推导模块键：
 * - `/api/x/**` → `x`（两段也算，修掉旧版「/api/notes 落 _base、/api/notes/{id} 落 notes」的分裂）
 * - `/api/admin/x/**` → `admin/x`；其中 ops 再按 login-audit 细分（审计页单独授权）
 * - `/api/perm/{users,roles}/**` 拆开（分别归属账户管理/角色组管理页），其余归 `perm`（权限总览页）
 * - `/api/c-admin/invite-codes` 拆给邀请码页，其余归 `c-admin`（C端用户管理页）
 */
export function apiModuleKey(path: string): string {
  const s = path.split("/").filter(Boolean)
  if (s[0] !== "api") return s[0] || "_"
  if (s[1] === "admin") {
    if (s[2] === "ops") return s[3] === "login-audit" ? "admin/ops/login-audit" : "admin/ops"
    return `admin/${s[2] || ""}`
  }
  if (s[1] === "perm") {
    if (s[2] === "users") return "perm/users"
    if (s[2] === "roles") return "perm/roles"
    return "perm"
  }
  if (s[1] === "c-admin") return s[2] === "invite-codes" ? "c-admin/invite-codes" : "c-admin"
  return s[1] || "_"
}
