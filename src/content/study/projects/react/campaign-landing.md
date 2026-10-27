---
title: 活动落地页
route: react
direction: 增长
level: L2
weeks: 3-4
hours: 4-6
requires: react:3-4
tags: LCP, CLS, 图片, 埋点
summary: 一次投放的成败在首屏两秒内决定；图片、字体、统计脚本任何一个没管好，转化就没了。
---

## 业务背景

活动页往往是「临时赶出来的」：大图直接扔上去、统计脚本塞在 `<head>`、字体从外部 CDN 拉。上线后投放花钱买来的流量，在 3 秒白屏里流失掉。

这个项目只做一件事：**在真实网络条件下把首屏压进预算，并且能拿出数据证明。**

## 需求（用户故事）

- 作为市场，我要知道这个页面的 LCP / CLS，而不是「感觉挺快」。
- 作为访客，我在 4G 手机上 2.5 秒内看到主视觉，不出现布局跳动。
- 作为访客，统计脚本挂掉不影响页面展示。
- 作为运营，我能在断网时看到缓存的活动文案（至少不是白屏）。

## 验收标准

| 指标 | 目标 |
|---|---|
| LCP（移动端 4G） | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| 首屏 JS | < 150KB（gzip） |
| 断网 | 仍能看到标题与主视觉（缓存或内联） |

## 关键决策

:::hint 三个最常见的 LCP 杀手
1. **没有尺寸的图片** —— 加载完撑开布局，LCP 与 CLS 一起坏；
2. **外部字体阻塞** —— 字体没到文本不画，LCP 直接等字体；
3. **同步统计脚本** —— 一个 200KB 的脚本放在 `<head>`，等于把首屏推迟半秒以上。
:::

## 参考实现

:::solution 关键实现：LCP 图预加载 + 固定尺寸防 CLS + 文案缓存兜底 + 埋点旁路
`app/campaign/page.tsx`
```tsx
import { CampaignHero } from './CampaignHero'
import { getCampaignCopy } from '@/lib/campaign'

// 活动页适合 ISR：文案由运营改，页面按 tag 失效（见 nextjs 的 ISR 项目）
export const revalidate = 300

export default async function CampaignPage() {
  const copy = await getCampaignCopy('double11')
  return (
    <main>
      {/* 主视觉是 LCP 元素：用 priority + 显式尺寸，别用 CSS 背景图（无法预加载、无法提 priority） */}
      <CampaignHero copy={copy} />
      <section className="p-6">{copy.sections.map((s) => <p key={s.title}>{s.body}</p>)}</section>
    </main>
  )
}
```
`app/campaign/CampaignHero.tsx`
```tsx
import Image from 'next/image'
import type { CampaignCopy } from '@/lib/campaign'

export function CampaignHero({ copy }: { copy: CampaignCopy }) {
  return (
    <div className="relative">
      {/*
        width/height 必须给真实比例：CLS 的头号来源就是「图加载完才撑开高度」。
        sizes 决定移动端只下 1x 图，首屏 JS/图片预算才守得住。
      */}
      <Image
        src={copy.heroSrc}
        alt={copy.heroAlt}
        width={1200}
        height={720}
        priority
        sizes="(max-width: 768px) 100vw, 1200px"
        className="h-auto w-full"
      />
      <h1 className="absolute bottom-4 left-4 text-2xl font-bold text-white drop-shadow">
        {copy.title}
      </h1>
    </div>
  )
}
```
`lib/campaign.ts`
```ts
// 断网兜底：文案在服务端渲染进 HTML（不是客户端 fetch），
// 同时在客户端存一份 localStorage，二次访问即使断网也能看到标题与主视觉说明
export type CampaignCopy = {
  title: string
  heroSrc: string
  heroAlt: string
  sections: { title: string; body: string }[]
}

const CACHE_KEY = 'campaign:double11:copy'

export async function getCampaignCopy(slug: string): Promise<CampaignCopy> {
  try {
    const res = await fetch(`${process.env.CMS_BASE}/campaigns/${slug}`, { next: { tags: [`campaign:${slug}`] } })
    if (!res.ok) throw new Error(String(res.status))
    const copy = (await res.json()) as CampaignCopy
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(copy)) } catch {}
    }
    return copy
  } catch {
    // 服务端拿不到时给一个最小可用的兜底，绝不白屏
    return { title: '活动进行中', heroSrc: '/campaign/fallback.webp', heroAlt: '活动主视觉', sections: [] }
  }
}

export function readCachedCopy(): CampaignCopy | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CampaignCopy) : null
  } catch {
    return null
  }
}
```
`lib/vitals.ts`
```ts
// LCP/CLS/INP 用浏览器原生 PerformanceObserver 采，不引第三方库（省 30KB+，也省一次阻塞）
export function reportVitals(): void {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-expect-error 只有部分浏览器有 element
        const el = entry.element?.tagName ?? 'unknown'
        navigator.sendBeacon?.('/api/vitals', JSON.stringify({ name: 'LCP', value: entry.startTime, el }))
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })

    let cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })

    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        navigator.sendBeacon?.('/api/vitals', JSON.stringify({ name: 'CLS', value: cls }))
      }
    })
  } catch {
    // 采集失败不影响页面
  }
}
```
:::

## 验收脚本

:::check 可自动化部分（curl）+ 浏览器核对清单
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
PAGE="${PAGE:-/landing}"

echo "== 1. 首屏 HTML 必须自带标题与主视觉（不能等 JS）"
curl -s "$BASE$PAGE" | grep -o '<title>[^<]*' | head -1
curl -s "$BASE$PAGE" | grep -o 'property="og:image"[^>]*' | head -1

echo "== 2. 首字节与总耗时"
for i in 1 2 3; do
  curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}B\n' "$BASE$PAGE"
done

echo "== 3. 关键资源：主视觉图应是 next/image 优化过的（不是原始大图）"
curl -s "$BASE$PAGE" | grep -o '/_next/image[^"]*' | head -1 || echo "（没看到 /_next/image，检查是否直接用了 <img src>）"

echo "== 4. 表单/CTA 的接口可达"
curl -s -o /dev/null -w 'submit -> %{http_code}\n' -X POST "$BASE/api/leads" \
  -H 'Content-Type: application/json' -d '{"phone":"13800000000","source":"landing"}'
```

**浏览器核对**

- [ ] 375px 下主视觉与 CTA 都在首屏内，不横向滚动
- [ ] 图片 `priority` 生效（Network 里首屏图不是 lazy）
- [ ] Lighthouse 移动端 LCP < 2.5s、CLS < 0.1
- [ ] 第三方脚本（统计）不阻塞主线程（Performance 里长任务 < 50ms）

:::

## 延伸方向

- A/B：两版主视觉按用户分桶，用同一套埋点对比转化。
- 多语言：文案外置，首屏只加载当前语言。
- 预渲染：活动内容变化不频繁时，构建期生成静态页，进一步压首屏。
