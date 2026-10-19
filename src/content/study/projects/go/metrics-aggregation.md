---
title: 指标采集与聚合
route: go
direction: 数据
level: L3
weeks: 8-9
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

:::solution 批量插入 + upsert 累加
```go
func (s *Store) Ingest(ctx context.Context, events []Event) (accepted, dup int, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	for _, e := range events {
		res, err := tx.ExecContext(ctx,
			`INSERT IGNORE INTO event_raw (event_id, name, uid, ts) VALUES (?, ?, ?, ?)`,
			e.EventID, e.Name, e.UID, e.TS)
		if err != nil {
			return 0, 0, err
		}
		n, _ := res.RowsAffected()
		if n == 0 { // 已存在，跳过聚合
			dup++
			continue
		}
		bucket := e.TS.Truncate(time.Minute)
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO metric_rollup (name, bucket, cnt) VALUES (?, ?, 1)
			 ON DUPLICATE KEY UPDATE cnt = cnt + 1`, e.Name, bucket); err != nil {
			return 0, 0, err
		}
		accepted++
	}
	return accepted, dup, tx.Commit()
}
```
:::

## 延伸方向

- 多维度：按渠道/版本拆 rollup 的键。
- 原始数据归档：超过 7 天转冷存储。
- 实时看板：rollup 再按秒缓存一层。
