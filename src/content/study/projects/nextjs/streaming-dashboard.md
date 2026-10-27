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

:::solution 关键实现：RSC 分区 + Suspense 骨架 + 每块自己的错误边界
`app/dashboard/page.tsx`
```tsx
import { Suspense } from 'react'
import { FastStats, SlowMetrics, RevenueChart } from './cards'
import { CardSkeleton, CardErrorBoundary } from './ui'

/**
 * 流式的关键：页面本身**不 await 任何慢数据**，只把慢组件包进 Suspense。
 * 这样首屏 HTML 立刻流出（含三块骨架），慢块随后各自补上 —— 验收里的 TTFB < 800ms 靠这个。
 * ⚠️ 不要在页面顶层 await 三个 fetch 再分发：那等于退回成「全页等最慢的一个」。
 */
export default function Dashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Suspense fallback={<CardSkeleton rows={2} />}>
        <FastStats />
      </Suspense>

      <Suspense fallback={<CardSkeleton rows={2} />}>
        <SlowMetrics />
      </Suspense>

      <Suspense fallback={<CardSkeleton rows={4} />}>
        {/* 每块独立错误边界：一块挂了只影响自己那一格 */}
        <CardErrorBoundary title="营收构成">
          <RevenueChart />
        </CardErrorBoundary>
      </Suspense>
    </div>
  )
}
```
`app/dashboard/cards.tsx`
```tsx
// 服务端组件：这里才 await 慢接口。三块各取各的，互不阻塞
export async function SlowMetrics() {
  // 慢接口自己要有超时，否则它挂住会让这一格永远停在骨架
  const res = await fetch(`${process.env.API_BASE}/metrics/slow`, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`metrics ${res.status}`)
  const data = (await res.json()) as { pv: number; uv: number }
  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-sm text-zinc-500">今日流量</h2>
      <p className="text-2xl font-semibold">{data.pv}</p>
      <p className="text-xs text-zinc-500">UV {data.uv}</p>
    </section>
  )
}

export async function FastStats() {
  const res = await fetch(`${process.env.API_BASE}/metrics/fast`, { next: { revalidate: 10 } })
  const d = (await res.json()) as { orders: number }
  return <section className="rounded-xl border p-4">订单 {d.orders}</section>
}
```
`app/dashboard/ui.tsx`
```tsx
'use client'
import { Component, type ReactNode } from 'react'

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border p-4">
      <div className="h-3 w-1/3 rounded bg-zinc-200" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-zinc-100" />
      ))}
    </div>
  )
}

/**
 * 局部错误边界必须是客户端组件（class）。
 * 没有它，任一 RSC 抛错会冒到最近的 error.tsx —— 而 error.tsx 是**整页**替换，
 * 一块失败就把其他两块已经渲染好的数据也干掉了。
 */
export class CardErrorBoundary extends Component<{ title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="rounded-xl border border-red-200 p-4">
          <p className="text-sm text-red-600">{this.props.title} 加载失败</p>
          <button className="mt-2 text-sm underline" onClick={() => this.setState({ failed: false })}>
            重试
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl，用 TTFB 证明流式）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"

echo "== 1. 连续三次采样 TTFB 与总耗时"
for i in 1 2 3; do
  curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}s  total=%{time_total}s\n' "$BASE/dashboard"
done

echo "== 2. 判定：TTFB 必须小于总耗时的一半（否则说明页面在顶层 await 了慢数据）"
read -r ttfb total < <(curl -s -o /dev/null -w '%{time_starttransfer} %{time_total}' "$BASE/dashboard")
awk -v a="$ttfb" -v b="$total" 'BEGIN { exit !(a < b * 0.5) }' \
  && echo "PASS ttfb=${ttfb}s < total=${total}s" \
  || { echo "FAIL ttfb=${ttfb}s 接近 total=${total}s：慢数据没有被 Suspense 下沉"; exit 1; }

echo "== 3. HTML 分块到达（流式）"
curl -sN "$BASE/dashboard" | head -c 400; echo

echo "== 4. 慢块失败只影响自己：临时把 /api/stats/trend 改成 500，刷新页面看其余两块是否正常"
```
:::

## 延伸方向

- 加「刷新」按钮：`router.refresh()` 只重取服务端数据，不整页重载。
- 慢块的降级：超时后先给缓存值 + 「数据可能不是最新」提示。
- 把三块拆到并行路由，支持独立 URL 分享。
