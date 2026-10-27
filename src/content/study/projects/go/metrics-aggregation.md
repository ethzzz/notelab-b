---
title: 指标采集与聚合
route: go
direction: 数据
level: L3
weeks: 8-9
hours: 6-8
requires: go:5-6
tags: 去重, 预聚合, 批量写, 查询
summary: 客户端埋点量大、会重复、还会补报；服务端要在写入时就聚合好，查询才能便宜。
---

## 业务背景

埋点上报有三个特点：量大（十万/分钟）、会重复（重试、补报）、查询要快（运营看板要秒开）。直接把原始事件塞库、查询时再 `count`，库会先撑不住。

## 需求（用户故事）

- 作为客户端，我可以批量上报，单条失败不影响整批。
- 作为数据，同一个 `eventId` 重复上报只算一次。
- 作为运营，我查「昨天某事件的分时 PV」要在 200ms 内返回。

## 接口契约

```text
POST /api/metrics/batch
  {events:[{eventId, name, uid, ts, props}]}
  → 200 {accepted: n, duplicated: m}

GET /api/metrics?name=click&from=...&to=...&granularity=minute
  → {series:[{bucket, count}]}
```

## 数据模型

```sql
CREATE TABLE event_raw (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  uid VARCHAR(64),
  ts DATETIME(3) NOT NULL,
  UNIQUE KEY uk_event_id (event_id),          -- 去重靠唯一索引
  KEY idx_name_ts (name, ts)
);

CREATE TABLE metric_rollup (
  name VARCHAR(64) NOT NULL,
  bucket DATETIME NOT NULL,                   -- 分钟粒度
  cnt BIGINT NOT NULL,
  PRIMARY KEY (name, bucket)
);
```

## 验收标准

- 同一 `eventId` 上报 5 次，`metric_rollup` 只加 1。
- 压 10 万事件/分钟：不丢、不 OOM，写入延迟 P95 < 100ms。
- 查询 24 小时分时数据 P95 < 200ms（走 rollup，不扫原始表）。
- 服务重启后未落盘的事件不丢（批量写失败要重试或回退到单条）。

## 关键决策

:::hint 写入时聚合，而不是查询时聚合
查询时聚合意味着每次看板都要扫一遍原始事件，数据量一大就崩。写入时按分钟 bucket 累加，查询只读 rollup 表——代价是「原始数据只用于去重与追溯」。
:::

## 参考实现

:::solution 关键实现：事件去重 → 分钟桶 upsert → 查询只扫 rollup
`ingest.go`
```go
// 批量：一条坏数据不能拖垮整批。先解成合法事件，再单条插入并把错误按行收集
func (h *Handler) Ingest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Events []Event `json:"events"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad body"}`, http.StatusBadRequest)
		return
	}
	var accepted, duplicated int
	var failures []string
	for _, e := range req.Events {
		if err := e.Validate(); err != nil {
			failures = append(failures, e.EventID+": "+err.Error())
			continue
		}
		ok, err := h.store.SaveEvent(r.Context(), e)
		switch {
		case err != nil:
			failures = append(failures, e.EventID+": "+err.Error())
		case !ok:
			duplicated++ // eventId 已存在，不算错
		default:
			accepted++
		}
	}
	writeJSON(w, map[string]any{"accepted": accepted, "duplicated": duplicated, "failed": failures})
}

// 去重靠唯一索引：INSERT IGNORE 返回 0 行即为重复，比先 SELECT 再 INSERT 少一次往返、也没有竞态
func (s *Store) SaveEvent(ctx context.Context, e Event) (bool, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT IGNORE INTO metrics_raw (event_id, name, ts, payload)
		VALUES (?, ?, ?, ?)`, e.EventID, e.Name, e.Ts, e.Payload)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}
```
`rollup.go`
```go
// 预聚合：按「事件名 + 分钟」累加。ON DUPLICATE KEY UPDATE 让并发写同一个桶也是安全的
// （MySQL 会加行锁，后到的等前者提交后继续累加）
func rollupBatch(ctx context.Context, tx *sql.Tx, events []Event) error {
	type bucket struct {
		name     string
		minute   int64
		count    int64
		uniqSeen map[string]struct{}
	}
	agg := map[string]*bucket{}
	for _, e := range events {
		minute := e.Ts.Truncate(time.Minute).Unix()
		k := e.Name + "|" + strconv.FormatInt(minute, 10)
		b, ok := agg[k]
		if !ok {
			b = &bucket{name: e.Name, minute: minute, uniqSeen: map[string]struct{}{}}
			agg[k] = b
		}
		b.count++
		b.uniqSeen[e.VisitorID] = struct{}{}
	}
	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO metric_rollup (name, minute, pv, uv)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE pv = pv + VALUES(pv), uv = uv + VALUES(uv)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, b := range agg {
		if _, err := stmt.ExecContext(ctx, b.name, b.minute, b.count, len(b.uniqSeen)); err != nil {
			return err
		}
	}
	return nil
}
```
`query.go`
```go
// 查 24 小时分时：只扫 rollup（≤1440 行），永远不碰原始表
// 缺桶补零在 SQL 外用 map 填，避免用复杂的递归 CTE
func (s *Store) Hourly(ctx context.Context, name string, from, to time.Time) ([]Point, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT UNIX_TIMESTAMP(DATE_FORMAT(FROM_UNIXTIME(minute*60), '%Y-%m-%d %H:00:00')) AS h,
		       SUM(pv) AS pv, SUM(uv) AS uv
		  FROM metric_rollup
		 WHERE name = ? AND minute >= ? AND minute < ?
		 GROUP BY h ORDER BY h`, name, from.Unix(), to.Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	got := map[int64]Point{}
	for rows.Next() {
		var p Point
		if err := rows.Scan(&p.Ts, &p.PV, &p.UV); err != nil {
			return nil, err
		}
		got[p.Ts] = p
	}
	// 补零：图上少一段和「那小时真的是 0」必须能区分
	out := make([]Point, 0, 24)
	for t := from; t.Before(to); t = t.Add(time.Hour) {
		p, ok := got[t.Unix()]
		if !ok {
			p = Point{Ts: t.Unix()}
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
EID="ev-$(date +%s%N)"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

send() { # send <eventId>
  curl -s -X POST "$BASE/api/metrics/batch" -H 'Content-Type: application/json' \
    -d "{\"events\":[{\"eventId\":\"$1\",\"name\":\"click\",\"uid\":\"u1\",\"ts\":\"$TS\"}]}"
}

echo "== 1. 首次上报 → accepted=1, duplicated=0"
echo "$(send "$EID")"

echo "== 2. 同一 eventId 再报 3 次 → 全部 duplicated，不重复计数"
for _ in 1 2 3; do send "$EID"; echo; done

echo "== 3. 聚合数只加 1：按分钟查该事件"
curl -s "$BASE/api/metrics?name=click&from=$TS&to=$TS&granularity=minute"; echo
echo "（人工核对：改前计数 +1，而不是 +4）"

echo "== 4. 批量与并发：一次推 1000 条不同 eventId，应全部 accepted 且无 5xx"
{
  printf '{"events":['
  for i in $(seq 1 1000); do
    [ "$i" -gt 1 ] && printf ','
    printf '{"eventId":"bulk-%s-%d","name":"click","uid":"u%d","ts":"%s"}' "$EID" "$i" "$i" "$TS"
  done
  printf ']}'
} > /tmp/nl.batch
curl -s -o /tmp/nl.out -w 'status=%{http_code}\n' -X POST "$BASE/api/metrics/batch" \
  -H 'Content-Type: application/json' --data-binary @/tmp/nl.batch
head -c 200 /tmp/nl.out; echo
```
:::

## 延伸方向

- 多维度：按渠道/版本拆 rollup 的键。
- 原始数据归档：超过 7 天转冷存储。
- 实时看板：rollup 再按秒缓存一层。
