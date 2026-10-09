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
 * 画布级鉴权：**登录了不等于能进这块画布**，也不等于能写。
 *
 * <p>转发同一枚 cookie 调 Java `GET /api/canvas/{roomId}`：
 * - 非 2xx → 无权限（画布不存在 / 既不是创建者也不是协作者）；
 * - 2xx → 放行，并按响应里的 `my_permission` 决定**这条连接能不能写**。
 *
 * <p>之所以复用「取元数据」这个接口而不是新开一个：能取到元数据本来就是「有权限」的定义，
 * 少一个接口就少一处要同步的白名单。权限级别顺带回传，也不用第二个请求。
 *
 * <p>⚠️ **认不出权限时按只读放行**（fail-closed：宁可让人看不能写，也别给写）。
 * 代价是：若 Java 侧被回滚成不带 `my_permission` 的版本，所有人都会变只读 ——
 * 这是刻意选的失败方向。
 *
 * @returns {Promise<{permission:string, readonly:boolean}|null>} null = 不允许连接
 */
export async function canvasPermission(roomId, cookie) {
  if (!cookie) return null
  try {
    const r = await fetch(`${CANVAS_API}/${encodeURIComponent(roomId)}`, {
      headers: { cookie },
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    const p = j && typeof j.my_permission === 'string' ? j.my_permission : ''
    if (p === 'owner') return { permission: 'owner', readonly: false }
    if (p === 'edit') return { permission: 'edit', readonly: false }
    // view 与「没给权限」都按只读；两者都不能写
    return { permission: p || 'view', readonly: true }
  } catch {
    return null
  }
}
