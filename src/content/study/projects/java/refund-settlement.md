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

:::solution 关键实现：金额用分 + 条件更新控累计 + 分账余额给平台兜尾差
`RefundService.java`
```java
@Service
public class RefundService {
    private final JdbcClient db;

    /**
     * 部分退款：累计不能超过实付。
     * 关键在「WHERE refunded + ? <= paid_amount」——把上限写进 SQL，
     * 否则两个并发退款各自读到的已退金额都是旧值，双双通过检查。
     */
    @Transactional
    public long refund(long orderId, long amountCents, String requestId) {
        if (amountCents <= 0) throw new BizException(400, "退款金额必须大于 0");

        // ① 幂等：requestId 唯一，重复提交返回原退款单
        Optional<Long> existed = db.sql("SELECT id FROM refund WHERE request_id = ?")
                .param(requestId).query(Long.class).optional();
        if (existed.isPresent()) return existed.get();

        // ② 条件更新把「累计上限」交给数据库判
        int reserved = db.sql("""
                UPDATE orders
                   SET refunded_amount = refunded_amount + ?
                 WHERE id = ? AND refunded_amount + ? <= paid_amount
                """).params(amountCents, orderId, amountCents).update();
        if (reserved == 0) {
            throw new BizException(409, "累计退款金额超过实付金额");
        }

        // ③ 落退款单（requestId 唯一键再兜一次并发）
        try {
            KeyHolder keys = new GeneratedKeyHolder();
            db.sql("""
                    INSERT INTO refund (order_id, request_id, amount, status)
                    VALUES (?, ?, ?, 'SUCCESS')
                    """).params(orderId, requestId, amountCents).update(keys);
            long refundId = keys.getKey().longValue();

            // ④ 分账：按比例拆，尾差给平台，保证 sum = amount
            for (Split s : SplitCalculator.split(amountCents, 10)) {
                db.sql("""
                        INSERT INTO settlement (refund_id, party, amount, status)
                        VALUES (?, ?, ?, 'PENDING')
                        """).params(refundId, s.party(), s.amount()).update();
            }
            return refundId;
        } catch (DuplicateKeyException e) {
            throw new BizException(409, "重复的退款请求");
        }
    }
}
```
`SplitCalculator.java`
```java
/** 分账：平台抽 10%，商户 90%；四舍五入的误差全部记到平台侧，保证总额严格相等 */
public final class SplitCalculator {
    public record Split(String party, long amount) {}

    public static List<Split> split(long total, int platformPercent) {
        long platform = Math.round(total * platformPercent / 100.0);
        long merchant = total - platform;   // 减法而不是再算一次比例：尾差自然落在商户侧=platform 侧
        return List.of(new Split("PLATFORM", platform), new Split("MERCHANT", merchant));
    }
}
```
`SettlementReconcile.java`
```java
/** 对账：列出「退款成功但分账未结算」的订单，财务照着补 */
public List<Map<String, Object>> pendingSettlement() {
    return db.sql("""
            SELECT r.id AS refund_id, r.order_id, r.amount, s.party, s.amount AS split_amount
              FROM refund r
              JOIN settlement s ON s.refund_id = r.id
             WHERE r.status = 'SUCCESS' AND s.status = 'PENDING'
             ORDER BY r.id DESC
            """).query().listOfRows();
}
```
`schema.sql`
```sql
-- 金额一律 BIGINT 存「分」：DECIMAL 也能用，但 int 运算最省心且没有精度陷阱
CREATE TABLE orders (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  paid_amount     BIGINT NOT NULL,
  refunded_amount BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_refund_le_paid CHECK (refunded_amount <= paid_amount)
) ENGINE=InnoDB;

CREATE TABLE refund (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id   BIGINT NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  amount     BIGINT NOT NULL,
  status     VARCHAR(16) NOT NULL,
  UNIQUE KEY uk_request (request_id),
  KEY idx_order (order_id)
) ENGINE=InnoDB;

CREATE TABLE settlement (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  refund_id BIGINT NOT NULL,
  party     VARCHAR(16) NOT NULL,
  amount    BIGINT NOT NULL,
  status    VARCHAR(16) NOT NULL,
  KEY idx_pending (status, refund_id)
) ENGINE=InnoDB;
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
