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

:::solution 分批读 + 流式写
```java
public void export(long taskId, ExportParams p) {
    Path file = tempFile(taskId);
    long done = 0;
    try (SXSSFWorkbook wb = new SXSSFWorkbook(200);          // 内存里只留 200 行
         OutputStream out = Files.newOutputStream(file)) {
        Sheet sheet = wb.createSheet("orders");
        long lastId = 0;
        while (true) {
            List<Order> batch = orderMapper.pageById(lastId, 2000);  // 游标：id > lastId
            if (batch.isEmpty()) break;
            for (Order o : batch) appendRow(sheet, o);
            lastId = batch.get(batch.size() - 1).getId();
            done += batch.size();
            exportMapper.updateProgress(taskId, done);
        }
        wb.write(out);
        exportMapper.markDone(taskId, file.toString());
    } catch (Exception e) {
        Files.deleteIfExists(file);                           // 不留半截文件
        exportMapper.markFailed(taskId, e.getMessage());
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
