---
title: 下单流程前端
route: react
direction: 交易
level: L2
weeks: 3-4
tags: 幂等, 防重复提交, 库存展示, 错误映射
summary: 用户手抖点两下、网络超时重试、返回再提交——前端要保证「一单就是一单」。
---

## 业务背景

后端做了幂等，前端仍然会制造重复单：按钮连点、超时后重试、从订单页返回再提交一次。前端要做的是**生成并复用同一个 requestId**，而不是每次点击都生成新的。

## 需求（用户故事）

- 作为买家，我点两下「提交订单」，只会生成一单，也只扣一次库存。
- 作为买家，我网络超时后点重试，不会重复下单。
- 作为买家，库存为 0 时按钮是禁用的，并说明原因。
- 作为买家，提交失败时我知道是「库存不足」还是「网络问题」。

## 接口契约

```text
POST /api/orders  {sku, qty, requestId}
  → 201 {orderId}         成功
  → 200 {orderId}         重复提交（同一 requestId）
  → 409 {error:"库存不足"}
  → 4xx/5xx               其他
```

**requestId 在进入页面时生成一次**，存在 `sessionStorage`（同一个下单流程复用）；订单成功后清除。

## 验收标准

- 连点 5 次「提交」：只有一次请求（或多次请求同 requestId），最终只有一单。
- 超时后点「重试」：仍是同一个 requestId，后端返回同一单。
- 刷新页面后重新下单：生成新的 requestId（不能复用上一单的）。
- 库存 0：按钮禁用 + 文案「已售罄」。
- 409：提示「库存不足」，而不是「系统错误」。

## 关键决策

:::hint requestId 的生命周期
- 进入下单页生成一次 → 整个提交流程复用；
- 提交成功后清除 → 下一单重新生成；
- **不要**每次点击都 `crypto.randomUUID()`，那等于没有幂等。
:::

## 参考实现

:::solution requestId + 提交锁 + 错误映射
```tsx
const KEY = `order-req-${sku}`

function getRequestId() {
  const saved = sessionStorage.getItem(KEY)
  if (saved) return saved
  const id = crypto.randomUUID()
  sessionStorage.setItem(KEY, id)
  return id
}

const [submitting, setSubmitting] = useState(false)

async function submit() {
  if (submitting) return
  setSubmitting(true)
  try {
    const res = await apiJson<{ orderId: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({ sku, qty, requestId: getRequestId() }),
    })
    sessionStorage.removeItem(KEY)          // 成功后才清
    router.push(`/orders/${res.orderId}`)
  } catch (e) {
    message.error(toMessage(e))             // 409 → 库存不足；网络 → 请检查网络
  } finally {
    setSubmitting(false)
  }
}

<button disabled={stock === 0 || submitting} onClick={submit}>
  {stock === 0 ? "已售罄" : submitting ? "提交中…" : "提交订单"}
</button>
```
:::

## 延伸方向

- 支付超时回跳：回到订单页时识别「已支付」，避免二次下单。
- 多商品车：每个 sku 一个 requestId，或整单一个。
- 弱网：提交中显示进度，失败给「查看订单」入口（可能已经成功）。
