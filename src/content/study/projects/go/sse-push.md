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

:::solution 关键实现：每连接一个带缓冲 chan + 慢客户端直接丢，Last-Event-ID 补发
`hub.go`
```go
// 关键点：注册表只在「注册/注销」时加锁，推送时不加锁
// （推送时持锁 = 一个慢客户端阻塞所有人）
type Hub struct {
	mu      sync.RWMutex
	clients map[string]*Client
	ring    *Ring // 最近 N 条消息，用于 Last-Event-ID 补发
}

type Client struct {
	id   string
	ch   chan Event // 缓冲 16，满了说明客户端读得慢
	done chan struct{}
}

func (h *Hub) Broadcast(e Event) {
	h.ring.Add(e)
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for _, c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		select {
		case c.ch <- e:
		default:
			// 缓冲满：这个客户端读不动了，断开它而不是阻塞广播。
			// 不能改成阻塞式发送 —— 那会让一个卡住的手机拖慢全站推送
			h.drop(c.id)
		}
	}
}
```
`sse.go`
```go
func (h *Hub) Serve(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // nginx 不缓冲

	c := h.register()
	defer h.drop(c.id)

	// 断线重连：Last-Event-ID 之后的消息先补齐，再进入实时流
	if last := r.Header.Get("Last-Event-ID"); last != "" {
		for _, e := range h.ring.Since(last) {
			writeEvent(w, e)
		}
		flusher.Flush()
	}

	heartbeat := time.NewTicker(15 * time.Second) // 小于常见 60s 空闲超时
	defer heartbeat.Stop()

	for {
		select {
		case e := <-c.ch:
			writeEvent(w, e)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprint(w, ": ping\n\n") // 注释行心跳，不触发 onmessage
			flusher.Flush()
		case <-r.Context().Done():
			return
		case <-h.shutdown:
			writeEvent(w, Event{Type: "closing", Data: "服务重启，请重连"})
			flusher.Flush()
			return
		}
	}
}

func writeEvent(w io.Writer, e Event) {
	// id 必须写，否则客户端重连时带不上 Last-Event-ID
	fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", e.ID, e.Type, e.Data)
}
```
`main.go`
```go
// 优雅退出：先把 shutdown 广播给所有连接，再等 hub 清空，最后才退出进程
// （直接 os.Exit 会让客户端只看到「连接被重置」，重连风暴）
func main() {
	hub := NewHub()
	srv := &http.Server{Addr: ":8080", Handler: routes(hub)}

	go srv.ListenAndServe()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	<-sig

	hub.Close()                      // ① 通知所有 SSE 连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)                // ② 停止接新请求，等已有请求结束
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
