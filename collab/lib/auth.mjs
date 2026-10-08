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

const CANVAS_API = process.env.COLLAB_CANVAS_API || 'http://127.0.0.1:8001/api/canvas'

/**
 * 画布级鉴权：**登录了不等于能进这块画布**。
 *
 * <p>转发同一枚 cookie 调 Java `GET /api/canvas/{roomId}` —— 能读到元数据（200）才放行。
 * Java 侧 `CanvasController.canAccess` 的语义是「超管看全部，其他人只能碰自己建的」，
 * 无权限与不存在**都回 403**（不泄漏 roomId 是否存在）。
 *
 * <p>之所以复用「取元数据」这个接口而不是新开一个：**能取到元数据本来就是「有权限」的定义**，
 * 少一个接口就少一处要同步的白名单。
 *
 * <p>fail-closed：Java 不可达 / 超时 / 非 2xx 一律拒绝。
 *
 * @param {string} roomId 16 位 hex（server.mjs 已在解析阶段校验过格式）
 * @param {string|undefined} cookie 浏览器带上来的原始 Cookie 头
 */
export async function canvasAccess(roomId, cookie) {
  if (!cookie) return false
  try {
    const r = await fetch(`${CANVAS_API}/${encodeURIComponent(roomId)}`, {
      headers: { cookie },
      signal: AbortSignal.timeout(4000),
    })
    return r.ok
  } catch {
    return false
  }
}
