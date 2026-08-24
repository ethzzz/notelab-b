// notelab-b（B 端管理后台）后端 API：
// 浏览器与页面同源于 nginx :80，/api/* 由 nginx 直达 :8001（notelab-java），无需 Next 代理。
// 页面本身挂在 basePath=/admin 下；/api 不在 basePath 内，保持绝对路径直连。

/** Next basePath：仅用于访问挂在 /admin 下的 Next 自身路由（如 /admin/api/tts 语音合成 route handler） */
export const BASE_PATH = "/admin"

export function apiBase(): string {
  return ""
}

// 统一请求：同源，携带 Cookie
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}${path}`, { credentials: "include", ...init })
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await api(path, init)
  let data: any = null
  try { data = await r.json() } catch { /* 非 JSON */ }
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
  return data as T
}

export function postJson(path: string, body: any): Promise<any> {
  return apiJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ---------------- 未登录回跳：记录被拦截的路由，登录成功后返回 ----------------
// 与 C 端（notelab-c.redirect）隔离，使用 B 端专属 key；记录的是去掉 /admin 前缀的站内路径
const REDIRECT_KEY = "notelab-b.redirect"

/** 去掉 basePath 前缀（守卫处用 window.location.pathname 拿到的路径是带 /admin 的） */
export function stripBasePath(p: string): string {
  return p.startsWith(BASE_PATH + "/") ? p.slice(BASE_PATH.length) : p === BASE_PATH ? "/" : p
}

export function rememberPath(path: string) {
  try { localStorage.setItem(REDIRECT_KEY, stripBasePath(path)) } catch { /* ignore */ }
}

export function clearRememberedPath() {
  try { localStorage.removeItem(REDIRECT_KEY) } catch { /* ignore */ }
}

/**
 * 取出并清除记录的路由：
 * - 格式非法（非站内路径 / login / register 自身）→ 回退 fallback
 * - 传入 validPaths（菜单路由）时，不在其中（无权限/不存在）也回退 fallback
 */
export function takeRedirectPath(validPaths?: string[], fallback = "/dashboard"): string {
  let p = ""
  try {
    p = localStorage.getItem(REDIRECT_KEY) || ""
    localStorage.removeItem(REDIRECT_KEY)
  } catch { /* ignore */ }
  if (!p.startsWith("/") || p === "/login" || p.startsWith("/register")) return fallback
  if (validPaths && !validPaths.includes(p.split("?")[0])) return fallback
  return p
}
