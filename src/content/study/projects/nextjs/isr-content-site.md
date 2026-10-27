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

:::solution 关键实现：fetch 打 tag → webhook 验签 → revalidateTag（按文章维度失效）
`lib/cms.ts`
```ts
// 缓存键就是 tag。所有读文章的地方都带同一个 tag，失效时一次搞定。
// ⚠️ 别用路径做 tag：一篇文章可能出现在详情页、列表页、sitemap 三处
export type Post = { slug: string; title: string; html: string; updatedAt: string }

const BASE = process.env.CMS_BASE!

export async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`${BASE}/posts/${slug}`, {
    // revalidate: 兜底轮询（比如运营忘配 webhook 时，最多 10 分钟也能更新）
    next: { revalidate: 600, tags: [`post:${slug}`] },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`CMS ${res.status}`)
  return (await res.json()) as Post
}

export async function listPosts(): Promise<Post[]> {
  const res = await fetch(`${BASE}/posts`, { next: { revalidate: 60, tags: ['post:list'] } })
  return res.ok ? ((await res.json()) as Post[]) : []
}
```
`app/posts/[slug]/page.tsx`
```tsx
import { notFound } from 'next/navigation'
import { getPost, listPosts } from '@/lib/cms'

// ① 构建期把已知文章全部预渲染成静态（产物是 ○/●，不是 ƒ）
export async function generateStaticParams() {
  const posts = await listPosts()
  return posts.map((p) => ({ slug: p.slug }))
}

// ② 新 slug 仍然按需生成（dynamicParams 默认 true）。想彻底禁止未收录的 slug 才设 false
export const dynamicParams = true

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  return (
    <article className="prose mx-auto max-w-3xl">
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  )
}
```
`app/api/revalidate/route.ts`
```ts
import { revalidateTag } from 'next/cache'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * CMS webhook：签名校验 → 按 slug 精确失效。
 * ⚠️ 这个路由必须自己鉴权：Next 的 route handler 不受页面守卫保护，
 *    忘了验签等于给公网一个「随便清缓存」的按钮。
 */
export async function POST(req: Request) {
  const raw = await req.text()                      // 验签要用原始 body，不能先 parse 再 stringify
  const sig = req.headers.get('x-cms-signature') ?? ''
  const expected = createHmac('sha256', process.env.REVALIDATE_SECRET!).update(raw).digest('hex')

  // 长度不等时 timingSafeEqual 会抛，先挡掉
  const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!ok) return NextResponse.json({ error: 'bad signature' }, { status: 401 })

  let body: { slug?: string; type?: string }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  if (body.slug) revalidateTag(`post:${body.slug}`)   // 单篇：1 秒内线上可见
  revalidateTag('post:list')                          // 列表页也要失效，否则首页还是旧标题

  return NextResponse.json({ revalidated: true, slug: body.slug ?? null })
}
```
`app/posts/[slug]/loading.tsx`
```tsx
// 首屏就算命中缓存未生成（按需生成）也有骨架，不会白屏
export default function Loading() {
  return <div className="mx-auto max-w-3xl animate-pulse space-y-4 py-10">
    <div className="h-8 w-2/3 rounded bg-zinc-200" />
    <div className="h-4 w-full rounded bg-zinc-100" />
    <div className="h-4 w-5/6 rounded bg-zinc-100" />
  </div>
}
```
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
