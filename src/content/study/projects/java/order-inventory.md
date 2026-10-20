---
title: 订单与库存
route: java
direction: 交易
level: L3
weeks: 9-12
hours: 6-8
requires: java:9-12
tags: 事务, 幂等, 并发, 超卖
summary: 用一条条件更新 SQL + 唯一索引，把「超卖」和「重复下单」两个经典事故堵死。
---

## 业务背景

电商大促：同一件商品 200 人同时下单，库存 100。运营最怕两件事——**卖超**（赔钱、客诉）和**重复扣**（用户点两次提交，扣两次库存）。

这两个问题在单机 demo 里永远不会出现，只有并发下才暴露。所以它是检验「是否真的会用事务」的标准题。

## 需求（用户故事）

- 作为买家，我提交订单后拿到订单号；网络重试不会让我被扣两次。
- 作为买家，库存不足时我看到明确原因，而不是「系统错误」。
- 作为运营，我能用一条命令验出「20 个人同时抢 10 件，最后只卖出 10 件」。

## 接口契约

| 方法 | 路径 | 入参 | 成功 | 失败 |
|---|---|---|---|---|
| POST | `/api/orders` | `{sku, qty, requestId}` | 201 `{orderId, status}` | 400 参数非法 / 409 库存不足 / 409 重复提交（返回原 orderId） |
| GET | `/api/orders/{id}` | — | 200 `{id, sku, qty, status}` | 404 |
| GET | `/api/stock/{sku}` | — | 200 `{sku, qty}` | 404 |

错误体统一 `{error: string}`；`requestId` 由客户端生成，服务端只负责去重。

## 数据模型

```sql
CREATE TABLE stock (
  sku VARCHAR(32) PRIMARY KEY,
  qty INT NOT NULL
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id VARCHAR(64) NOT NULL,
  sku VARCHAR(32) NOT NULL,
  qty INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_request_id (request_id),
  KEY idx_sku (sku)
);
```

## 验收标准

```bash
BASE=http://127.0.0.1:8080

# 1) 幂等：同一 requestId 两次，必须返回同一个 orderId
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-1"}'
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-1"}'

# 2) 超卖：20 并发抢 10 件，成功数必须等于库存
seq 20 | xargs -P20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-{}"}' | sort | uniq -c
# 期望：10 个 201，10 个 409
```

## 关键决策

:::hint 先想清楚这三个问题再动手
1. 为什么用「条件更新」而不是「先查库存再扣」？——后者在并发下必超卖（查与扣之间被插队）。
2. 为什么幂等靠唯一索引，而不是先 `select` 再 `insert`？——并发下两个请求会同时查到「不存在」。
3. 事务里先插订单还是先扣库存？——先扣库存；插单失败还能回滚，反过来会留脏订单。
:::

## 参考实现

:::solution 条件更新 + 唯一索引 + 异常映射
```java
// 一条 SQL 同时完成「判断够不够」和「扣减」，天然防超卖
@Update("UPDATE stock SET qty = qty - #{qty} WHERE sku = #{sku} AND qty >= #{qty}")
int deduct(@Param("sku") String sku, @Param("qty") int qty);
```
```java
@Transactional(rollbackFor = Exception.class)
public Order create(String sku, int qty, String requestId) {
    if (stockMapper.deduct(sku, qty) == 0) throw new InsufficientStockException();
    Order o = new Order(null, requestId, sku, qty, "CREATED", null);
    orderMapper.insert(o);          // uk_request_id 兜底幂等
    return o;
}
```
```java
try {
    Order o = service.create(req.sku(), req.qty(), req.requestId());
    return ResponseEntity.status(201).body(Map.of("orderId", o.getId(), "status", o.getStatus()));
} catch (DuplicateKeyException e) {
    Order old = orderMapper.findByRequestId(req.requestId());
    return ResponseEntity.ok(Map.of("orderId", old.getId(), "status", old.getStatus()));
} catch (InsufficientStockException e) {
    return ResponseEntity.status(409).body(Map.of("error", "库存不足"));
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl，约 30 秒）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
SKU="${SKU:-demo}"

expect() { # expect <期望码> <说明> <curl 参数...>
  local want=$1 desc=$2; shift 2
  local got; got=$(curl -s -o /tmp/nl.body -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then printf 'PASS %s (%s)\n' "$desc" "$got"
  else printf 'FAIL %s  want=%s got=%s\n' "$desc" "$want" "$got"; cat /tmp/nl.body; exit 1; fi
}

echo "== 1. 库存不足必须 409，而不是 500"
expect 409 "qty 超过库存" -X POST "$BASE/api/orders" \
  -H 'Content-Type: application/json' -d "{\"sku\":\"$SKU\",\"qty\":999999,\"requestId\":\"r-$(date +%s%N)\"}"

echo "== 2. 同一 requestId 提交两次，返回同一个订单号"
RID="idem-$(date +%s%N)"
A=$(curl -s -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"qty\":1,\"requestId\":\"$RID\"}" | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p')
B=$(curl -s -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"qty\":1,\"requestId\":\"$RID\"}" | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p')
[ -n "$A" ] && [ "$A" = "$B" ] && echo "PASS 幂等命中同一单 $A" || { echo "FAIL $A != $B"; exit 1; }

echo "== 3. 20 并发抢 10 件：应恰好 10 个 201 / 10 个 409"
seq 20 | xargs -P 20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU-small\",\"qty\":1,\"requestId\":\"c-{}\"}" | sort | uniq -c
echo "（人工核对：201 恰好 10 个；再 GET /api/stock/$SKU-small 确认 qty 不为负）"
```
:::

## 延伸方向

- 加「取消订单」：回补库存 + 状态机（CREATED → CANCELLED），要考虑重复取消。
- 加「预占库存」：下单占位、超时释放，考验定时任务与并发。
- 加「对账」：每天核对订单与库存流水，找出差异单。
