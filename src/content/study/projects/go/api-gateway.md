---
title: 开放 API 网关
route: go
direction: 基础设施
level: L3
weeks: 5-8
hours: 8-10
requires: go:5-6
tags: 鉴权, 限流, 超时, 灰度
summary: 把「谁可以调、能调多快、超时怎么办」从业务代码里抽出来，变成一层可复用的中间件。
---

## 业务背景

对外提供 API 后，问题会集中爆发：某个第三方疯狂刷接口打满后端、上游变慢导致请求堆积、灰度发布要按客户分流、出了问题要能追到具体调用方。

这些东西写进每个业务接口就会失控，所以必须收敛成网关层。

## 需求（用户故事）

- 作为开放平台，每个第三方有独立 key 与配额，超了返回 429 而不是拖垮别人。
- 作为后端，上游慢于 800ms 就快速失败，不把连接池占满。
- 作为运营，我能按客户标记灰度，把 10% 流量导到新版本。
- 作为值班，我能按 `requestId` 查到一次调用的完整链路。

## 接口契约

```text
GET /api/v1/*            → 透传到上游
Header: X-Api-Key        → 鉴权；缺失/非法 → 401
Header: X-Request-Id     → 无则生成，写回响应
限流：429 {"error":"rate limited","retryAfter":2}
超时：504 {"error":"upstream timeout"}
```

| 中间件（顺序） | 作用 | 失败表现 |
|---|---|---|
| recover | 兜住 panic | 500 |
| requestID | 生成/透传 id | — |
| auth | 校验 key 与配额 | 401 |
| rateLimit | 令牌桶 | 429 |
| timeout | 上游超时 | 504 |
| log | 结构化访问日志 | — |

## 验收标准

- `wrk -c 50` 压测时，超过配额的请求返回 429，且不影响其他 key。
- 上游 `sleep 2s`，网关 800ms 返回 504，连接不堆积。
- 带 `X-Gray: 1` 的请求打到新版本，其余打旧版本。
- 日志里能用一个 `requestId` 串起入口与上游。

## 关键决策

:::hint 中间件顺序为什么是这五层
- **recover 必须在最外层**，否则后面 panic 没人接；
- **requestID 在 auth 之前**：鉴权失败也要能追到请求；
- **timeout 必须在 log 之内**：这样才能记录到「超时」这个状态码。
顺序错了不会报错，只会表现为「日志里看不到 504」。
:::

## 参考实现

:::solution 关键实现：限流、超时、灰度全在中间件链里，顺序不能乱
`gateway.go`
```go
// 顺序：RequestID → Auth+配额 → 灰度 → 超时 → 反代
// 反向依赖不可行：配额要在超时**之前**判（否则慢上游会先吃掉配额之外的连接）
func Chain(next http.Handler, g *Gateway) http.Handler {
	return withRequestID(withQuota(g)(withGray(g)(withUpstreamTimeout(800*time.Millisecond, next))))
}

func withRequestID(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" {
			id = uuid.NewString()
		}
		// 透传给上游，日志侧只认这一个 id
		r.Header.Set("X-Request-Id", id)
		w.Header().Set("X-Request-Id", id)
		h.ServeHTTP(w, r)
	})
}

func withQuota(g *Gateway) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-Api-Key")
			c, ok := g.clients[key]
			if !ok {
				http.Error(w, `{"error":"invalid key"}`, http.StatusUnauthorized)
				return
			}
			// 每个 key 独立令牌桶：超了只影响这个调用方
			if !c.bucket.Allow() {
				w.Header().Set("Retry-After", "1")
				http.Error(w, `{"error":"rate limited"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// 灰度：按客户标记分流，比例与版本都来自配置，不在代码里写死
func withGray(g *Gateway) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			target := g.upstreamV1
			if g.grayEnabled(r.Header.Get("X-Api-Key")) {
				target = g.upstreamV2
			}
			ctx := context.WithValue(r.Context(), ctxKeyUpstream{}, target)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// 超时：context 取消后反代会中断上游读，连接池不再被占
func withUpstreamTimeout(d time.Duration, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), d)
		defer cancel()
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}
```
`ratelimit.go`
```go
// 令牌桶：容量 burst，匀速补充 rate/s。单机够用；多副本要换 Redis（INCR + 过期）
type TokenBucket struct {
	mu     sync.Mutex
	tokens float64
	burst  float64
	rate   float64 // 每秒补充
	last   time.Time
}

func (b *TokenBucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	b.tokens = math.Min(b.burst, b.tokens+now.Sub(b.last).Seconds()*b.rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
```
`proxy.go`
```go
// 上游超时映射成 504（不是 500）：值班一眼能分辨「上游慢」和「网关自己错」
func (g *Gateway) proxy(w http.ResponseWriter, r *http.Request) {
	target := r.Context().Value(ctxKeyUpstream{}).(string)
	req, _ := http.NewRequestWithContext(r.Context(), r.Method, target+r.URL.Path, r.Body)
	req.Header = r.Header.Clone()

	resp, err := g.client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			http.Error(w, `{"error":"upstream timeout"}`, http.StatusGatewayTimeout)
			return
		}
		http.Error(w, `{"error":"bad gateway"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	copyHeader(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
KEY="${KEY:-demo-key}"

expect() {
  local want=$1 desc=$2; shift 2
  local got; got=$(curl -s -o /tmp/nl.body -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then printf 'PASS %s (%s)\n' "$desc" "$got"
  else printf 'FAIL %s  want=%s got=%s\n' "$desc" "$want" "$got"; cat /tmp/nl.body; exit 1; fi
}

echo "== 1. 没有 key → 401（不是 500，也不能透传上游）"
expect 401 "无 X-Api-Key" "$BASE/api/v1/orders"

echo "== 2. 合法 key → 200，并回写 X-Request-Id"
curl -s -D /tmp/nl.h -o /dev/null -H "X-Api-Key: $KEY" "$BASE/api/v1/orders"
grep -qi '^x-request-id:' /tmp/nl.h && echo "PASS 回写 requestId" || { echo "FAIL 响应缺 X-Request-Id"; exit 1; }

echo "== 3. 突发 200 次：应出现 429，其余 200"
seq 200 | xargs -P 50 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -H "X-Api-Key: $KEY" "$BASE/api/v1/orders" | sort | uniq -c
echo "（人工核对：429 的数量应与配额相符；且 429 不拖垮其他 key）"

echo "== 4. 慢上游：网关 800ms 超时应返回 504"
curl -s -o /tmp/nl.body -w 'status=%{http_code} time=%{time_total}s\n' \
  -H "X-Api-Key: $KEY" "$BASE/api/v1/slow"
```
:::

## 延伸方向

- 熔断：连续失败 N 次后短路，半开探测恢复。
- 指标：按 key 统计 QPS / 429 / 504 / P95。
- 配置热更新：配额与灰度比例改配置即生效，不重启。
