---
title: 库存预占与超时释放
route: java
direction: 交易
level: L3
weeks: 11-13
hours: 8-10
requires: java:9-12
tags: 预占, 超时, 幂等, 定时任务
summary: 下单先占库存、15 分钟未支付自动释放；难点不是占，而是「释放得准、重复调用不出错」。
---

## 业务背景

大促时如果「下单即扣库存」，用户不付款就会把库存占死；如果「支付才扣」，又会超卖。业界通用做法是**预占**：下单占住、支付确认、超时释放。

三个坑：占位与释放并发、释放重复执行、服务重启丢定时任务。

## 需求（用户故事）

- 作为买家，我下单后 15 分钟内库存为我保留。
- 作为运营，超时未支付的订单要自动释放库存，且不能重复释放。
- 作为买家，我支付成功后库存从「预占」转为「已扣」，不会再被释放。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/reservations` | `{sku, qty, orderId}` → 201 `{reservationId, expireAt}` |
| POST | `/api/reservations/{id}/confirm` | 支付成功确认（幂等） |
| POST | `/api/reservations/{id}/release` | 主动/超时释放（幂等） |

## 数据模型

```sql
CREATE TABLE stock (
  sku VARCHAR(32) PRIMARY KEY,
  available INT NOT NULL,   -- 可售
  reserved  INT NOT NULL    -- 已占
);

CREATE TABLE reservation (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  sku VARCHAR(32) NOT NULL,
  qty INT NOT NULL,
  status VARCHAR(16) NOT NULL,   -- HELD / CONFIRMED / RELEASED
  expire_at DATETIME NOT NULL,
  UNIQUE KEY uk_order (order_id),
  KEY idx_expire (status, expire_at)
);
```

## 验收标准

- 并发 20 单抢 10 件：10 个成功、10 个 409，`available` 不为负。
- 到期后 5 秒内自动释放；释放两次不会把库存加两次。
- 确认支付后再触发释放：状态不变（已确认的不能被释放）。
- 重启服务后，未到期的预占仍然会被释放（任务不能只存在内存里）。

## 关键决策

:::hint 三个必须回答的问题
1. **超时释放用「延迟队列」还是「定时扫表」**？扫表简单但有时延；延迟队列准时但要处理重启丢任务。本项目的验收允许 5 秒误差，扫表足够。
2. **怎么保证不重复释放**？条件更新：`UPDATE reservation SET status='RELEASED' WHERE id=? AND status='HELD'`，影响行数为 1 才回补库存。
3. **怎么保证不超额预占**？`UPDATE stock SET available=available-?, reserved=reserved+? WHERE sku=? AND available>=?`。
:::

## 参考实现

:::solution 预占 / 确认 / 释放
```java
@Transactional
public long reserve(String sku, int qty, long orderId) {
    if (stockMapper.hold(sku, qty) == 0) throw new InsufficientStockException();
    return reservationMapper.insert(orderId, sku, qty, now().plusMinutes(15));
}

@Transactional
public void confirm(long id) {
    if (reservationMapper.markConfirmed(id) == 0) return; // 已处理/已释放：幂等返回
    stockMapper.commitReserved(reservationMapper.skuOf(id), reservationMapper.qtyOf(id));
}

@Transactional
public void release(long id) {
    if (reservationMapper.markReleased(id) == 0) return;  // 只有 HELD 能释放
    stockMapper.releaseReserved(reservationMapper.skuOf(id), reservationMapper.qtyOf(id));
}
```
```java
// 扫表释放：每 10 秒一批，limit 防一次扫太多
@Scheduled(fixedDelay = 10_000)
public void releaseExpired() {
    reservationMapper.findExpired(200).forEach(r -> release(r.getId()));
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl，重点验幂等）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"

qty() { curl -s "$BASE/api/stock/demo" | sed -n 's/.*"available":\([0-9]*\).*/\1/p'; }
post() { curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$1"; }

echo "== 1. 预占 → 释放两次：库存只回补一次"
before=$(qty)
RID=$(curl -s -X POST "$BASE/api/reservations" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"demo\",\"qty\":2,\"orderId\":$(date +%s)}" | sed -n 's/.*"reservationId":\([0-9]*\).*/\1/p')
[ -n "$RID" ] || { echo "FAIL 预占失败"; exit 1; }
echo "预占后 available=$(qty)（应比 $before 少 2）"
[ "$(post "/api/reservations/$RID/release")" = "200" ] || { echo "FAIL 首次释放"; exit 1; }
mid=$(qty)
[ "$(post "/api/reservations/$RID/release")" = "200" ] || { echo "FAIL 重复释放应幂等返回 200"; exit 1; }
[ "$(qty)" = "$mid" ] && echo "PASS 重复释放没有二次回补（available=$mid）" || { echo "FAIL 库存被加两次"; exit 1; }

echo "== 2. 已确认的预占不能再释放"
RID2=$(curl -s -X POST "$BASE/api/reservations" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"demo\",\"qty\":1,\"orderId\":$(date +%s)9}" | sed -n 's/.*"reservationId":\([0-9]*\).*/\1/p')
post "/api/reservations/$RID2/confirm" >/dev/null
post "/api/reservations/$RID2/release" >/dev/null
echo "人工核对：该预占状态应为 CONFIRMED，available 应等于扣减后的值"

echo "== 3. 超时释放：把 expire 调成 5 秒后重跑，等 10 秒看库存是否回补"
```
:::

## 延伸方向

- 改延迟队列（Redis ZSET / MQ 延迟消息），把误差从 5 秒压到毫秒。
- 加「部分释放」：一次预占多件，只买一部分。
- 加监控：预占总量、超时释放量、释放失败告警。
