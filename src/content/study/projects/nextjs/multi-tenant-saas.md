---
title: 多租户 SaaS 后台
route: nextjs
direction: 平台
level: L3
weeks: 7-8
hours: 8-10
requires: nextjs:7-8, nextjs:5-6
tags: 多租户, middleware, 权限, 数据隔离
summary: 一个应用服务多个组织：路由怎么分、会话怎么带组织、查询怎么保证不漏条件。
---

## 业务背景

SaaS 后台通常要在「路径里带组织」和「子域名带组织」之间选一个，然后回答三个问题：当前组织从哪来？切换组织时怎么保持权限？查询怎么保证不漏 `orgId` 条件？

## 需求（用户故事）

- 作为成员，我访问 `/org/acme/orders` 只能看到 acme 的数据。
- 作为成员，我切换组织后，侧边栏与列表立刻跟着变。
- 作为管理员，我能给成员分配角色（owner / admin / member）。
- 作为访客，未登录访问任何组织页都跳登录，登录后回到原地址。

## 接口契约

```text
GET  /org/[orgId]/...           组织内页面
POST /api/orgs/switch           {orgId} → 设置当前组织 cookie
GET  /api/orgs/[orgId]/orders   必须校验成员身份
```

## 验收标准

- 用 A 组织的路径访问 B 组织的数据 → 403/404（不能只靠前端隐藏）。
- 未登录访问 → 302 到 `/login?next=...`，登录后回原页。
- 切换组织后，页面数据与侧边栏同时更新。
- 数据库查询日志里每条都带 `orgId`。

## 关键决策

:::hint middleware 只做「有没有登录」，组织权限必须在服务端再判
middleware 读不到数据库（边缘限制），所以它只能做「有没有会话」这种粗判断。**成员身份与角色必须在 layout / Route Handler 里查一次**，并按 `orgId` 过滤查询。
:::

## 参考实现

:::solution 关键实现：middleware 只做认证与重定向，授权与数据过滤放服务端
`middleware.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server'

/**
 * middleware 只做两件事：有没有会话、目标路径要不要登录。
 * ⚠️ 不要在 middleware 里查库做成员校验（Edge 运行时 + 每个请求一次查询，贵且不稳）；
 *    成员关系必须在页面/接口的**服务端**用同一个 orgId 验，见 lib/tenant.ts。
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('notelab_session')
  const { pathname, search } = req.nextUrl

  if (!hasSession && pathname.startsWith('/org')) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // 带上回跳地址，登录后回原页（验收第 2 条）
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/org/:path*'] }
```
`lib/tenant.ts`
```ts
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

export type Member = { userId: number; orgId: string; role: 'owner' | 'admin' | 'member' }

/**
 * 服务端授权：路径里的 orgId + 会话里的 userId → 成员关系。
 * 用 React 的 cache 包一层：同一个请求里页面与子组件重复调用只查一次库。
 */
export const requireMember = cache(async (orgId: string): Promise<Member> => {
  const session = (await cookies()).get('notelab_session')?.value
  if (!session) redirect(`/login?next=/org/${orgId}`)

  const res = await fetch(`${process.env.API_BASE}/api/orgs/${orgId}/me`, {
    headers: { Cookie: `notelab_session=${session}` },
    cache: 'no-store',
  })
  if (res.status === 401) redirect(`/login?next=/org/${orgId}`)
  if (!res.ok) notFound()   // 非成员 → 404：不要返回 403 告诉攻击者「这个组织存在」
  return (await res.json()) as Member
})

export async function requireRole(orgId: string, roles: Member['role'][]): Promise<Member> {
  const me = await requireMember(orgId)
  if (!roles.includes(me.role)) notFound()
  return me
}
```
`app/org/[orgId]/orders/page.tsx`
```tsx
import { requireMember } from '@/lib/tenant'
import { listOrders } from '@/lib/orders'

export default async function OrgOrders({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  // 授权先于取数；取数函数强制要求 orgId，从类型上就写不出「不带租户的查询」
  await requireMember(orgId)
  const orders = await listOrders(orgId)
  return <OrdersTable rows={orders} />
}
```
`lib/orders.ts`
```ts
// 所有查询函数的第一个参数都是 orgId —— 这是最省事的隔离手段：
// 想把别人的数据查出来，得先改函数签名，代码评审一眼就能看见
export async function listOrders(orgId: string) {
  const res = await fetch(`${process.env.API_BASE}/api/orders?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-internal-token': process.env.INTERNAL_TOKEN! }, // 服务端间调用凭据，浏览器拿不到
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`orders ${res.status}`)
  return (await res.json()) as { id: string; amount: number }[]
}
```
`components/OrgSwitcher.tsx`
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

/** 切换组织：换路径第一段 + refresh 让服务端重新取数（不要在客户端改本地状态冒充） */
export function OrgSwitcher({ orgs, current }: { orgs: string[]; current: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        start(() => {
          router.push(`/org/${next}/orders`)
          router.refresh()
        })
      }}
    >
      {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
```
:::

## 验收脚本

:::check 可自动化部分（curl，需要两个组织的会话）+ 浏览器核对
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
: "${ORG_A:?export ORG_A=acme}"
: "${ORG_B:?export ORG_B=globex}"
: "${COOKIE_A:?export COOKIE_A='<组织A成员会话>'}"
: "${COOKIE_B:?export COOKIE_B='<组织B成员会话>'}"

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== 1. 未登录访问组织页 → 重定向到 /login 且带 next"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/org/$ORG_A/orders")
echo "Location: ${loc:-（无）}"
case "$loc" in *"/login"*"next="*) echo "PASS 跳登录并保留回跳地址" ;; *) echo "FAIL 未按预期重定向"; exit 1 ;; esac

echo "== 2. 非成员访问 → 404（不能是 403/200，别泄露组织存在性）"
c=$(code -H "Cookie: $COOKIE_A" "$BASE/org/$ORG_B/orders")
[ "$c" = "404" ] && echo "PASS 跨组织被挡" || { echo "FAIL 返回 $c —— 越权"; exit 1; }

echo "== 3. 本组织成员 → 200"
c=$(code -H "Cookie: $COOKIE_A" "$BASE/org/$ORG_A/orders")
[ "$c" = "200" ] && echo "PASS 本组织正常" || { echo "FAIL 返回 $c"; exit 1; }

echo "== 4. 接口层也要挡（绕过 UI 直接调）"
c=$(code -H "Cookie: $COOKIE_A" "$BASE/api/orgs/$ORG_B/orders")
[ "$c" = "403" ] || [ "$c" = "404" ] && echo "PASS 接口拒绝非成员（$c）" || { echo "FAIL 接口放行 $c"; exit 1; }

echo "== 5. 切换组织：设置 cookie 后首页数据跟着变"
curl -s -i -X POST "$BASE/api/orgs/switch" -H "Cookie: $COOKIE_A" \
  -H 'Content-Type: application/json' -d "{\"orgId\":\"$ORG_A\"}" | grep -i '^set-cookie' || true
```

**浏览器核对**

- [ ] 登录后回到原地址（`?next=` 生效），不是首页
- [ ] 切换组织后侧边栏与列表同时更新（不刷新页面也不残留旧数据）
- [ ] 直接改 URL 里的 orgId 打不开别人的组织
- [ ] owner/admin 能删数据，member 看不到删除按钮**且接口也拒绝**

:::

## 延伸方向

- 子域名方案：`org.example.com` + 通配证书，注意 cookie 的 `Domain`。
- 角色矩阵：把「谁能做什么」抽成配置，避免散落 if。
- 邀请与审计：成员变更留痕，邀请链接带过期时间。
