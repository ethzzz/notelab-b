---
title: SSE 推送与在线状态
route: go
direction: 实时
level: L3
weeks: 8-9
hours: 6-8
requires: go:3-4
tags: SSE, 连接管理, 心跳, 背压
summary: 几千条长连接同时在线，难点不是推消息，而是「慢客户端不能拖垮服务、断线要能补齐」。
---

## 业务背景

站内通知、订单状态、在线人数都需要服务端主动推送。轮询太浪费，WebSocket 又偏重；SSE 用一条 HTTP 长连接就够，但它有自己的坑：连接泄漏、慢消费者、代理超时。

## 需求（用户故事）

- 作为用户，我打开页面就能实时收到通知，不需要刷新。
- 作为用户，我断网 10 秒后恢复，能补收这期间的消息。
- 作为运维，1000 条连接时内存平稳，某个慢客户端不影响别人。
- 作为用户，我能看到当前在线人数。

## 接口契约

```text
GET /api/stream          → text/event-stream
  id: <单调递增>
  event: message
  data: {"type":"notice","text":"..."}

Header: Last-Event-ID   → 断线重连时补发该 id 之后的消息
GET /api/online         → {"online": 128}
```

## 验收标准

- 1000 连接挂 10 分钟：内存增长 < 50MB，无 goroutine 泄漏。
- 人为让一个客户端不读：该连接被丢弃（或超时断开），其他连接不受影响。
- 断开后带 `Last-Event-ID` 重连：收到缺失的消息。
- `SIGTERM` 时所有连接收到关闭事件，进程干净退出。

## 关键决策

:::hint 背压是 SSE 的核心问题
每条连接一个**有缓冲**的 channel；写不进去（缓冲满）就**丢弃该客户端**，而不是阻塞广播循环。阻塞一次，所有用户一起卡死。
:::

## 参考实现

:::solution hub + 每连接缓冲 + 心跳
```go
type client struct {
	id   string
	ch   chan []byte
	gone chan struct{}
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*client]struct{}
}

func (h *Hub) broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.ch <- msg:
		default: // 缓冲满：慢客户端，直接断开
			close(c.gone)
		}
	}
}

func (h *Hub) serve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	c := &client{ch: make(chan []byte, 32), gone: make(chan struct{})}
	h.add(c)
	defer h.remove(c)

	ticker := time.NewTicker(15 * time.Second) // 心跳，防代理掐断
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-c.gone:
			return
		case b := <-c.ch:
			fmt.Fprintf(w, "data: %s\n\n", b)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"

echo "== 1. 建立 SSE 连接：6 秒内必须收到心跳（否则会被代理掐断）"
timeout 6 curl -sN "$BASE/api/stream" | head -c 200; echo

echo "== 2. 在线人数接口"
curl -s "$BASE/api/online"; echo

echo "== 3. 慢客户端不拖垮服务：开 50 条连接，其中 1 条故意不读"
for i in $(seq 49); do timeout 6 curl -sN "$BASE/api/stream" >/dev/null & done
timeout 6 curl -sN "$BASE/api/stream" | head -c 1 >/dev/null &   # 立刻停止读取的「慢客户端」
sleep 2
curl -s -o /dev/null -w '健康检查 status=%{http_code} time=%{time_total}s\n' "$BASE/api/online"
wait || true

echo "== 4. 断线重连补偿：带 Last-Event-ID 请求，应只补发该 id 之后的事件"
curl -s -N -H 'Last-Event-ID: 0' --max-time 3 "$BASE/api/stream" | head -c 200; echo
```
:::

## 延伸方向

- 事件持久化：断线补偿需要「按 id 回放」，把最近 N 条放 Redis。
- 分房间：只推给订阅了某个房间的连接。
- 多实例：用 Redis Pub/Sub 广播到各实例。
