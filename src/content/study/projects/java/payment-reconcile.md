---
title: 支付回调与日终对账
route: java
direction: 资金
level: L3
weeks: 10-14
tags: 幂等, 验签, 状态机, 对账
summary: 第三方会重复回调、乱序回调、甚至伪造回调；钱的事一步错就是事故。
---

## 业务背景

接入支付渠道后，回调是最不可控的一环：网络重试导致**同一笔支付回调 5 次**、渠道重发导致**乱序**、公网暴露导致**伪造请求**。而钱一旦多扣或少扣，事后只能靠对账找回来。

这个项目的价值：让你第一次认真处理「外部系统不可信」这件事。

## 需求（用户故事）

- 作为财务，同一笔支付无论回调多少次，订单只应变成「已支付」一次。
- 作为开发，签名不对的回调必须被拒绝，且要能查到最后一次失败原因。
- 作为财务，每天能跑一次对账，输出「渠道有、我们没有」和「我们有、渠道没有」两张差异表。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/pay/callback/{channel}` | 接收渠道回调；验签 + 幂等 + 状态机 |
| GET | `/api/payments/{transactionId}` | 查询支付单状态 |
| POST | `/api/admin/reconcile` | 触发一次对账（仅管理员） |

回调返回：成功 `200 {"ok":true}`；**无论业务是否已处理，都要返回 200**（否则渠道会一直重试）；验签失败返回 401。

## 数据模型

```sql
CREATE TABLE payment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  channel VARCHAR(16) NOT NULL,
  transaction_id VARCHAR(64) NOT NULL,   -- 渠道侧单号
  order_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(16) NOT NULL,          -- INIT / PAID / REFUNDED
  raw_payload TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_channel_tx (channel, transaction_id)
);

CREATE TABLE reconcile_diff (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_date DATE NOT NULL,
  side VARCHAR(8) NOT NULL,             -- CHANNEL_ONLY / LOCAL_ONLY
  transaction_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2),
  UNIQUE KEY uk_date_tx_side (biz_date, transaction_id, side)
);
```

## 验收标准

- 同一回调重放 10 次：`payment.status` 只从 `INIT → PAID` 一次，订单不重复发货。
- 篡改签名：返回 401，且不写库。
- 乱序：先收到「退款回调」再收到「支付回调」，状态不能倒退。
- 对账：造 2 笔「渠道有我们没有」，脚本输出 `side=CHANNEL_ONLY` 两行。

## 关键决策

:::hint 三个坑，踩过才算会
1. **幂等键用「渠道 + 渠道单号」**，不是订单号——同一订单可能分多笔支付（定金 + 尾款）。
2. **状态机只能前进**：`INIT → PAID → REFUNDED`，收到倒退的回调要忽略而不是覆盖。
3. **回调失败也要返回 200**：返回 500 会让渠道无限重试，反而放大问题；把失败落到 `raw_payload` 里人工查。
:::

## 参考实现

:::solution 幂等 + 状态机 + 验签（骨架）
```java
public void handleCallback(String channel, String body, String signature) {
    if (!verifier.verify(channel, body, signature)) throw new UnauthorizedException();

    Callback cb = parse(body);                       // transactionId / orderId / amount / status
    Payment p = paymentMapper.findByChannelTx(channel, cb.transactionId());
    if (p == null) { paymentMapper.insertFromCallback(channel, cb); return; }
    if (!p.getStatus().equals("INIT")) return;       // 已处理过：直接忽略（幂等）

    if (!"PAID".equals(cb.status())) return;         // 只认支付成功
    if (paymentMapper.markPaid(p.getId()) == 0) return;  // 条件更新：只有 INIT 能变 PAID
    orderService.markPaid(p.getOrderId());
}
```
```java
// 对账任务：拉渠道账单 → 与本地 payment 差集 → 落 reconcile_diff
Set<String> local = paymentMapper.txIdsOf(date);
Set<String> remote = channelClient.billOf(date);
remote.stream().filter(id -> !local.contains(id))
      .forEach(id -> diffMapper.insert(date, "CHANNEL_ONLY", id));
```
:::

## 延伸方向

- 退款与部分退款：金额维度拆成 `payment_item`，退款要能对应到具体条目。
- 多渠道路由：按费率与成功率选渠道，失败自动切换。
- 回调巡检：超过 N 分钟仍是 `INIT` 的支付单要报警。
