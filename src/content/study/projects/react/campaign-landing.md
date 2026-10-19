---
title: 活动落地页
route: react
direction: 增长
level: L2
weeks: 3-4
hours: 4-6
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

:::solution 图片、字体、脚本三件事
```tsx
// 1) 主视觉：给定尺寸 + 优先加载（首屏图不要 lazy）
<img
  src="/campaign/hero.webp"
  width={1200}
  height={600}
  fetchPriority="high"
  decoding="async"
  alt="活动主视觉"
/>

// 2) 字体：swap + 预加载
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
```
```css
@font-face { font-family: Inter; src: url(/fonts/inter.woff2) format("woff2"); font-display: swap; }
```
```tsx
// 3) 统计：首屏之后执行，且失败不影响页面
import Script from "next/script"
<Script src="/analytics.js" strategy="afterInteractive" onError={() => {}} />
```
:::

:::error 上线后才发现的问题
```text
Lighthouse：LCP 4.2s，LCP 元素是「一张背景图 + 一段标题」
```
**原因**：背景图写在 CSS 里，浏览器要等 CSS 解析完才发现它，优先级也低。
**改法**：首屏主视觉改成 `<img>` 并给 `fetchPriority="high"`；装饰性背景图延后或内联为渐变。
:::

## 延伸方向

- A/B：两版主视觉按用户分桶，用同一套埋点对比转化。
- 多语言：文案外置，首屏只加载当前语言。
- 预渲染：活动内容变化不频繁时，构建期生成静态页，进一步压首屏。
