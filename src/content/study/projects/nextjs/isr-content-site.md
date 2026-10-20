---
title: ISR 内容站与按需失效
route: nextjs
direction: 内容
level: L3
weeks: 4-5
hours: 6-8
requires: nextjs:3-4
tags: ISR, revalidateTag, webhook, 缓存
summary: 内容站要「静态快」又要「改了立刻可见」；答案不是 SSR，而是 tag 精准失效。
---

## 业务背景

内容站用 SSR 每次回源太慢，用纯静态又改不动。Next 的 ISR 能在后台重新生成，但如果只按时间间隔刷新，运营发一篇文章要等 5 分钟才可见——这不可接受。

正确做法：**静态生成 + 按 tag 失效**，内容系统发布时调一个 webhook。

## 需求（用户故事）

- 作为访客，文章页首屏从 CDN 直接返回，速度接近静态。
- 作为运营，我发布/修改文章后，线上 1 秒内可见。
- 作为开发，我能按「文章」维度失效，而不是全站重建。
- 作为运维，webhook 被伪造时要拒绝。

## 接口契约

```text
GET  /posts/[slug]            静态/ISR 页面
POST /api/revalidate          {slug, signature} → {ok:true}
GET  /api/posts/[slug]        数据源（内部）
```

## 验收标准

- 文章页构建产物是 `○` 或 `●`（静态），不是 `ƒ`。
- 调一次 webhook 后 1 秒内页面更新（无需重新部署）。
- 签名错误返回 401，且不触发失效。
- 未收录的新 slug 能按需生成（`dynamicParams` 默认行为）。

## 关键决策

:::hint tag 打在 fetch 上，不是页面上
`revalidateTag` 失效的是「带这个 tag 的数据缓存」。所以每个 `fetch` 都要打上能表达数据维度的 tag（`post:slug`、`posts:list`），页面自然跟着更新。只给页面加 `revalidate` 是时间驱动，不是事件驱动。
:::

## 参考实现

:::solution 数据层打 tag + webhook 失效
```ts
// lib/posts.ts
export async function getPost(slug: string) {
  const res = await fetch(`${CMS}/posts/${slug}`, {
    next: { tags: [`post:${slug}`, "posts:list"] },
  })
  if (res.status === 404) return null
  return res.json()
}
```
```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache"
import { createHmac, timingSafeEqual } from "node:crypto"

function verify(body: string, sig: string) {
  const expected = createHmac("sha256", process.env.CMS_SECRET!).update(body).digest("hex")
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get("x-signature") ?? ""
  if (!verify(raw, sig)) return new Response("bad signature", { status: 401 })

  const { slug } = JSON.parse(raw)
  revalidateTag(`post:${slug}`)
  revalidateTag("posts:list")
  return Response.json({ ok: true })
}
```
```tsx
// app/posts/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post?.title ?? "文章不存在" }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  return <article><h1>{post.title}</h1><div dangerouslySetInnerHTML={{ __html: post.html }} /></article>
}
```
:::

:::error 改了内容但线上没变，怎么查
按顺序排除：① CDN/反代是否缓存了 HTML；② 页面是不是被 `cookies()`/`searchParams` 变成了动态（那就不该走 ISR）；③ `fetch` 有没有打 tag；④ webhook 是否真的到达（看 handler 日志）；⑤ 是否调用了 `revalidateTag` 但 tag 拼错（不报错，只是没生效）。
:::

## 验收脚本

:::check 复制即用（bash + curl + openssl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
SLUG="${SLUG:-hello}"
SECRET="${CMS_SECRET:?先 export CMS_SECRET=<与 webhook 一致的密钥>}"

echo "== 1. 详情页应是静态/ISR（能看到缓存头），而不是每次回源"
curl -sI "$BASE/posts/$SLUG" | grep -iE '^(x-nextjs-cache|cache-control|age):' \
  || echo "（没有缓存头：检查是否用了 cookies()/searchParams 把路由变成动态）"

BODY="{\"slug\":\"$SLUG\"}"

echo "== 2. 错误签名 → 401，且不触发失效"
code=$(curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE/api/revalidate" \
  -H 'Content-Type: application/json' -H 'x-signature: bad' -d "$BODY")
[ "$code" = "401" ] && echo "PASS 坏签名被拒绝" || { echo "FAIL 坏签名返回 $code"; cat /tmp/nl.body; exit 1; }

echo "== 3. 正确签名 → 200"
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
before=$(curl -s "$BASE/posts/$SLUG" | grep -o '<title>[^<]*' | head -1)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/revalidate" \
  -H 'Content-Type: application/json' -H "x-signature: $SIG" -d "$BODY")
[ "$code" = "200" ] || { echo "FAIL 正确签名返回 $code"; exit 1; }

echo "== 4. 1 秒内页面应更新"
sleep 1
after=$(curl -s "$BASE/posts/$SLUG" | grep -o '<title>[^<]*' | head -1)
printf '改前 %s\n改后 %s\n' "$before" "$after"
echo "（人工核对 title 是否变成新内容；没变就按「常见报错」那五步排查）"
```
:::

## 延伸方向

- 列表页分页也按 tag 失效（`posts:list:page:2`）。
- 标签页/作者页共用同一批 tag，避免漏更新。
- 与搜索索引联动：失效后异步推一次索引更新。
