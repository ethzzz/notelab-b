---
title: 配置中心
route: go
direction: 基础设施
level: L3
weeks: 8-9
hours: 6-8
requires: go:5-6
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

:::solution 关键实现：版本号 CAS + 长轮询推送 + 本地快照兜底
`store.go`
```go
// 更新：revision 严格单调。用 CAS（WHERE revision = base）而不是自增读写，
// 两个管理员同时改，后到的那个拿 409 —— 自增会静默覆盖别人的修改
func (s *Store) Put(ctx context.Context, key, value string, base int64, operator string) (int64, error) {
	res, err := s.db.ExecContext(ctx, `
		UPDATE config_items
		   SET value = ?, revision = revision + 1, operator = ?, updated_at = NOW()
		 WHERE k = ? AND revision = ?`, value, operator, key, base)
	if err != nil {
		return 0, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// 区分「不存在」与「版本冲突」，前端才能给出正确提示
		var cur int64
		if err := s.db.QueryRowContext(ctx, `SELECT revision FROM config_items WHERE k = ?`, key).Scan(&cur); err == nil {
			return cur, ErrVersionConflict
		}
		return 0, ErrNotFound
	}
	var rev int64
	err = s.db.QueryRowContext(ctx, `SELECT revision FROM config_items WHERE k = ?`, key).Scan(&rev)
	s.broker.Notify(key, rev)
	return rev, err
}
```
`watch.go`
```go
// 推送两条腿：
//   ① 长轮询 GET /api/config/watch?key=k&after=rev —— 20s 内没变化就返回空，客户端立刻再连
//   ② 进程内广播（同一实例的订阅者先到先得）
// 不能只做 ①（1s 生效要求延迟低）也不能只做 ②（多实例不同步）
func (s *Store) Watch(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)

	ch, cancel := s.broker.Subscribe(key)
	defer cancel()

	ctx, done := context.WithTimeout(r.Context(), 20*time.Second)
	defer done()

	for {
		rev, val, ok := s.current(key)
		if ok && rev > after {
			writeJSON(w, map[string]any{"revision": rev, "value": val})
			return
		}
		select {
		case <-ch: // 有新版本，回到循环顶部复核 revision
		case <-ctx.Done():
			w.WriteHeader(http.StatusNoContent) // 无变化：客户端立即重连
			return
		}
	}
}
```
`bootstrap.go`
```go
// 兜底：启动先读本地快照，配置中心连不上也能起。
// 快照必须在**每次成功拉取后**原子替换（写 .tmp 再 rename），否则断电会读到半个 JSON
func LoadOrDefault(ctx context.Context, client *Client, snapshotPath string) (map[string]string, error) {
	if cfg, err := client.FetchAll(ctx); err == nil {
		b, _ := json.Marshal(cfg)
		tmp := snapshotPath + ".tmp"
		os.WriteFile(tmp, b, 0o600)
		os.Rename(tmp, snapshotPath)
		return cfg, nil
	}
	b, err := os.ReadFile(snapshotPath)
	if err != nil {
		return nil, fmt.Errorf("配置中心不可用且无本地快照: %w", err)
	}
	var cfg map[string]string
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, fmt.Errorf("快照损坏: %w", err)
	}
	log.Printf("[config] 降级为本地快照（%d 项）", len(cfg))
	return cfg, nil
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl，验乐观锁与推送）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
APP="${APP:-web}"

ver() { curl -s "$BASE/api/config/$APP?env=prod" | sed -n 's/.*"version":\([0-9]*\).*/\1/p'; }
put() { curl -s -o /tmp/nl.body -w '%{http_code}' -X PUT "$BASE/api/config/$APP" \
  -H 'Content-Type: application/json' -d "{\"values\":{\"k\":\"$2\"},\"baseVersion\":$1}"; }

V=$(ver); echo "当前版本 v$V"

echo "== 1. 用过期 baseVersion 提交 → 409，且库里的版本不变"
[ "$(put 0 "stale")" = "409" ] || { echo "FAIL 旧版本没有被拒绝"; exit 1; }
[ "$(ver)" = "$V" ] && echo "PASS 版本未被改动（仍 v$V）" || { echo "FAIL 版本被写入"; exit 1; }

echo "== 2. 正确 baseVersion → 版本 +1"
[ "$(put "$V" "v-$RANDOM")" = "200" ] || { echo "FAIL 正常写入失败"; exit 1; }
[ "$(ver)" = "$((V + 1))" ] && echo "PASS 版本递增到 v$((V + 1))" || { echo "FAIL 版本没有单调递增"; exit 1; }

echo "== 3. 订阅者在 1 秒内收到新版本"
( timeout 4 curl -sN "$BASE/api/config/$APP/watch" > /tmp/nl.sse ) & watcher=$!
sleep 1
put "$((V + 1))" "push-$RANDOM" > /dev/null
wait $watcher || true
grep -q "\"version\":$((V + 2))" /tmp/nl.sse \
  && echo "PASS 订阅者收到 v$((V + 2))" || { echo "FAIL SSE 未收到推送"; head -c 300 /tmp/nl.sse; exit 1; }
```
:::

## 延伸方向

- 灰度配置：按实例/用户比例下发不同值。
- 配置校验：写入前用 JSON Schema 校验，避免推坏。
- 权限与审计：谁能改哪个 app 的哪个 key。
