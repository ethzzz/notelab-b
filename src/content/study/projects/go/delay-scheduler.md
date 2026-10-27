---
title: 延迟任务与超时调度
route: go
direction: 异步
level: L3
weeks: 7-9
hours: 6-8
requires: go:3-4
tags: 定时, 最小堆, 幂等, 重启恢复
summary: 订单 30 分钟未支付要关单、券到期要提醒——「到点执行一次，且只执行一次」比想象中难。
---

## 业务背景

延迟任务看起来是 `time.AfterFunc` 一行代码，但生产里要回答：服务重启后任务还在吗？同一任务会不会被触发两次？到期时间集中时会不会瞬间打满？

## 需求（用户故事）

- 作为买家，我下单 30 分钟未支付，订单自动关闭并释放库存。
- 作为运营，同一任务只执行一次，重试也不重复发通知。
- 作为值班，服务重启后，未到期的任务仍然会被执行。

## 接口契约（内部）

```text
POST /internal/schedules   {id, fireAt, type, payload}
  → 201 {"id": "..."}；重复 id 返回 200（幂等）

worker：
  取最早到期任务 → 执行 → 标记 DONE
  执行失败 → 重试（最多 3 次，退避）→ 仍失败标记 FAILED 并告警
```

## 数据模型

```sql
CREATE TABLE schedule (
  id VARCHAR(64) PRIMARY KEY,
  fire_at DATETIME(3) NOT NULL,
  type VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(16) NOT NULL,   -- PENDING / DONE / FAILED
  attempts INT NOT NULL DEFAULT 0,
  KEY idx_fire (status, fire_at)
);
```

## 验收标准

- 到期误差 < 1 秒（本机时钟；跨机要讨论时钟同步）。
- 触发 1000 个集中在同一秒的任务，内存不爆、不漏执行。
- 把进程 kill -9 再启动，未到期任务仍按时执行。
- 同一 id 调用两次，只落一条记录、只触发一次。

## 关键决策

:::hint 内存堆 + 数据库，谁是真相
- **内存最小堆**负责「准」：所有 PENDING 任务放堆里，到点弹出执行；
- **数据库**负责「不丢」：启动时把未来任务重新加载进堆，执行后更新状态。
只靠内存，重启就丢；只靠轮询数据库，误差取决于轮询间隔。两者结合才既准又不丢。
:::

## 参考实现

:::solution 关键实现：最小堆 + 到期批量 claim（幂等靠 SQL，不靠内存）
`scheduler.go`
```go
// 最小堆只管「什么时候该看」，真正能不能执行由 DB 的条件更新决定。
// 这样多副本同时跑也不会重复触发 —— 内存里的堆永远只是加速器，不是权威
type Scheduler struct {
	mu   sync.Mutex
	heap taskHeap
	wake chan struct{}
	db   *sql.DB
}

func (s *Scheduler) Run(ctx context.Context) {
	timer := time.NewTimer(time.Hour)
	defer timer.Stop()
	for {
		next, ok := s.peek()
		if !ok {
			select {
			case <-s.wake:
			case <-ctx.Done():
				return
			}
			continue
		}
		wait := time.Until(next)
		if wait < 0 {
			wait = 0
		}
		timer.Reset(wait)
		select {
		case <-timer.C:
			s.fireDue(ctx)
		case <-s.wake:
			// 新任务比堆顶更早，重算等待时间
		case <-ctx.Done():
			return
		}
	}
}

// 一次取走所有已到期的任务，批量 claim 减少 DB 往返
func (s *Scheduler) fireDue(ctx context.Context) {
	now := time.Now()
	batch := s.popDue(now, 500)
	if len(batch) == 0 {
		return
	}
	ids := make([]any, 0, len(batch))
	for _, t := range batch {
		ids = append(ids, t.ID)
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	// 只有 status=PENDING 的才会被改到 RUNNING，抢不到的自然拿到 0 行
	res, err := s.db.ExecContext(ctx,
		`UPDATE delayed_tasks SET status='RUNNING', started_at=NOW()
		  WHERE id IN (`+placeholders+`) AND status='PENDING'`, ids...)
	if err != nil {
		log.Printf("[sched] claim 失败: %v", err)
		return
	}
	n, _ := res.RowsAffected()
	log.Printf("[sched] 到期 %d 条，claim 成功 %d 条", len(batch), n)
	// 执行交给 worker 池：慢任务不能阻塞调度循环
	for _, t := range batch {
		s.pool.Submit(func() { s.execute(ctx, t) })
	}
}
```
`recover.go`
```go
// 重启恢复：把库里「未到期 + 已过期但没执行」的任务一起装回堆。
// 已过期的那批要**立刻**执行（不能等到下一个周期），否则 kill -9 之后就永远漏了
func (s *Scheduler) Recover(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, run_at FROM delayed_tasks
		 WHERE status = 'PENDING' AND run_at <= NOW() + INTERVAL 24 HOUR`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var backfill int
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.RunAt); err != nil {
			return err
		}
		if t.RunAt.Before(time.Now()) {
			backfill++
		}
		s.push(t)
	}
	log.Printf("[sched] 恢复 %d 条（其中已过期 %d 条，会立即触发）", len(s.heap), backfill)
	return rows.Err()
}
```
`schema.sql`
```sql
CREATE TABLE delayed_tasks (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  biz_key     VARCHAR(128) NOT NULL,          -- 业务幂等键：同一 id 只能落一条
  kind        VARCHAR(64)  NOT NULL,
  payload     JSON         NOT NULL,
  run_at      DATETIME(3)  NOT NULL,
  status      ENUM('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  attempts    INT NOT NULL DEFAULT 0,
  last_error  VARCHAR(512) NULL,
  started_at  DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_biz (biz_key),
  KEY idx_due (status, run_at)
) ENGINE=InnoDB;
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
ID="job-$(date +%s%N)"
FIRE=$(date -u -d '+3 seconds' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+3S +%Y-%m-%dT%H:%M:%SZ)

create() {
  curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE/internal/schedules" \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"$ID\",\"fireAt\":\"$FIRE\",\"type\":\"close-order\",\"payload\":{\"orderId\":1}}"
}

echo "== 1. 建一个 3 秒后到期的任务 → 201"
[ "$(create)" = "201" ] || { echo "FAIL 创建失败"; cat /tmp/nl.body; exit 1; }
echo "id=$ID fireAt=$FIRE"

echo "== 2. 同一 id 再提交 → 200（幂等，不产生第二条任务）"
[ "$(create)" = "200" ] && echo "PASS 重复提交幂等" || { echo "FAIL 重复 id 返回非 200"; exit 1; }

echo "== 3. 等 5 秒，任务应已执行且只执行一次"
sleep 5
curl -s "$BASE/internal/schedules/$ID" | tee /tmp/nl.job; echo
grep -q '"status":"DONE"' /tmp/nl.job && echo "PASS 已执行" || { echo "FAIL 未执行或状态不对"; exit 1; }
echo "（执行次数应在业务日志里核对：同一 id 只处理了一次）"

echo "== 4. 重启恢复：kill -9 后重启服务，重建一个 10 秒后的任务，确认仍会触发"
echo "   # 手动步骤：建任务 → kill -9 → start → sleep 12 → 查状态"
```
:::

## 延伸方向

- 时间轮替代最小堆，适合海量短期定时任务。
- 分布式：多实例时按 id 哈希分片，或用租约避免重复执行。
- 可观测：到期延迟分布、失败率、积压量。
