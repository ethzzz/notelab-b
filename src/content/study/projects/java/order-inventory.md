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

:::solution 关键实现：条件扣减 + 唯一键，两处都不做「先查后改」
`schema.sql`
```sql
CREATE TABLE stock (
  sku VARCHAR(64) PRIMARY KEY,
  qty INT NOT NULL,
  CONSTRAINT ck_nonneg CHECK (qty >= 0)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  sku        VARCHAR(64) NOT NULL,
  qty        INT NOT NULL,
  status     VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_request (request_id)
) ENGINE=InnoDB;
```
`OrderService.java`
```java
@Service
public class OrderService {
    private final JdbcClient db;

    public OrderService(JdbcClient db) { this.db = db; }

    /**
     * 下单：全部并发控制都压在「条件 UPDATE + 唯一索引」上。
     * 注意不要在这里加 SELECT ... FOR UPDATE 之外的手写校验 —— 读到的库存随时会变。
     */
    /** 供 controller 在唯一键冲突后取回先到的那一单 */
    public Optional<Long> findByRequestId(String requestId) {
        return db.sql("SELECT id FROM orders WHERE request_id = ?")
                .param(requestId).query(Long.class).optional();
    }

    @Transactional
    public long create(String sku, int qty, String requestId) {
        // ① 幂等快路径（并发下仍可能两条都到这里，靠 uk_request 兜底）
        Optional<Long> old = db.sql("SELECT id FROM orders WHERE request_id = ?")
                .param(requestId).query(Long.class).optional();
        if (old.isPresent()) return old.get();

        // ② 条件扣减：库存不够时 RowsAffected = 0，而不是先查再判断
        int deducted = db.sql("UPDATE stock SET qty = qty - ? WHERE sku = ? AND qty >= ?")
                .params(qty, sku, qty).update();
        if (deducted == 0) throw new BizException(409, "库存不足");

        // ③ 插单：唯一键冲突说明并发里有人先成功，回滚本次扣减并返回那一单
        try {
            // JdbcClient 没有「返回自增主键」的便捷方法，标准做法是给一个 KeyHolder
            KeyHolder keys = new GeneratedKeyHolder();
            db.sql("""
                    INSERT INTO orders (request_id, sku, qty, status) VALUES (?, ?, ?, 'CREATED')
                    """).params(requestId, sku, qty).update(keys);
            return keys.getKey().longValue();
        } catch (DuplicateKeyException e) {
            throw new DuplicateRequestException(requestId); // 事务回滚，扣减也一起撤销
        }
    }
}
```
`OrderController.java`
```java
/** 409 两种含义要靠 message 区分：库存不足（业务冲突）/ 重复请求（可返回原单） */
@PostMapping("/api/orders")
public ResponseEntity<?> create(@RequestBody CreateReq req) {
    if (req.requestId() == null || req.requestId().isBlank()) {
        return ResponseEntity.badRequest().body(Map.of("error", "requestId 必填"));
    }
    try {
        long id = service.create(req.sku(), req.qty(), req.requestId());
        return ResponseEntity.status(201).body(Map.of("orderId", id));
    } catch (DuplicateRequestException e) {
        // 并发同 requestId：把先到的那单返回给调用方，对客户端仍是成功
        long id = service.findByRequestId(req.requestId());
        return ResponseEntity.ok(Map.of("orderId", id, "reused", true));
    } catch (BizException e) {
        return ResponseEntity.status(e.getCode()).body(Map.of("error", e.getMessage()));
    }
}
```
`ConcurrencyTest.java`
```java
/** 这条测试就是验收脚本的可执行版本：20 并发抢 10 件 */
@Test
void twentyConcurrentBuyTen() throws Exception {
    var pool = Executors.newFixedThreadPool(20);
    var start = new CountDownLatch(1);
    var ok = new AtomicInteger();
    var conflict = new AtomicInteger();

    for (int i = 0; i < 20; i++) {
        final int n = i;
        pool.submit(() -> {
            start.await();
            try {
                service.create("demo", 1, "c-" + n);
                ok.incrementAndGet();
            } catch (BizException e) {
                if (e.getCode() == 409) conflict.incrementAndGet();
                else throw e;
            }
            return null;
        });
    }
    start.countDown();
    pool.shutdown();
    assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS));

    assertEquals(10, ok.get());
    assertEquals(10, conflict.get());
    assertEquals(0, stockQty("demo"));   // 不能扣成负数
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
