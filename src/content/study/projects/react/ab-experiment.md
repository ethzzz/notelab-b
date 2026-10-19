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

:::solution 分桶 + 会话内去重
```ts
export function bucket(userId: string, experimentId: string): "A" | "B" {
  let h = 2166136261
  const s = `${userId}:${experimentId}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100 < 50 ? "A" : "B"
}
```
```tsx
const seen = new Set<string>()

export function track(event: string, props: Record<string, unknown>) {
  const key = `${event}:${JSON.stringify(props)}`
  if (event === "exposure" && seen.has(key)) return
  if (event === "exposure") seen.add(key)

  const body = JSON.stringify({ event, props, ts: Date.now() })
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))
  } else {
    void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {})
  }
}
```
```tsx
const variant = useMemo(() => bucket(user.id, "landing-v2"), [user.id])
useEffect(() => { track("exposure", { experimentId: "landing-v2", variant }) }, [variant])
```
:::

## 延伸方向

- 多实验互斥：同一页面同时跑两个实验时，避免叠加影响结论。
- 灰度放量：从 1% 开始逐步放开，出问题能一键回滚。
- 数据对账：前端曝光数与后端收到的条数差多少。
