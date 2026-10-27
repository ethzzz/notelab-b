---
title: 订单与库存（Go 版）
route: go
direction: 交易
level: L3
weeks: 6-8
hours: 6-8
requires: go:5-6
tags: 事务, 幂等, 并发, 对比 Java
summary: 同一个业务，用 Go 再写一遍：没有注解和 AOP，事务边界与错误处理都得自己显式写出来。
---

## 业务背景

这是「交易」方向的多语言对照项目。业务规则与 Java 版完全一致：不能超卖、不能重复下单。差别在**实现方式**——Go 没有 `@Transactional`，也没有 ORM 自动生成 SQL，所有东西都摆在明面上。

## 需求（用户故事）

与 Java 版一致：下单幂等、库存不足明确报错、20 并发抢 10 件只成功 10 件。**额外要求**：代码里能一眼看出事务从哪开始、到哪结束。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/orders` | `{sku, qty, requestId}` → 201；重复提交返回原订单 |
| GET | `/api/stock/{sku}` | 查询库存 |

## 数据模型

与 Java 版共用同一套表：`stock(sku, qty)`、`orders(request_id UNIQUE, ...)`。

## 验收标准

- 20 并发抢 10 件：10 个 201、10 个 409。
- 同一 `requestId` 两次：返回同一个 `orderId`，库存只扣一次。
- `go test -race` 通过（并发测试要真的并发）。
- 事务失败时，`orders` 里不出现脏数据。

## 关键决策

:::hint Go 里没有「注解事务」，边界就是函数
`BeginTx` 到 `Commit` 之间就是事务；`defer tx.Rollback()`（Commit 后是 no-op）防止提前 return 漏回滚。所有 SQL 手写，条件更新与唯一索引仍然是防超卖/防重的主力。
:::

## 参考实现

:::solution 关键实现：一个事务里「条件扣减 + 唯一键插入」，两处都不靠读校验
`schema.sql`
```sql
CREATE TABLE stock (
  sku VARCHAR(64) PRIMARY KEY,
  qty INT NOT NULL,
  CONSTRAINT ck_stock_nonneg CHECK (qty >= 0)   -- 兜底：条件更新写错也不会扣成负
) ENGINE=InnoDB;

CREATE TABLE orders (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  sku        VARCHAR(64) NOT NULL,
  qty        INT NOT NULL,
  status     VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_request (request_id)            -- 幂等的唯一依据
) ENGINE=InnoDB;
```
`internal/order/service.go`
```go
// 事务边界一眼可见：BeginTx 之后所有 return 都会被 defer Rollback 兜住
func (s *Service) Create(ctx context.Context, sku string, qty int, reqID string) (*Order, error) {
	// 快路径：已经下过这一单就直接返回（省一次事务；并发下仍要靠唯一键兜底）
	if old, err := s.findByRequestID(ctx, reqID); err == nil && old != nil {
		return old, nil
	}

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() // Commit 之后是 no-op

	// 条件更新即并发控制：没有「先 SELECT 再判断」，所以不存在检查-扣减之间的窗口
	res, err := tx.ExecContext(ctx,
		`UPDATE stock SET qty = qty - ? WHERE sku = ? AND qty >= ?`, qty, sku, qty)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrInsufficientStock
	}

	o := &Order{SKU: sku, Qty: qty, RequestID: reqID, Status: "CREATED"}
	res, err = tx.ExecContext(ctx,
		`INSERT INTO orders (request_id, sku, qty, status) VALUES (?, ?, ?, ?)`,
		o.RequestID, o.SKU, o.Qty, o.Status)
	if err != nil {
		if isDuplicate(err) { // 并发同 requestId：回滚本次扣减，返回先到的单
			return nil, ErrDuplicateRequest
		}
		return nil, err
	}
	o.ID, _ = res.LastInsertId()
	return o, tx.Commit()
}

func isDuplicate(err error) bool {
	var me *mysql.MySQLError
	// 1062 = ER_DUP_ENTRY
	return errors.As(err, &me) && me.Number == 1062
}
```
`internal/order/handler.go`
```go
// 错误 → 状态码必须一一对应：库存不足是 409（可重试的业务冲突），不是 500
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SKU       string `json:"sku"`
		Qty       int    `json:"qty"`
		RequestID string `json:"requestId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RequestID == "" {
		http.Error(w, `{"error":"requestId 必填"}`, http.StatusBadRequest)
		return
	}
	o, err := h.svc.Create(r.Context(), req.SKU, req.Qty, req.RequestID)
	switch {
	case errors.Is(err, ErrInsufficientStock):
		http.Error(w, `{"error":"insufficient stock"}`, http.StatusConflict)
	case errors.Is(err, ErrDuplicateRequest):
		// 并发下先到的那一单赢了，把它返回给调用方（对客户端仍是成功）
		if old, e2 := h.svc.FindByRequestID(r.Context(), req.RequestID); e2 == nil && old != nil {
			writeJSON(w, map[string]any{"orderId": old.ID, "reused": true})
			return
		}
		http.Error(w, `{"error":"duplicate request"}`, http.StatusConflict)
	case err != nil:
		http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
	default:
		w.WriteHeader(http.StatusCreated)
		writeJSON(w, map[string]any{"orderId": o.ID})
	}
}
```
`internal/order/service_test.go`
```go
// 这条测试是「20 并发抢 10 件」的可执行版本：go test -race 必须过
func TestCreateConcurrent(t *testing.T) {
	svc, cleanup := newTestService(t) // 内部建表并写入 qty=10 的 sku
	defer cleanup()

	var ok, conflict int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := svc.Create(context.Background(), "demo", 1, fmt.Sprintf("c-%d", i))
			switch {
			case err == nil:
				atomic.AddInt32(&ok, 1)
			case errors.Is(err, ErrInsufficientStock):
				atomic.AddInt32(&conflict, 1)
			default:
				t.Errorf("意外错误: %v", err)
			}
		}(i)
	}
	wg.Wait()
	if ok != 10 || conflict != 10 {
		t.Fatalf("期望 10 成功 / 10 冲突，实际 %d / %d", ok, conflict)
	}
}
```
:::

## 与 Java 版的对照

| 维度 | Java 版 | Go 版 |
|---|---|---|
| 事务 | `@Transactional` 注解 | `BeginTx` / `Commit` 显式 |
| SQL | MyBatis 注解或 XML | 手写 SQL 字符串 |
| 异常 | 抛异常，框架回滚 | 返回 `error`，手动 `return` 触发 defer 回滚 |
| 防超卖 | 条件更新 | 条件更新（一样） |
| 幂等 | 唯一索引 + 捕获异常 | 唯一索引 + 判错 |

## 验收脚本

:::check 复制即用（bash + curl，与 Java 版同一套断言）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
SKU="${SKU:-demo}"

expect() {
  local want=$1 desc=$2; shift 2
  local got; got=$(curl -s -o /tmp/nl.body -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then printf 'PASS %s (%s)\n' "$desc" "$got"
  else printf 'FAIL %s  want=%s got=%s\n' "$desc" "$want" "$got"; cat /tmp/nl.body; exit 1; fi
}

echo "== 1. 库存不足 → 409（不是 500，也不扣库存）"
expect 409 "qty 超库存" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"qty\":999999,\"requestId\":\"r-$(date +%s%N)\"}"

echo "== 2. 同 requestId 两次 → 同一个 orderId"
RID="idem-$(date +%s%N)"
A=$(curl -s -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"qty\":1,\"requestId\":\"$RID\"}" | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p')
B=$(curl -s -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"qty\":1,\"requestId\":\"$RID\"}" | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p')
[ -n "$A" ] && [ "$A" = "$B" ] && echo "PASS 幂等 $A" || { echo "FAIL $A != $B"; exit 1; }

echo "== 3. 20 并发抢 10 件 → 恰好 10 个 201"
seq 20 | xargs -P 20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU-small\",\"qty\":1,\"requestId\":\"c-{}\"}" | sort | uniq -c
echo "（人工核对：201 恰好 10；再 GET /api/stock/$SKU-small 确认 qty 不为负）"

echo "== 4. 与 Java 版对照：请求相同、响应相同，才说明业务口径一致"
echo "   # 对同一份输入分别打两个实现，diff 响应体（去掉 orderId 时间戳差异）"
```
:::

## 延伸方向

- 把「库存扣减」抽成独立的领域服务，两个语言都能调。
- 加 `ctx` 超时：请求取消时事务也要中断。
- 压测两种实现的 QPS，比较差异来源。
