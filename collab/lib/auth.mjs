// WebSocket 握手鉴权：把浏览器带来的 cookie 转发给 Java /api/auth/verify，
// 只放行 **B 端后台会话**（scope === "b"）。与具体引擎无关，所有引擎共用同一道门。
const AUTH_VERIFY = process.env.COLLAB_AUTH_VERIFY || 'http://127.0.0.1:8001/api/auth/verify'

/**
 * 校验 cookie，成功返回会话对象，失败返回 null。
 *
 * fail-closed：Java 不可达 / 超时 / 非 JSON / scope 不是 b —— 一律当成未登录，
 * 宁可拒绝连接也不放大门。
 */
export async function authOf(cookie) {
  if (!cookie) return null
  try {
    const r = await fetch(AUTH_VERIFY, {
      headers: { cookie },
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    return j && j.scope === 'b' ? j : null
  } catch {
    return null
  }
}
