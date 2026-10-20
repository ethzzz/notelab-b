---
title: 流式仪表盘
route: nextjs
direction: 数据
level: L3
weeks: 3-4
hours: 6-8
requires: nextjs:3-4
tags: RSC, Suspense, 流式, 骨架
summary: 一个页面里三块数据快慢差异巨大：让快的先出、慢的流式补上，而不是一起等最慢的那个。
---

## 业务背景

运营看板通常由多个来源拼成：实时指标（快）、报表汇总（慢，3–8 秒）、明细列表（中等）。如果页面顶层 `await` 全部数据，首屏就被最慢的那块拖住，TTFB 与 LCP 一起爆炸。

## 需求（用户故事）

- 作为运营，我打开看板 1 秒内能看到框架和前两块数据。
- 作为运营，慢的汇总块单独显示骨架，加载完自己补上。
- 作为运营，某一块失败时只影响那一块，其他照常显示。

## 接口契约

```text
GET /api/stats/summary?range=7d    → 快（<200ms）
GET /api/stats/trend?range=30d     → 慢（3–8s）
GET /api/stats/orders?page=1       → 中（500ms）
```

## 验收标准

- 首屏 TTFB < 800ms（不等慢接口）。
- 三块各自有骨架，互不阻塞。
- 慢接口失败只让该块显示错误 + 重试，不影响其他块。
- 用 Network 面板能看到 HTML 分多次到达（流式）。

## 关键决策

:::hint 流式的前提是「别在顶层 await」
把每块数据下沉到自己的服务端组件里，外面用 `<Suspense>` 包住；顶层只做布局。另外别在 layout 里 `await` 慢数据——那会把所有子页面一起拖住。
:::

## 参考实现

:::solution 页面 + 三个数据块
```tsx
// app/dashboard/page.tsx
import { Suspense } from "react"

export default function Dashboard() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">运营看板</h1>

      <Suspense fallback={<Skeleton h={120} />}>
        <Summary range="7d" />
      </Suspense>

      <Suspense fallback={<Skeleton h={280} />}>
        <Trend range="30d" />
      </Suspense>

      <Suspense fallback={<Skeleton h={360} />}>
        <Orders />
      </Suspense>
    </main>
  )
}
```
```tsx
// 每块自己取数、自己兜错，互不影响
async function Trend({ range }: { range: string }) {
  try {
    const data = await getTrend(range)      // 慢接口，带 revalidate
    return <TrendChart data={data} />
  } catch {
    return <ErrorBox text="趋势数据加载失败" />
  }
}
```
```ts
// 快接口用较短 revalidate，慢接口用较长
export const getSummary = () => fetch(`${API}/stats/summary?range=7d`, { next: { revalidate: 30 } }).then(r => r.json())
export const getTrend = () => fetch(`${API}/stats/trend?range=30d`, { next: { revalidate: 300 } }).then(r => r.json())
```
:::

:::hint 为什么不用一个 loading.tsx 了事
`loading.tsx` 是**整个路由**的兜底：它会让整页先显示骨架，等所有数据就绪才替换。而 Suspense 是**按块**的，快的先出——这才是流式。
:::

## 延伸方向

- 加「刷新」按钮：`router.refresh()` 只重取服务端数据，不整页重载。
- 慢块的降级：超时后先给缓存值 + 「数据可能不是最新」提示。
- 把三块拆到并行路由，支持独立 URL 分享。
