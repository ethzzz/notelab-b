---
title: 下单流程前端
route: react
direction: 交易
level: L2
weeks: 3-4
hours: 4-6
requires: react:3-4
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

:::solution 关键实现：requestId 一次一单 + 在途守卫 + 错误码映射
`hooks/useCheckout.ts`
```ts
'use client'
import { useCallback, useRef, useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/** 失败原因必须能落到「可行动」的文案上，不能一律「系统错误」 */
export type CheckoutError = 'OUT_OF_STOCK' | 'NETWORK' | 'SERVER' | 'UNKNOWN'

const newRequestId = () =>
  // 优先用 crypto.randomUUID；老浏览器退回时间戳 + 随机串（同一毫秒也不会撞）
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function useCheckout(sku: string) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<CheckoutError | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  // 两个 ref 是关键：
  //   requestId  —— 一单一个，重试复用、成功后换新；刷新页面会重新生成（满足验收第 3 条）
  //   inFlight   —— 同步守卫。只用 state 判 loading 会有「点两次都在同一个事件循环里读不到新状态」的窗口
  const requestId = useRef<string>(newRequestId())
  const inFlight = useRef(false)

  const submit = useCallback(async () => {
    if (inFlight.current) return            // 连点 5 次：只有第一次发请求
    inFlight.current = true
    setStatus('submitting')
    setError(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, qty: 1, requestId: requestId.current }),
        // 超时要有上限，否则网络半断时按钮永远转圈
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        const j = (await res.json()) as { orderId: string }
        setOrderId(j.orderId)
        setStatus('success')
        requestId.current = newRequestId()  // 成功后才能换：失败重试必须复用同一个 id
        return
      }
      // 409 = 库存不足（业务冲突），503/500 才是系统问题；两者文案完全不同
      setError(res.status === 409 ? 'OUT_OF_STOCK' : res.status >= 500 ? 'SERVER' : 'UNKNOWN')
      setStatus('error')
    } catch (e) {
      // 超时与断网都归到 NETWORK：用户唯一能做的是重试，而重试复用同一个 requestId 是安全的
      setError(e instanceof DOMException && e.name === 'TimeoutError' ? 'NETWORK' : 'NETWORK')
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }, [sku])

  return { status, error, orderId, submit, requestId: requestId.current }
}
```
`lib/checkout-error.ts`
```ts
// 错误码 → 用户能看懂的一句话 + 是否可以重试。别在组件里写 if/else 文案，否则三处不一致
export const CHECKOUT_ERROR_TEXT: Record<string, { text: string; retryable: boolean }> = {
  OUT_OF_STOCK: { text: '库存不足，已为你保留 15 分钟，可稍后再试', retryable: false },
  NETWORK: { text: '网络不稳定，重试不会重复下单', retryable: true },
  SERVER: { text: '服务暂时不可用，请稍后重试', retryable: true },
  UNKNOWN: { text: '下单失败，请刷新后重试', retryable: true },
}
```
`components/SubmitBar.tsx`
```tsx
'use client'
export function SubmitBar({ stock, status, error, submit }: {
  stock: number
  status: 'idle' | 'submitting' | 'success' | 'error'
  error: string | null
  submit: () => void
}) {
  const soldOut = stock <= 0
  const busy = status === 'submitting'

  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {error && <p className="mb-2 text-sm text-red-600">{CHECKOUT_ERROR_TEXT[error]?.text}</p>}
      <button
        // 两个禁用条件都要有：售罄是业务态，busy 是交互态。只判 busy 会让售罄还能点
        disabled={soldOut || busy}
        onClick={submit}
        className="h-11 w-full rounded-lg bg-black text-white disabled:bg-zinc-300"
      >
        {soldOut ? '已售罄' : busy ? '提交中…' : status === 'error' ? '重试' : '提交订单'}
      </button>
    </div>
  )
}
```
:::

## 验收脚本

:::check 后端用 curl 验幂等，前端用清单验交互
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
RID="req-$(date +%s%N)"

post() { # post <requestId> <sku> <qty>
  curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE/api/orders" \
    -H 'Content-Type: application/json' \
    -d "{\"sku\":\"$2\",\"qty\":$3,\"requestId\":\"$1\"}"
}
oid() { sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p' /tmp/nl.body; }

echo "== 1. 同一 requestId 连提两次 → 只产生一单（第二次 200 返回原单）"
[ "$(post "$RID" demo 1)" = "201" ] || { echo "FAIL 首单失败"; cat /tmp/nl.body; exit 1; }
A=$(oid)
[ "$(post "$RID" demo 1)" = "200" ] || { echo "FAIL 重复提交未按幂等返回"; exit 1; }
B=$(oid)
[ "$A" = "$B" ] && echo "PASS 幂等：$A" || { echo "FAIL 产生了第二单 $A != $B"; exit 1; }

echo "== 2. 库存不足 → 409（前端应映射成「已售罄/库存不足」，不是系统错误）"
[ "$(post "over-$(date +%s%N)" demo 999999)" = "409" ] && echo "PASS 409" || { echo "FAIL"; exit 1; }

echo "== 3. 不同 requestId 是不同单（别把幂等做成永久缓存）"
[ "$(post "new-$(date +%s%N)" demo 1)" = "201" ] && echo "PASS 新请求产生新单" || { echo "FAIL 新请求被去重"; exit 1; }
```

**浏览器核对**

- [ ] 连点 5 次「提交订单」：Network 只有一次请求（或多次同 requestId），最终只有一单
- [ ] 提交超时后点「重试」：仍是同一个 requestId
- [ ] 下单成功后**刷新**再提交：生成新 requestId（不是复用上一单的）
- [ ] 库存 0 时按钮禁用且文案为「已售罄」
- [ ] 409 提示「库存不足」，网络错误提示「检查网络」

:::

## 延伸方向

- 支付超时回跳：回到订单页时识别「已支付」，避免二次下单。
- 多商品车：每个 sku 一个 requestId，或整单一个。
- 弱网：提交中显示进度，失败给「查看订单」入口（可能已经成功）。
