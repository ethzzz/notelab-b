---
title: 内容详情页与分享
route: react
direction: 内容
level: L2
weeks: 2-3
hours: 4-6
requires: react:1-2
tags: SEO, OG, 404, 首屏
summary: 每篇内容一个链接，要被搜到、分享出去有卡片、打开不白屏——这是 C 端内容的门面。
---

## 业务背景

列表页决定「点不点」，详情页决定「搜不搜得到、分享出去有没有面子」。匿名访客从搜索引擎或聊天窗口进来，第一眼看到的就是这张卡片和这个页面。

## 需求（用户故事）

- 作为访客，从搜索结果点进来能直接看到内容，而不是一个空壳加转圈。
- 作为访客，把链接发到聊天工具，能出现标题、摘要和封面。
- 作为访客，打开一个已删除的链接，能看到友好的 404 与回列表入口。

## 接口契约

```text
GET /posts/<slug>            → 详情页（SSR，含 metadata）
GET /api/posts/<slug>        → { title, summary, cover, contentHtml, publishedAt }
不存在                        → 404 页面
```

## 验收标准

- `curl -s https://站点/posts/xxx | grep -o '<title>[^<]*'` 能看到文章标题。
- 页面 HTML 里包含 `og:title` 与 `og:image`。
- 分享链接到微信/Telegram，预览卡片有标题与封面。
- 首屏 LCP < 2.5s（移动端），正文不因图片加载而跳动（CLS < 0.1）。
- 访问不存在的 slug 返回真正的 404 状态码（不是 200 的错误页）。

## 关键决策

:::hint 三个容易做错的点
1. **metadata 必须在服务端生成**：写在 `"use client"` 组件里会被忽略；用 `generateMetadata`。
2. **404 要用 `notFound()`**：返回 200 的自定义错误页会让搜索引擎把失效页面当成有效内容收录。
3. **封面图要有固定尺寸**：OG 图与页内封面都写死宽高，否则分享卡片与布局都会抖。
:::

## 参考实现

:::solution generateMetadata + notFound + 静态参数
```tsx
// src/app/(home)/posts/[slug]/page.tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"

type Post = { title: string; summary: string; cover: string; contentHtml: string }

async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`http://127.0.0.1:8001/api/posts/${slug}`, { next: { revalidate: 300 } })
  if (res.status === 404) return null
  return res.ok ? res.json() : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "文章不存在" }
  return {
    title: post.title,
    description: post.summary,
    openGraph: { title: post.title, description: post.summary, images: [{ url: post.cover, width: 1200, height: 630 }] },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <img src={post.cover} width={1200} height={630} alt="" className="w-full rounded-xl" />
      <h1 className="mt-6 text-2xl font-semibold">{post.title}</h1>
      <div className="md-body mt-4" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </article>
  )
}
```
::: 

## 延伸方向

- 相关推荐：详情页底部按标签推荐 3 篇，提高留存。
- 阅读进度与目录：长文加锚点与当前章节高亮。
- 缓存：详情内容变化不频繁，用 `revalidate` 或 ETag 降低回源。
