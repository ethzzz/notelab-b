---
title: 任务队列消费者
route: go
direction: 异步
level: L3
weeks: 5-6
hours: 6-8
requires: go:5-6
tags: 重试, 退避, 幂等, 死信
summary: 一条消息至少投递一次，所以你的处理必须幂等；失败要有退避与死信，不能无限重试。
---

## 业务背景

发券、发短信、同步数据这类事不能卡在主流程里，通常丢进队列。但队列只保证「至少一次」，于是每个消费者都要回答三个问题：**重复怎么办、失败怎么办、一直失败怎么办。**

## 需求（用户故事）

- 作为运营，发券任务失败后能自动重试，最终成功或进入死信，不能悄悄消失。
- 作为开发，我能看到每条消息的重试次数与最后错误。
- 作为用户，我只会收到一张券，即使消息被投递了三次。

## 接口契约（内部）

```text
Consume(msg) error
  - 返回 nil        → ack
  - 返回 error      → nack + 记录重试次数（指数退避，最多 N 次）
  - 超过最大次数    → 写入死信表，ack（避免无限重投）
```

| 表 | 用途 |
|---|---|
| `task` | 消息体 + 状态（PENDING / DONE / DEAD） |
| `task_attempt` | 每次重试的记录（尝试序号、错误、时间） |
| `task_idempotency` | 业务幂等键（唯一索引） |

## 验收标准

- 注入 30% 失败率，最终成功率 100%（或明确进死信），无消息丢失。
- 同一条消息投递 3 次，业务只生效一次（券只发一张）。
- 观察重试间隔：1s → 2s → 4s → 8s（有上限与抖动）。
- 消费被 `SIGTERM` 中断时，正在处理的消息不丢（优雅退出）。

## 关键决策

:::hint 三个必须想清楚的点
1. **幂等键从哪来**：业务键（用户 id + 活动 id）比消息 id 更可靠，因为上游可能重复生产。
2. **退避要有抖动**：固定间隔会在故障恢复瞬间形成「重试风暴」。
3. **死信不是垃圾桶**：要有查询与「重新投递」入口，否则等于丢数据。
:::

## 参考实现

:::solution 关键实现：可见性超时 + 指数退避 + 幂等键 + 死信，退出时等在途任务
`consumer.go`
```go
// 消费模型：Redis Stream（或 SQS）都适用。要点不是队列 API，而是三个不变量：
//   ① 处理完成才 ack（失败不 ack，让消息重新可见）
//   ② 幂等键唯一（重复投递只生效一次）
//   ③ 有上限的重试 + 死信
func (c *Consumer) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			c.wg.Wait() // 优雅退出：等在途任务处理完再返回
			return
		default:
		}

		msgs, err := c.q.Fetch(ctx, c.batch, 5*time.Second) // 可见性超时 5s
		if err != nil {
			log.Printf("[consumer] fetch: %v", err)
			time.Sleep(time.Second)
			continue
		}
		for _, m := range msgs {
			m := m
			c.wg.Add(1)
			go func() {
				defer c.wg.Done()
				c.handle(ctx, m)
			}()
		}
	}
}

func (c *Consumer) handle(ctx context.Context, m Message) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[consumer] panic on %s: %v", m.ID, r)
			c.retryOrDead(ctx, m, fmt.Errorf("panic: %v", r))
		}
	}()

	// 幂等：先抢唯一键，抢不到说明已经处理过（或正在别处处理）
	first, err := c.store.ClaimIdempotent(ctx, m.IdempotencyKey)
	if err != nil {
		c.retryOrDead(ctx, m, err)
		return
	}
	if !first {
		c.q.Ack(ctx, m.ID) // 已经生效过，直接 ack 掉，避免无限重投
		return
	}

	if err := c.biz.Apply(ctx, m); err != nil {
		c.retryOrDead(ctx, m, err)
		return
	}
	c.q.Ack(ctx, m.ID)
}
```
`retry.go`
```go
// 退避：1s → 2s → 4s → 8s，带抖动（避免所有失败消息同一秒重试打满下游）
// 超过上限进死信，并把「重试次数 + 最后错误」写回消息，值班能在后台看到
func (c *Consumer) retryOrDead(ctx context.Context, m Message, cause error) {
	m.Attempts++
	m.LastError = cause.Error()

	if m.Attempts >= c.maxAttempts {
		c.dead.Put(ctx, m)  // 死信表：不丢，等人工/定时补偿
		c.q.Ack(ctx, m.ID)
		log.Printf("[consumer] 进死信 id=%s attempts=%d err=%v", m.ID, m.Attempts, cause)
		return
	}

	delay := time.Duration(1<<(m.Attempts-1)) * time.Second // 1,2,4,8
	jitter := time.Duration(rand.Int63n(int64(delay / 2)))
	// 重新入队（延迟队列由队列侧支持的话更好：直接带 Delay）
	c.q.Requeue(ctx, m, delay+jitter)
	c.q.Ack(ctx, m.ID)
}
```
`store.go`
```go
// 幂等表：唯一键冲突 = 已处理过。用 INSERT IGNORE 而不是先查
func (s *Store) ClaimIdempotent(ctx context.Context, key string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT IGNORE INTO consumed_keys (idem_key, created_at) VALUES (?, NOW())`, key)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}
```
`schema.sql`
```sql
CREATE TABLE consumed_keys (
  idem_key   VARCHAR(128) PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE dead_letters (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  msg_id      VARCHAR(128) NOT NULL,
  payload     JSON NOT NULL,
  attempts    INT NOT NULL,
  last_error  VARCHAR(1024) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
JOB="job-$(date +%s%N)"

enqueue() { curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE/api/jobs" \
  -H 'Content-Type: application/json' -d "{\"jobId\":\"$JOB\",\"type\":\"send-mail\",\"payload\":{\"to\":\"a@b.c\"}}"; }
state() { curl -s "$BASE/api/jobs/$JOB" | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p'; }

echo "== 1. 投递任务 → 201；同 jobId 再投 → 200 且不产生第二条"
[ "$(enqueue)" = "201" ] || { echo "FAIL 投递失败"; cat /tmp/nl.body; exit 1; }
[ "$(enqueue)" = "200" ] && echo "PASS 重复投递幂等" || { echo "FAIL 重复 jobId 返回非 200"; exit 1; }

echo "== 2. 10 秒内应被消费完成"
for i in $(seq 1 20); do
  s=$(state)
  [ "$s" = "DONE" ] && break
  sleep 0.5
done
[ "$s" = "DONE" ] && echo "PASS 已消费（attempts 应为 1）" || { echo "FAIL 状态=$s"; exit 1; }
curl -s "$BASE/api/jobs/$JOB"; echo

echo "== 3. 失败重试：投一个必然失败的 type，attempts 应增长到上限后转 FAILED"
curl -s -X POST "$BASE/api/jobs" -H 'Content-Type: application/json' \
  -d "{\"jobId\":\"poison-$(date +%s)\",\"type\":\"always-fail\",\"payload\":{}}" >/dev/null
echo "（等 30 秒后查该 job：status=FAILED、attempts=3、且进入死信表）"

echo "== 4. 重复消费防护：同一 jobId 手工重投，业务副作用只发生一次"
echo "（核对业务日志：send-mail 只打印一次）"

echo "== 5. 崩溃恢复：消费到一半 kill -9 worker，重启后该任务应被重新投递"
echo "   # 手动：kill -9 <pid> → 重启 → 查 status 是否最终 DONE"
```
:::

## 延伸方向

- 延迟队列：用「可见时间」字段实现，避免 sleep 占住 worker。
- 优先级：高优任务走独立队列，防止被批量任务堵死。
- 指标：消费速率、失败率、重试分布、死信增长。
