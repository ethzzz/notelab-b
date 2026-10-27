---
title: 内容列表与筛选
route: react
direction: 内容
level: L2
weeks: 5-6
hours: 4-6
requires: react:5-6
tags: URL 状态, 分页, 空态, 弱网
summary: 一个「看起来最简单」的列表页，考的是 URL 即状态、三态齐全、弱网可用。
---

## 业务背景

内容列表是 C 端最高频的页面，也是最容易被做坏的页面：筛选条件存在组件里，一刷新就没了；翻页用 state，分享出去的链接永远是第一页；接口失败只显示空白。

这些在内部后台无所谓，在 C 端就是「用户流失」。

## 需求（用户故事）

- 作为访客，我筛选「工具 + 第 2 页」后，把链接发给朋友，他打开看到的是同样的筛选。
- 作为访客，我按浏览器后退，能回到上一组筛选，而不是退出页面。
- 作为访客，网络断了我要看到「加载失败，重试」，而不是一片空白。
- 作为手机用户，我在 375px 宽度下不横向滚动。

## 接口契约

```text
GET /api/posts?cat=tool&page=2&q=xxx
→ 200 { items: [{id,title,summary}], total: 128, page: 2, pageSize: 20 }
→ 500/超时 → 前端展示错误态
```

URL 约定：

| 参数 | 含义 | 默认 |
|---|---|---|
| `cat` | 分类 | `all` |
| `page` | 页码（1 起） | `1` |
| `q` | 搜索词 | 空 |

## 验收标准

- 刷新后筛选与页码保持不变。
- 复制 URL 到新标签页，内容一致。
- 浏览器后退一次回到上一个筛选组合。
- 断网时显示错误态与「重试」，重试成功后恢复。
- 空结果显示空态文案，而不是空白。
- 375px 无横向滚动；`document.documentElement.scrollWidth <= innerWidth`。

## 关键决策

:::hint 为什么状态一定要进 URL
URL 是唯一同时满足「可分享、可刷新、可后退」的状态载体。放组件 state 里，这三件事全废；放全局 store 里，刷新依然会丢。
:::

## 参考实现

:::solution 关键实现：URL 是唯一状态源 + 三态渲染 + 竞态丢弃
`hooks/useListQuery.ts`
```ts
'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export type ListQuery = { cat: string; page: number; keyword: string }

/**
 * 列表筛选状态全部放 URL：
 *   · 分享链接天然可用（验收第 1、2 条）
 *   · 浏览器后退天然可用（验收第 3 条）—— 用 state 就得自己同步 history，几乎必错
 * ⚠️ 用 replace 还是 push：筛选变化用 push（要能后退），只改分页页码也用 push，
 *    但如果只是「滚动加载追加」就不能 push，否则后退一屏一屏退。
 */
export function useListQuery(): [ListQuery, (patch: Partial<ListQuery>) => void] {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const query = useMemo<ListQuery>(() => ({
    cat: sp.get('cat') ?? 'all',
    // 页码要做边界处理：URL 里被手改成 0 或负数时不能把接口打坏
    page: Math.max(1, Number(sp.get('page') ?? '1') || 1),
    keyword: sp.get('q') ?? '',
  }), [sp])

  const setQuery = useCallback((patch: Partial<ListQuery>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      const key = k === 'cat' ? 'cat' : k === 'page' ? 'page' : 'q'
      if (v === undefined || v === '' || (k === 'page' && v === 1)) next.delete(key)
      else next.set(key, String(v))
    }
    // 改筛选时把页码归 1，否则会停留在不存在的页（空列表 + 页码 7）
    if ('cat' in patch || 'keyword' in patch) next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }, [sp, router, pathname])

  return [query, setQuery]
}
```
`hooks/useListData.ts`
```ts
'use client'
import { useEffect, useRef, useState } from 'react'
import type { ListQuery } from './useListQuery'

type State<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; items: T[]; total: number }

export function useListData<T>(query: ListQuery) {
  const [state, setState] = useState<State<T>>({ kind: 'loading' })
  // 竞态守卫：快速切筛选时，先发的请求可能后回来，用序号丢弃过期响应
  const seq = useRef(0)

  useEffect(() => {
    const mine = ++seq.current
    const ac = new AbortController()
    setState({ kind: 'loading' })

    fetch(`/api/posts?cat=${query.cat}&page=${query.page}&q=${encodeURIComponent(query.keyword)}`, {
      signal: ac.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ items: T[]; total: number }>
      })
      .then((j) => {
        if (mine !== seq.current) return          // 过期响应，直接丢
        setState(j.items.length === 0 ? { kind: 'empty' } : { kind: 'ready', ...j })
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ kind: 'error', message: '加载失败，请检查网络' })
      })

    return () => ac.abort()
  }, [query.cat, query.page, query.keyword])

  return state
}
```
`components/ContentList.tsx`
```tsx
'use client'
// 三态必须显式渲染：空白页是「还在加载」和「真的没有」混在一起，用户无法判断
export function ContentList({ query, setQuery }: { query: ListQuery; setQuery: (p: Partial<ListQuery>) => void }) {
  const state = useListData<{ id: string; title: string }>(query)

  if (state.kind === 'loading') return <ListSkeleton />
  if (state.kind === 'error') {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-600">{state.message}</p>
        <button className="mt-3 rounded border px-3 py-1.5" onClick={() => setQuery({ page: query.page })}>
          重试
        </button>
      </div>
    )
  }
  if (state.kind === 'empty') {
    return <p className="p-8 text-center text-zinc-500">没有匹配的内容，试试换个分类或清空关键词</p>
  }

  return (
    // 375px 不横向滚动：容器 max-w-full + 子项 min-w-0，长标题用 truncate 而不是撑开
    <ul className="w-full max-w-full divide-y">
      {state.items.map((it) => (
        <li key={it.id} className="flex min-w-0 items-center justify-between py-3">
          <span className="min-w-0 truncate">{it.title}</span>
          <a className="ml-3 shrink-0 text-sm text-blue-600" href={`/posts/${it.id}`}>查看</a>
        </li>
      ))}
    </ul>
  )
}
```
`app/posts/page.tsx`
```tsx
// useSearchParams 在预渲染页面里必须包 Suspense，否则构建期报错
export default function PostsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PostsClient />
    </Suspense>
  )
}
```
:::

## 验收脚本

:::check 可自动化部分（curl）+ 浏览器核对清单
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"

echo "== 1. URL 是唯一状态源：每个地址都要能直接分享"
for u in '/posts' '/posts?cat=tool' '/posts?cat=tool&page=2' '/posts?q=react'; do
  code=$(curl -s -o /tmp/nl.html -w '%{http_code}' "$BASE$u")
  [ "$code" = "200" ] || { echo "FAIL $u -> $code"; exit 1; }
  grep -q '<title>' /tmp/nl.html && echo "PASS $u（含 title）" || { echo "FAIL $u 没渲染出内容"; exit 1; }
done

echo "== 2. 首屏内容必须在 HTML 里（不能是纯客户端空壳）"
n=$(curl -s "$BASE/posts?cat=tool" | grep -c 'class="post-item"' || true)
[ "$n" -gt 0 ] && echo "PASS SSR 出 $n 条" || echo "FAIL 首屏无内容：应改为服务端取数"

echo "== 3. 翻页越界不应 500"
curl -s -o /dev/null -w 'page=9999 -> %{http_code}\n' "$BASE/posts?page=9999"
```

**浏览器核对（脚本覆盖不到的）**

- [ ] 改筛选 / 翻页后**刷新页面**，视图不丢
- [ ] 浏览器**后退**，回到上一组筛选（不是空列表）
- [ ] 复制地址发给同事，对方打开看到同一批数据
- [ ] 筛出 0 条时有空状态与「清除筛选」
- [ ] 375px 宽下不出现横向滚动

:::

## 延伸方向

- 无限滚动：用 `IntersectionObserver` 触底加载，同时保证 URL 仍可分享。
- 预取：hover 卡片时预取详情，提升点击后的体感。
- 搜索防抖：输入 300ms 后再改 URL，避免每敲一个字都发请求。
