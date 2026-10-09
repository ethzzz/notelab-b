// 分配路由弹窗的**展示层分组骨架**：页面 ↔ 接口模块的归属。
//
// 目标：分配路由时页面（page:*）与它用到的接口（api:*）在同一分组里一起勾，
// 避免「勾了页面没勾接口 → 菜单能看、功能 403」的错配。
//
// ⚠️ 这里**只有「归属」**（哪个页面用哪个模块）。模块的**键与展示名来自后端**
//    （`PermService.listRoutes()` 附加的 module / module_name，权威定义在
//    notelab-java 的 `model/ApiModules`）—— 前端不再自己推导路径段，
//    否则会出现「后端加了模块、前端忘了加」的静默失配。
//
// ⚠️ 因此本表里写的模块键必须与后端 `ApiModules.keyOf()` 的产物严格一致
//    （如 `admin/ops/login-audit`、`perm/users`、`c-admin/invite-codes`）。
//    写错不会报错 —— 那个模块会找不到归属，落进弹窗底部的「系统通用」分组。
//
// ⚠️ 这是手工维护表：**后端新增页面**（或页面改用别的接口）时需同步改这里。

/** 单个页面（路径与 PageRoutes.PAGE_ROUTES 一致）对应的接口模块键 */
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
