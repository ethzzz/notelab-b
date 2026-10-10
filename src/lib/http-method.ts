// HTTP 方法的展示色标 —— 权限树里用。
//
// 为什么值得单独一个文件：权限码自 2026-10-10 起**按方法拆分**（`api:GET:/api/x` 与
// `api:POST:/api/x` 是两条独立权限码），同一个 URL 会在「分配路由」里出现两个节点。
// 只靠文字前缀区分（GET / POST）在长列表里很容易看漏，所以给方法上色。
//
// 两棵树（B 端角色组 / C 端用户组）共用本表，改配色只改这一处。

/** antd Tag 的 color 取值；未登记的方法退化为 default */
export const METHOD_COLOR: Record<string, string> = {
  GET: "green",
  POST: "blue",
  PUT: "orange",
  PATCH: "purple",
  DELETE: "red",
  /** 没写 method 的 handler（如 Spring 的 /error）：对任何方法都适用 */
  ANY: "default",
}

export function methodColor(method?: string): string {
  return METHOD_COLOR[String(method || "").toUpperCase()] || "default"
}
