---
title: A/B 实验与埋点
route: react
direction: 增长
level: L3
weeks: 8-9
hours: 4-6
requires: react:7-8
tags: 分桶, 埋点, 不阻塞, 去重
summary: 两版页面分流、曝光与点击可分析；最怕的是「埋点拖慢页面」和「同一个人来回换组」。
---

## 业务背景

增长团队要对比两版落地页的转化率。技术上要保证：同一个人始终在同一组、埋点不影响页面、数据能对账。任何一条没做到，实验结果都不可信。

## 需求（用户故事）

- 作为增长，同一个用户在实验期内始终看到同一版。
- 作为前端，统计脚本失败或超时都不能影响页面渲染。
- 作为数据，曝光只在首次进入时上报一次，点击按次数上报。

## 接口契约

```text
分桶：bucket = hash(userId + experimentId) % 100
  0-49  → A 组
  50-99 → B 组

埋点：POST /api/track  {event, props, ts}
  失败不影响页面；用 sendBeacon 保证离页也能发出去
```

## 验收标准

- 同一 `userId` 反复刷新，始终落同一组。
- 不同 `userId` 大致均匀（1000 个 id 分桶偏差 < 5%）。
- 断网时页面正常渲染，埋点失败不报错、不阻塞。
- 曝光事件同一会话只发一次（刷新页面算新会话）。
- 埋点数据能按 `experimentId + variant` 聚合出曝光与点击。

## 关键决策

:::hint 三个容易翻车的点
1. **分桶必须稳定**：用「用户 id + 实验 id」做哈希，不能用随机数或时间——否则同一个人每次刷新都换组，实验结论直接作废。
2. **埋点不能阻塞渲染**：别在渲染路径里 `await fetch`；用 `navigator.sendBeacon` 或 `afterInteractive` 脚本。
3. **曝光要按会话去重**：每次滚动都上报会让曝光数虚高。
:::

## 参考实现

:::solution 关键实现：稳定分桶 + 曝光去重 + 上报永不阻塞渲染
`lib/experiment.ts`
```ts
// 分桶必须满足三条：同 userId 稳定、分布均匀、不依赖后端（后端挂了也要能分）。
// 用 FNV-1a 把 `实验盐 + userId` 压成 0..9999 —— 加盐是为了不同实验不落在同一批人身上。
function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export type Variant = 'control' | 'treatment'

export type Experiment = {
  id: string
  /** 实验流量占比 0..100；只有落进实验的才分 control/treatment */
  traffic: number
  /** 对照组占比，通常 50 */
  split: number
}

/** 纯函数：同样的 (userId, exp) 永远得到同样的结果，刷新/多标签页都一致 */
export function assign(userId: string, exp: Experiment): Variant | null {
  const bucket = fnv1a(`${exp.id}:${userId}`) % 10000
  if (bucket >= exp.traffic * 100) return null // 不在实验流量里
  return bucket % 100 < exp.split ? 'control' : 'treatment'
}
```
`lib/track.ts`
```ts
// 埋点三条纪律：不抛错、不等待、不阻塞渲染。
// sendBeacon 在页面卸载时也能发出；后端不可用时静默丢弃（绝不能让统计把页面搞崩）。
type Payload = Record<string, string | number | boolean>

export function track(event: string, props: Payload, dedupeKey?: string): void {
  try {
    if (dedupeKey && seen.has(dedupeKey)) return
    if (dedupeKey) seen.add(dedupeKey)

    const body = JSON.stringify({ event, props, ts: Date.now(), url: location.pathname })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/collect', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/collect', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // 统计失败与业务无关，吞掉
  }
}

/** 同一次会话内的曝光去重（刷新页面 = 新会话，会重新上报一次） */
const seen = new Set<string>()
```
`hooks/useExperiment.ts`
```tsx
'use client'
import { useEffect, useMemo } from 'react'
import { assign, type Experiment, type Variant } from '@/lib/experiment'
import { track } from '@/lib/track'

/**
 * 用法：const variant = useExperiment(EXP_CHECKOUT, userId)
 * 曝光在 effect 里上报 —— 不能在 render 里发请求（StrictMode 会双跑、并发渲染会重复）。
 */
export function useExperiment(exp: Experiment, userId: string | null): Variant | null {
  const variant = useMemo(() => (userId ? assign(userId, exp) : null), [userId, exp])

  useEffect(() => {
    if (!variant) return
    // dedupeKey 用 sessionStorage 语义的 Set（模块级）：
    // 同一会话内重复挂载不会重复上报，刷新后是新会话，会再报一次
    track('experiment_exposure', { experimentId: exp.id, variant }, `exp:${exp.id}:${variant}`)
  }, [exp.id, variant])

  return variant
}
```
`components/CheckoutButton.tsx`
```tsx
// 实验组差异只体现在文案与顺序这类可灰度的东西上，不要用它改业务主流程
export function CheckoutButton({ variant }: { variant: Variant | null }) {
  const label = variant === 'treatment' ? '立即下单 · 免运费' : '提交订单'
  return (
    <button
      onClick={() => {
        track('checkout_click', { variant: variant ?? 'none' }) // 点击按次数上报：不去重
        location.href = '/checkout'
      }}
    >
      {label}
    </button>
  )
}
```
:::

## 验收脚本

:::check 分桶用 Node 验（纯函数），埋点用 curl 验
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"

echo "== 1. 分桶稳定性与均匀性"
node -e '
const bucket = (uid, exp) => {
  let h = 2166136261
  for (const ch of `${uid}:${exp}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0) % 100 < 50 ? "A" : "B"
}
const once = bucket("u1", "landing-v2")
const same = Array.from({ length: 100 }, () => bucket("u1", "landing-v2"))
if (new Set(same).size !== 1) { console.error("FAIL 同一用户来回换组"); process.exit(1) }
console.log(`PASS 同一用户稳定在 ${once} 组`)
let a = 0
for (let i = 0; i < 1000; i++) if (bucket("u" + i, "landing-v2") === "A") a++
const dev = Math.abs(a - 500) / 500
console.log(`A=${a} B=${1000 - a} 偏差=${(dev * 100).toFixed(1)}%`)
if (dev > 0.05) { console.error("FAIL 分桶不均匀（>5%）"); process.exit(1) }
'

echo "== 2. 埋点接口可达（失败也不能影响页面，这条只看服务端收不收）"
curl -s -o /dev/null -w 'track -> %{http_code}\n' -X POST "$BASE/api/track" \
  -H 'Content-Type: application/json' \
  -d '{"event":"exposure","props":{"experimentId":"landing-v2","variant":"A"},"ts":0}'

echo "== 3. 断网时页面仍渲染（人工）"
echo "   DevTools → Network → Offline → 刷新：页面应正常显示，控制台无未捕获异常"
```

**浏览器核对**

- [ ] 同一用户刷新 10 次，看到的版本不变
- [ ] 曝光同一会话只上报一次（Network 里只有一条 exposure）
- [ ] 埋点请求失败（拦截 `/api/track`）时页面无报错
- [ ] 聚合面板能按 `experimentId + variant` 出曝光与点击

:::

## 延伸方向

- 多实验互斥：同一页面同时跑两个实验时，避免叠加影响结论。
- 灰度放量：从 1% 开始逐步放开，出问题能一键回滚。
- 数据对账：前端曝光数与后端收到的条数差多少。
