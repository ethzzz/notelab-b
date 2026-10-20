---
title: 退款与分账对账
route: java
direction: 资金
level: L3
weeks: 16-17
hours: 8-10
requires: java:9-12
tags: 退款, 分账, 金额精度, 状态机
summary: 一笔订单可能分多次退款、给多个商户分账；金额一旦用错类型，差一分钱都是事故。
---

## 业务背景

退款不是「把订单金额减回去」这么简单：可能部分退、多次退、退运费不退商品；平台还要把货款分给商户与平台，比例不同、结算周期不同。任何一步用浮点数算钱，早晚出问题。

## 需求（用户故事）

- 作为买家，我可以申请部分退款，累计退款不能超过实付金额。
- 作为财务，每次退款都有独立流水，能按订单汇总核对。
- 作为商户，我能看到自己那份分账金额与结算状态。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/refunds` | `{orderId, amount, reason}` → 201 `{refundId, status}` |
| GET | `/api/orders/{id}/refunds` | 该订单的全部退款 |
| POST | `/api/settlements/run` | 触发一次分账结算（管理员） |

错误：超额退款 409，重复退款（同一 requestId）200 返回原记录。

## 数据模型

```sql
CREATE TABLE refund (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,     -- 绝不用 double
  reason VARCHAR(200),
  status VARCHAR(16) NOT NULL,       -- APPLIED / SUCCESS / FAILED
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_request (request_id),
  KEY idx_order (order_id)
);

CREATE TABLE settlement (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  merchant_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(16) NOT NULL,       -- PENDING / SETTLED
  UNIQUE KEY uk_order_merchant (order_id, merchant_id)
);
```

## 验收标准

- 订单 100 元，退 60 + 退 60：第一次成功，第二次 409，且累计不超过 100。
- 同一 `requestId` 提交两次：只产生一条退款记录。
- 分账：平台抽 10%，商户 90%，四舍五入误差记到平台侧，总额必须等于订单金额。
- 对账脚本能列出「退款成功但分账未结算」的订单。

## 关键决策

:::hint 金额与幂等，两条底线
1. **金额一律 `DECIMAL` / 整数分**，禁止 `double`；四舍五入的差额要显式归到某一方，不能让总额对不上。
2. **退款幂等键是 `requestId`**，不是订单号——同一订单可以有多笔退款。
:::

## 参考实现

:::solution 超额校验与分账取整
```java
@Transactional
public long apply(long orderId, BigDecimal amount, String requestId) {
    BigDecimal paid = orderMapper.paidAmount(orderId);
    BigDecimal refunded = refundMapper.sumSuccess(orderId);
    if (refunded.add(amount).compareTo(paid) > 0) throw new OverRefundException();
    return refundMapper.insert(orderId, requestId, amount);
}
```
```java
// 分账：先算商户，平台拿余数，保证 sum == total
BigDecimal merchant = total.multiply(new BigDecimal("0.90")).setScale(2, RoundingMode.DOWN);
BigDecimal platform = total.subtract(merchant);
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
ORDER="${ORDER:-1}"
RID="refund-$(date +%s%N)"

refund() { # refund <金额> <requestId>
  curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE/api/refunds" \
    -H 'Content-Type: application/json' -d "{\"orderId\":$ORDER,\"amount\":$1,\"reason\":\"验收\",\"requestId\":\"$2\"}"
}

echo "== 1. 部分退款 → 201，重复 requestId → 200 且返回原记录"
[ "$(refund 60.00 "$RID")" = "201" ] || { echo "FAIL 首笔退款"; cat /tmp/nl.body; exit 1; }
first=$(cat /tmp/nl.body)
[ "$(refund 60.00 "$RID")" = "200" ] || { echo "FAIL 重复提交未按幂等返回"; exit 1; }
[ "$(cat /tmp/nl.body)" = "$first" ] && echo "PASS 幂等返回同一条退款" || echo "注意：重复提交返回了不同内容"

echo "== 2. 累计超过实付 → 409"
[ "$(refund 60.00 "over-$(date +%s%N)")" = "409" ] || { echo "FAIL 超额退款没有被拒绝"; exit 1; }
echo "PASS 超额退款被拒绝"

echo "== 3. 退款流水可查，且累计不超过实付"
curl -s "$BASE/api/orders/$ORDER/refunds" | tee /tmp/nl.refunds | head -c 300; echo
sum=$(grep -o '"amount":[0-9.]*' /tmp/nl.refunds | sed 's/.*://' | awk '{s+=$1} END {printf "%.2f", s}')
paid=$(curl -s "$BASE/api/orders/$ORDER" | sed -n 's/.*"paidAmount":[0-9.]*//p')
echo "累计退款=$sum（应与实付金额比对）"
awk -v s="$sum" 'BEGIN { exit !(s <= 100.00) }' && echo "PASS 累计未超实付" || { echo "FAIL 累计退款超过实付"; exit 1; }

echo "== 4. 分账取整：跑一次结算，商户 + 平台必须等于总额"
curl -s -X POST "$BASE/api/settlements/run" -H "Authorization: Bearer ${ADMIN_TOKEN:?}" | tee /tmp/nl.settle
echo "（人工核对：merchant.amount + platform.amount == order.amount，差一分都不行）"
```
:::

## 延伸方向

- 退款审批流：金额超过阈值要人工审批。
- 多商户分账：按比例表拆分，支持多级分账。
- 结算对账：与支付渠道的结算单逐笔比对。
