// 服务端会话校验（Node runtime 专用 —— ⚠️ 不要在客户端组件里 import）
//
// 为什么需要它：Next 的 **route handler 不受前端页面守卫保护**。
// `(admin)/layout.tsx` 里那套 `pages.includes(pathname)` 只在浏览器里跑，它保护的只是**页面**；
// 而 `/admin/api/tts` 这类 route handler 是**可直接调用的 HTTP 端点**，绕过页面照样能打。
//
// 实测（2026-10-08）：匿名（不带任何 cookie）`POST /admin/api/tts`
//   → HTTP 200 + 11088 字节音频
// 即任何人都能白嫖 TTS 算力（Kokoro 本地推理占 CPU，或外呼微软 edge-tts），
// 顺带污染那个 200 条的 LRU 缓存。
//
// 做法与 `collab/lib/auth.mjs` 一致：把浏览器带来的 cookie 转发给 Java `/api/auth/verify`，
// 只放行 `scope === "b"`（B 端后台会话）。
//
// **fail-closed**：Java 不可达 / 超时 / 非 JSON / scope 不是 b —— 一律当成未登录。
// 宁可拒绝一个正常请求，也不放一个没验过的进来。

/** Java 侧校验端点；与 collab 同理可用环境变量覆盖（默认本机） */
const AUTH_VERIFY = process.env.AUTH_VERIFY_URL || "http://127.0.0.1:8001/api/auth/verify"

/** B 端会话 cookie 名（与 Java `AppConfig.SESSION_COOKIE` 一致） */
export const SESSION_COOKIE = "notelab_session"

export type BSession = { ok?: boolean; scope?: string; id?: unknown }

/**
 * 校验请求是否携带**有效的 B 端后台会话**。
 *
 * @returns 通过则返回会话对象（含 `scope` / `id`），否则 `null`（调用方应回 401）
 */
export async function bSession(req: Request): Promise<BSession | null> {
  const cookie = req.headers.get("cookie") || ""
  // 快速否决：连 cookie 头都没有就不必外呼（这一条也挡掉了扫描器）
  if (!cookie.includes(`${SESSION_COOKIE}=`)) return null
  try {
    const r = await fetch(AUTH_VERIFY, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const j = (await r.json().catch(() => null)) as BSession | null
    return j && j.scope === "b" ? j : null
  } catch {
    return null
  }
}
