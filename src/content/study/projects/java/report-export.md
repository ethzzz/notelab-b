---
title: 百万行报表导出
route: java
direction: 数据
level: L3
weeks: 15-16
hours: 6-8
requires: java:5-8
tags: 流式, 游标, 内存, 异步任务
summary: 运营一句「导出全部订单」，就能把服务打出 OOM；正确做法是异步 + 分批 + 流式写。
---

## 业务背景

后台最常见的需求：「把筛选结果全导出成 Excel」。数据量小的时候 `select *` 一把梭没问题；到了百万行，一次性加载进内存就是事故——而且往往发生在月底报表高峰。

## 需求（用户故事）

- 作为运营，我提交导出后可以离开页面，稍后回来下载。
- 作为运营，我能看到进度（已处理多少行 / 总共多少行）。
- 作为运维，导出期间服务内存保持平稳，不影响在线请求。
- 作为开发，导出失败后能重试，且不会产生半截文件。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/exports` | `{type, params}` → 202 `{taskId}` |
| GET | `/api/exports/{id}` | `{status, done, total, url}` |
| GET | `/api/exports/{id}/file` | 下载（完成后才可访问） |

## 数据模型

```sql
CREATE TABLE export_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(32) NOT NULL,
  params_json JSON NOT NULL,
  status VARCHAR(16) NOT NULL,     -- PENDING / RUNNING / DONE / FAILED
  done_rows BIGINT NOT NULL DEFAULT 0,
  total_rows BIGINT,
  file_path VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expire_at DATETIME NOT NULL
);
```

## 验收标准

- 导出 100 万行：进程 RSS 峰值 < 500MB，且导出期间在线接口 P95 不劣化超过 20%。
- 进度每完成 5% 更新一次，前端能看到变化。
- 中途 kill 进程后重启，任务标记为 FAILED，可重试。
- 过期文件被清理，任务记录保留 7 天。

## 关键决策

:::hint 三件事决定会不会 OOM
1. **不要 `select *` 到 `List`**：用游标或 `limit/offset` 分批，每批处理完就丢。
2. **写出也用流**：`SXSSFWorkbook` 只保留 N 行在内存，其余落磁盘；CSV 更简单，直接 `OutputStream`。
3. **导出走独立线程池**：和在线请求隔离，否则一次导出会拖慢所有接口。
:::

## 参考实现

:::solution 关键实现：游标分页流式写 + 原子落盘 + 进度落库 + 可重试
`ExportJob.java`
```java
/** 导出用到的行：只留需要的四列，避免 SELECT * 把大字段带进内存。
 *  包级可见（非 public）—— 同一个文件里只能有一个 public 类型，正好与 ExportJob 同文件 */
record ExportRow(long id, String orderNo, long amount, java.time.LocalDateTime createdAt) {}

@Service
public class ExportJob {
    private final DataSource ds;
    private final JdbcClient db;
    private final ExecutorService pool = Executors.newFixedThreadPool(2);

    /** 提交即返回 jobId：导出是异步任务，不能占着 HTTP 连接 */
    public long submit(ExportReq req, long userId) {
        KeyHolder keys = new GeneratedKeyHolder();
        db.sql("""
                INSERT INTO export_job (user_id, status, total_rows, processed_rows)
                VALUES (?, 'PENDING', 0, 0)
                """).param(userId).update(keys);
        long jobId = keys.getKey().longValue();
        pool.submit(() -> run(jobId, req));
        return jobId;
    }

    /**
     * 核心：不用 OFFSET 翻页（越翻越慢），用 id 游标；
     * 边查边写，任何时刻内存里只有一批数据。
     */
    private void run(long jobId, ExportReq req) {
        Path tmp = Path.of("/data/exports", jobId + ".csv.tmp");
        Path out = Path.of("/data/exports", jobId + ".csv");
        long lastId = 0;
        long written = 0;
        try {
            db.sql("UPDATE export_job SET status='RUNNING' WHERE id=?").param(jobId).update();
            long total = db.sql("SELECT COUNT(*) FROM orders WHERE created_at >= ?")
                    .param(req.from()).query(Long.class).single();
            db.sql("UPDATE export_job SET total_rows=? WHERE id=?").params(total, jobId).update();

            try (BufferedWriter w = Files.newBufferedWriter(tmp, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                w.write("order_no,amount,created_at\n");
                while (true) {
                    // 每批 2000 行；ID 游标让每批都是索引区间扫描
                    List<Row> batch = db.sql("""
                            SELECT id, order_no, amount, created_at FROM orders
                             WHERE created_at >= ? AND id > ?
                             ORDER BY id LIMIT 2000
                            """).params(req.from(), lastId).query(ExportRow.class).list();
                    if (batch.isEmpty()) break;

                    for (ExportRow r : batch) {
                        w.write(csvLine(r));
                    }
                    lastId = batch.get(batch.size() - 1).id();
                    written += batch.size();
                    // 每完成 5% 更新一次进度（每次都写库会拖慢导出）
                    if (written * 20 / Math.max(1, total) != (written - batch.size()) * 20 / Math.max(1, total)) {
                        db.sql("UPDATE export_job SET processed_rows=? WHERE id=?")
                                .params(written, jobId).update();
                    }
                }
            }
            // 原子落盘：先写 .tmp 再 rename，避免用户下到半截文件
            Files.move(tmp, out, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            db.sql("UPDATE export_job SET status='DONE', processed_rows=?, file_path=? WHERE id=?")
                    .params(written, out.toString(), jobId).update();
        } catch (Exception e) {
            log.error("[export] job {} 失败", jobId, e);
            // 失败要清理半截文件，并把状态置 FAILED（可重试）
            try { Files.deleteIfExists(tmp); } catch (IOException ignored) { }
            db.sql("UPDATE export_job SET status='FAILED', last_error=? WHERE id=?")
                    .params(truncate(e.getMessage(), 500), jobId).update();
        }
    }
}
```
`ExportController.java`
```java
/** 三条接口：提交、查进度、下载。下载要校验归属，避免越权拿别人的报表。 */
@PostMapping("/api/exports")
public Map<String, Object> submit(@RequestBody ExportReq req, HttpServletRequest request) {
    Map<String, Object> me = AuthUtil.user(request);
    long jobId = job.submit(req, ((Number) me.get("id")).longValue());
    return Map.of("jobId", jobId, "status", "PENDING");
}

@GetMapping("/api/exports/{id}")
public Map<String, Object> progress(@PathVariable long id, HttpServletRequest request) {
    Map<String, Object> me = AuthUtil.user(request);
    Map<String, Object> job = db.sql("""
            SELECT id, status, total_rows, processed_rows, last_error FROM export_job
             WHERE id = ? AND user_id = ?
            """).params(id, ((Number) me.get("id")).longValue()).query().listOfRows()
            .stream().findFirst().orElseThrow(() -> new BizException(404, "任务不存在"));
    return job;
}
```
`ExportCleanupJob.java`
```java
/** 过期清理：文件留 3 天，任务记录留 7 天（记录是审计，不能跟文件一起删） */
@Scheduled(cron = "0 0 4 * * *")
public void cleanup() {
    db.sql("SELECT id, file_path FROM export_job WHERE status='DONE' AND created_at < NOW() - INTERVAL 3 DAY")
      .query().listOfRows().forEach(row -> {
          try { Files.deleteIfExists(Path.of(String.valueOf(row.get("file_path")))); } catch (IOException ignored) { }
          db.sql("UPDATE export_job SET status='EXPIRED', file_path=NULL WHERE id=?")
            .param(row.get("id")).update();
      });
    db.sql("DELETE FROM export_job WHERE created_at < NOW() - INTERVAL 7 DAY").update();
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
: "${TOKEN:?export TOKEN=<管理员或运营会话 token>}"

auth=(-H "Authorization: Bearer $TOKEN")
post() { curl -s -o /tmp/nl.body -w '%{http_code}' "${auth[@]}" -X POST "$BASE/api/exports" \
  -H 'Content-Type: application/json' -d '{"type":"orders","params":{"from":"2026-01-01","to":"2026-12-31"}}'; }

echo "== 1. 提交导出 → 202，拿到 taskId（不能同步阻塞）"
[ "$(post)" = "202" ] || { echo "FAIL 提交未返回 202"; cat /tmp/nl.body; exit 1; }
TID=$(sed -n 's/.*"taskId":\([0-9]*\).*/\1/p' /tmp/nl.body)
echo "taskId=$TID"

echo "== 2. 轮询进度：应能看到 done 递增（每 5% 更新一次）"
last=-1
for i in $(seq 1 60); do
  body=$(curl -s "${auth[@]}" "$BASE/api/exports/$TID")
  status=$(printf '%s' "$body" | sed -n 's/.*"status":"\([A-Z]*\)".*/\1/p')
  done_rows=$(printf '%s' "$body" | sed -n 's/.*"done":\([0-9]*\).*/\1/p')
  total=$(printf '%s' "$body" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
  [ "$done_rows" != "$last" ] && { echo "  status=$status done=$done_rows/$total"; last=$done_rows; }
  [ "$status" = "DONE" ] && break
  [ "$status" = "FAILED" ] && { echo "FAIL 任务失败"; cat /tmp/nl.body; exit 1; }
  sleep 1
done
[ "$status" = "DONE" ] || { echo "FAIL 超时未完成"; exit 1; }
[ "$done_rows" = "$total" ] && echo "PASS 全部行已处理（$total）" || { echo "FAIL 行数不符 done=$done_rows total=$total"; exit 1; }

echo "== 3. 文件可下载且非空"
curl -s -o /tmp/nl.xlsx -w 'http=%{http_code} bytes=%{size_download}\n' "${auth[@]}" "$BASE/api/exports/$TID/file"
[ "$(stat -c%s /tmp/nl.xlsx 2>/dev/null || stat -f%z /tmp/nl.xlsx)" -gt 1024 ] \
  && echo "PASS 文件已生成" || { echo "FAIL 文件过小或为空"; exit 1; }

echo "== 4. 人工核对内存：导出期间进程 RSS 峰值应 < 500MB"
echo "   # while true; do ps -o rss= -p \$(pgrep -f your-app) ; sleep 1; done | sort -n | tail -1"
```
:::

## 延伸方向

- 导出模板化：不同业务共用一套「筛选 → 明细 → 文件」流程。
- 大文件分片下载与断点续传。
- 导出配额：单用户同时只能有一个进行中的导出。
