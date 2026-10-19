---
title: 开放 API 网关
route: go
direction: 基础设施
level: L3
weeks: 5-8
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

:::solution 中间件链 + 令牌桶 + 上游超时
```go
func chain(h http.Handler, ms ...func(http.Handler) http.Handler) http.Handler {
	for i := len(ms) - 1; i >= 0; i-- {
		h = ms[i](h)
	}
	return h
}

func withTimeout(next http.Handler, d time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), d)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func withRateLimit(next http.Handler, limiter *Limiter) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Api-Key")
		if !limiter.Allow(key) {
			w.Header().Set("Retry-After", "2")
			http.Error(w, `{"error":"rate limited"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```
```go
// 上游转发：带上 requestID 与超时
proxy := httputil.NewSingleHostReverseProxy(upstream)
proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
		w.WriteHeader(http.StatusGatewayTimeout)
		return
	}
	w.WriteHeader(http.StatusBadGateway)
}
```
:::

## 延伸方向

- 熔断：连续失败 N 次后短路，半开探测恢复。
- 指标：按 key 统计 QPS / 429 / 504 / P95。
- 配置热更新：配额与灰度比例改配置即生效，不重启。
