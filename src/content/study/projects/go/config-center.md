---
title: 配置中心
route: go
direction: 基础设施
level: L3
weeks: 8-9
tags: 热更新, 版本, 灰度, 兜底
summary: 让配置改了立刻生效、能回滚、配置中心挂了业务还能跑——这是「基础设施」的入门题。
---

## 业务背景

配置散落在各服务的环境变量里时，改一个开关要重启、排查时不知道线上到底是哪版配置。配置中心要解决四件事：**集中、热更新、可回滚、挂了能兜底**。

## 需求（用户故事）

- 作为开发，我改完配置 1 秒内服务生效，不用重启。
- 作为值班，我能看到每个配置的修改历史并回滚到上一版。
- 作为架构，配置中心整体挂掉时，业务服务要继续用本地缓存运行。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config/{app}?env=prod` | 返回 `{version, values}` |
| PUT | `/api/config/{app}` | `{values, baseVersion}` → 409 版本冲突 |
| GET | `/api/config/{app}/watch` | SSE 推送 `{version, values}` |
| GET | `/api/config/{app}/history` | 版本历史 |

## 数据模型

```sql
CREATE TABLE config_item (
  app VARCHAR(64) NOT NULL,
  env VARCHAR(16) NOT NULL,
  version BIGINT NOT NULL,
  values_json JSON NOT NULL,
  updated_by VARCHAR(64),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (app, env, version)
);
```

## 验收标准

- PUT 后，所有订阅方在 1 秒内收到新版本并应用。
- 用旧 `baseVersion` 提交 → 409，且库里的版本不变。
- 回滚到上一版本后，订阅方同样 1 秒内生效。
- 停掉配置中心，业务服务重启后仍能用本地缓存的最后一份配置启动。
- 版本号严格单调递增，不能出现回退。

## 关键决策

:::hint 三个设计点
1. **版本用乐观锁**：`baseVersion` 不匹配就 409，避免两个人同时改互相覆盖。
2. **推送用 SSE 而不是轮询**：轮询要么延迟大、要么请求多；SSE 一条长连接解决。
3. **本地缓存是最后一道防线**：启动时先读本地文件，再尝试拉远端；远端失败就继续用本地的，并在日志里告警。
:::

## 参考实现

:::solution 版本 + 订阅广播 + 本地兜底
```go
type Store struct {
	mu   sync.RWMutex
	cur  map[string]Value // key = app|env
	subs map[string][]chan Value
}

func (s *Store) Put(app, env string, values map[string]string, base int64) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := app + "|" + env
	cur := s.cur[key]
	if cur.Version != base {
		return 0, ErrVersionConflict
	}
	next := Value{Version: cur.Version + 1, Values: values}
	s.cur[key] = next
	for _, ch := range s.subs[key] {
		select { case ch <- next: default: } // 慢消费者丢帧，不阻塞写入
	}
	return next.Version, nil
}
```
```go
// 启动：先读本地缓存，保证远端挂了也能起
local, _ := os.ReadFile("/var/lib/app/config.json")
if local != nil { apply(local) }
if v, err := client.Fetch(app, env); err == nil { apply(v); saveLocal(v) }
```
:::

## 延伸方向

- 灰度配置：按实例/用户比例下发不同值。
- 配置校验：写入前用 JSON Schema 校验，避免推坏。
- 权限与审计：谁能改哪个 app 的哪个 key。
