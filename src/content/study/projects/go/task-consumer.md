---
title: 任务队列消费者
route: go
direction: 异步
level: L3
weeks: 5-6
hours: 6-8
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

:::solution 消费者骨架（重试 + 退避 + 幂等）
```go
func (w *Worker) handle(ctx context.Context, m Message) error {
	key := m.BizKey()
	ok, err := w.idem.Acquire(ctx, key)   // INSERT ... ON DUPLICATE KEY → 已存在返回 false
	if err != nil {
		return err
	}
	if !ok {
		return nil // 已处理过，直接 ack
	}
	return w.do(ctx, m)
}

func (w *Worker) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case m, ok := <-w.queue.Consume():
			if !ok {
				return
			}
			err := w.handle(ctx, m)
			if err == nil {
				w.queue.Ack(m)
				continue
			}
			n := m.Attempt() + 1
			if n > maxAttempts {
				w.dead.Store(ctx, m, err)   // 死信 + ack
				w.queue.Ack(m)
				continue
			}
			backoff := time.Duration(1<<uint(n)) * time.Second
			backoff += time.Duration(rand.Intn(300)) * time.Millisecond // 抖动
			time.Sleep(backoff)
			w.queue.Nack(m, n, err)
		}
	}
}
```
:::

## 延伸方向

- 延迟队列：用「可见时间」字段实现，避免 sleep 占住 worker。
- 优先级：高优任务走独立队列，防止被批量任务堵死。
- 指标：消费速率、失败率、重试分布、死信增长。
