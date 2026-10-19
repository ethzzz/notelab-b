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

:::solution 最小堆 + 启动恢复 + 幂等
```go
type item struct {
	id     string
	fireAt time.Time
}

type Scheduler struct {
	mu   sync.Mutex
	h    []item
	wake chan struct{}
}

func (s *Scheduler) push(it item) {
	s.mu.Lock()
	heap.Push(&s, it) // 需实现 heap.Interface
	s.mu.Unlock()
	select { case s.wake <- struct{}{}: default: }
}

func (s *Scheduler) run(ctx context.Context) {
	timer := time.NewTimer(time.Hour)
	for {
		s.mu.Lock()
		var next *item
		if len(s.h) > 0 { n := s.h[0]; next = &n }
		s.mu.Unlock()

		if next == nil {
			select { case <-ctx.Done(): return; case <-s.wake: continue }
		}
		d := time.Until(next.fireAt)
		if d > 0 {
			timer.Reset(d)
			select { case <-ctx.Done(): return; case <-timer.C: case <-s.wake: continue }
		}
		s.popAndRun(ctx) // 执行时用 id + status 条件更新，保证只执行一次
	}
}
```
```go
// 执行前先抢占：UPDATE schedule SET status='RUNNING' WHERE id=? AND status='PENDING'
// 影响行数为 0 → 已被别人执行，直接跳过（幂等）
```
:::

## 延伸方向

- 时间轮替代最小堆，适合海量短期定时任务。
- 分布式：多实例时按 id 哈希分片，或用租约避免重复执行。
- 可观测：到期延迟分布、失败率、积压量。
