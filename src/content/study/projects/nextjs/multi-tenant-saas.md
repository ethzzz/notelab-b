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

:::solution 路由 + middleware + 三层守卫
```ts
// middleware.ts：只做登录重定向
export function middleware(req: NextRequest) {
  if (!req.cookies.get("session")) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}
export const config = { matcher: ["/org/:path*"] }
```
```tsx
// app/org/[orgId]/layout.tsx：组织级守卫（这里才能查库）
export default async function OrgLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const user = await requireUser()
  const member = await db.member.findUnique({ where: { orgId_userId: { orgId, userId: user.id } } })
  if (!member) notFound()                       // 不暴露「存在但不属于你」
  return <OrgShell org={member.org} role={member.role}>{children}</OrgShell>
}
```
```ts
// 数据层：查询强制带 orgId，且 id 与 orgId 一起作为条件
export async function listOrders(orgId: string, page = 1) {
  return db.order.findMany({ where: { orgId }, skip: (page - 1) * 20, take: 20 })
}

export async function getOrder(orgId: string, id: string) {
  return db.order.findFirst({ where: { id, orgId } })   // 别人的 id 查不到
}
```
```ts
// 接口层：Route Handler 再判一次角色
export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const member = await requireMember(orgId)
  if (!["owner", "admin"].includes(member.role)) return new Response("forbidden", { status: 403 })
  ...
}
```
:::

:::error 切换组织后数据没变
**现象**：点了切换，侧边栏变了，列表还是旧组织的数据。
**原因**：列表是客户端组件里 `useEffect` 拉的一次数据，组织变了但没重新请求；或者路由缓存命中了旧参数。
**改法**：把数据获取放回服务端组件（`params` 变化会重新渲染），客户端只保留交互；必要时 `router.refresh()`。
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
