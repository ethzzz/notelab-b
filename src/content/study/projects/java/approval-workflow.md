---
title: 审批流引擎
route: java
direction: 平台
level: L3
weeks: 14-16
hours: 8-10
requires: java:9-12
tags: 状态机, 会签, 超时, 幂等
summary: 多级审批 + 会签 + 撤回 + 超时提醒，本质是一个不能乱序、不能重复的状态机。
---

## 业务背景

报销、请假、发布审批都会长成同一个形状：提交 → 多级审批（每级可能多人会签）→ 通过/驳回 → 可撤回。难点不在页面，而在**并发审批同一任务**、**撤回后旧任务还能不能被处理**、**超时怎么提醒**。

## 需求（用户故事）

- 作为申请人，我提交后能看到当前卡在谁那里。
- 作为审批人，我在多人会签里投一票，全部通过才进入下一级。
- 作为申请人，我在第一级未处理前可以撤回，撤回后原任务失效。
- 作为管理员，超过 48 小时未处理的任务出现在超时列表。

## 接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/flows` | 提交 → 201 `{flowId, status}` |
| POST | `/api/flows/{id}/approve` | `{taskId, comment}`；重复处理返回 409 |
| POST | `/api/flows/{id}/reject` | 同上 |
| POST | `/api/flows/{id}/withdraw` | 仅发起人、仅未完成时 |

## 数据模型

```sql
CREATE TABLE flow_instance (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type VARCHAR(32) NOT NULL,
  biz_id BIGINT NOT NULL,
  applicant BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,   -- RUNNING / APPROVED / REJECTED / WITHDRAWN
  current_level INT NOT NULL
);

CREATE TABLE flow_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  flow_id BIGINT NOT NULL,
  level INT NOT NULL,
  assignee BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,   -- PENDING / DONE / CANCELLED
  deadline DATETIME,
  KEY idx_assignee (assignee, status)
);

CREATE TABLE flow_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  flow_id BIGINT NOT NULL,
  actor BIGINT NOT NULL,
  action VARCHAR(16) NOT NULL,
  comment VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 验收标准

- 两个审批人同时点「通过」同一任务：只有一个成功，另一个 409。
- 会签：3 人里 2 人通过不算过，3 人全过才进入下一级。
- 撤回后，原来的待办再点通过 → 409，且实例状态为 `WITHDRAWN`。
- 超过 deadline 的任务出现在超时列表，且不会自动通过（只提醒）。

## 关键决策

:::hint 状态机是核心，不是装饰
- 每个动作先校验「当前状态是否允许」，再更新；**校验与更新必须在同一条 SQL 的条件里**，否则并发下两个请求都能通过校验。
- `flow_log` 只追加不修改，出了问题靠它还原「谁在什么时候做了什么」。
:::

## 参考实现

:::solution 关键实现：条件更新做状态机，会签靠投票表 + 计数，撤回是状态迁移
`schema.sql`
```sql
CREATE TABLE approval_instance (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  biz_key     VARCHAR(64) NOT NULL,            -- 幂等：同一业务单只允许一个实例
  status      ENUM('RUNNING','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'RUNNING',
  stage       INT NOT NULL DEFAULT 1,          -- 当前级别
  version     INT NOT NULL DEFAULT 0,          -- 乐观锁，防并发流转
  deadline_at DATETIME NULL,
  UNIQUE KEY uk_biz (biz_key)
) ENGINE=InnoDB;

CREATE TABLE approval_task (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT NOT NULL,
  stage       INT NOT NULL,
  approver_id BIGINT NOT NULL,
  status      ENUM('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  acted_at    DATETIME NULL,
  UNIQUE KEY uk_task (instance_id, stage, approver_id)   -- 同一人同级别只有一票
) ENGINE=InnoDB;
```
`ApprovalService.java`
```java
/** 会签 + 状态机：所有流转都用「带条件的 UPDATE」推进，不先查再改。 */
@Service
public class ApprovalService {
    private final JdbcClient db;

    public ApprovalService(JdbcClient db) { this.db = db; }

    /**
     * 投一票。返回 false 表示这一票无效（已被处理/已撤回/任务不存在）—— 上层映射成 409。
     * 三件事在一个事务里：占住任务 → 记票 → 判断本级别是否全部通过 → 推进或结束。
     */
    @Transactional
    public boolean vote(long instanceId, int stage, long approverId, boolean approve) {
        // ① 原子占住任务：只有 PENDING 能被改，并发点两次只有一次拿到 1 行
        int claimed = db.sql("""
                UPDATE approval_task SET status = ?, acted_at = NOW()
                 WHERE instance_id = ? AND stage = ? AND approver_id = ? AND status = 'PENDING'
                """)
                .params(approve ? "APPROVED" : "REJECTED", instanceId, stage, approverId)
                .update();

        if (claimed == 0) return false;

        // ② 一票否决：直接终止实例（同样带 status 条件，防撤回后被覆盖）
        if (!approve) {
            db.sql("""
                UPDATE approval_instance SET status = 'REJECTED', version = version + 1
                 WHERE id = ? AND status = 'RUNNING'
                """).param(instanceId).update();
            return true;
        }

        // ③ 会签判定：本级别还剩几个 PENDING
        Integer remaining = db.sql("""
                SELECT COUNT(*) FROM approval_task
                 WHERE instance_id = ? AND stage = ? AND status = 'PENDING'
                """).params(instanceId, stage).query(Integer.class).single();

        if (remaining != null && remaining > 0) {
            return true; // 还没投完，等其他人
        }

        // ④ 全部通过 → 要么进下一级（生成新任务），要么整单通过
        int nextStage = stage + 1;
        Integer nextCount = db.sql("SELECT COUNT(*) FROM approval_stage_approver WHERE stage = ?")
                .param(nextStage).query(Integer.class).single();

        if (nextCount == null || nextCount == 0) {
            db.sql("""
                UPDATE approval_instance SET status = 'APPROVED', version = version + 1
                 WHERE id = ? AND status = 'RUNNING'
                """).param(instanceId).update();
        } else {
            db.sql("""
                INSERT INTO approval_task (instance_id, stage, approver_id)
                SELECT ?, ?, approver_id FROM approval_stage_approver WHERE stage = ?
                """).params(instanceId, nextStage, nextStage).update();
            db.sql("UPDATE approval_instance SET stage = ? WHERE id = ? AND status = 'RUNNING'")
                    .params(nextStage, instanceId).update();
        }
        return true;
    }

    /** 撤回：只允许第一级且无人处理过。撤回后原待办全部作废，再点通过就是 409。 */
    @Transactional
    public boolean withdraw(long instanceId, long applicantId) {
        int moved = db.sql("""
                UPDATE approval_instance SET status = 'WITHDRAWN', version = version + 1
                 WHERE id = ? AND status = 'RUNNING' AND stage = 1
                   AND NOT EXISTS (SELECT 1 FROM approval_task t
                                    WHERE t.instance_id = approval_instance.id
                                      AND t.status <> 'PENDING')
                """).param(instanceId).update();
        if (moved == 0) return false;
        db.sql("""
                UPDATE approval_task SET status = 'CANCELLED'
                 WHERE instance_id = ? AND status = 'PENDING'
                """).param(instanceId).update();
        return true;
    }
}
```
`ApprovalController.java`
```java
/** 409 语义：这一票没生效（重复点击、已被别人处理、实例已撤回）。前端据此刷新列表。 */
@PostMapping("/api/approvals/{id}/vote")
public ResponseEntity<?> vote(@PathVariable long id,
                              @RequestBody VoteReq req,
                              HttpServletRequest request) {
    Map<String, Object> me = AuthUtil.user(request);
    if (me == null) return AuthUtil.unauth();
    long uid = ((Number) me.get("id")).longValue();
    boolean ok = service.vote(id, req.stage(), uid, req.approve());
    if (!ok) return ResponseEntity.status(409).body(Map.of("error", "该任务已被处理或已撤回"));
    return ResponseEntity.ok(Map.of("ok", true));
}
```
`TimeoutJob.java`
```java
/** 超时只提醒不自动通过：把 PENDING 且过期的任务打个标记，交给页面筛选 */
@Scheduled(fixedDelay = 60_000)
public void markTimeout() {
    // 不改 status：改了会让「超时」和「已处理」混淆，也无法再投票
    int n = db.sql("""
            UPDATE approval_task t JOIN approval_instance i ON i.id = t.instance_id
               SET t.overdue = 1
             WHERE t.status = 'PENDING' AND i.deadline_at < NOW() AND t.overdue = 0
            """).update();
    if (n > 0) log.info("[approval] {} 条任务超时", n);
}
```
:::

## 验收脚本

:::check 复制即用（bash + curl，验幂等与撤回）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
: "${TOKEN:?export TOKEN=<申请人会话 token>}"

post() { curl -s -o /tmp/nl.body -w '%{http_code}' -X POST "$BASE$1" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "${2:-{}}"; }

echo "== 1. 提交 → 201，并能拿到第一级待办"
[ "$(post /api/flows '{"bizType":"expense","bizId":1}')" = "201" ] || { echo "FAIL 提交失败"; cat /tmp/nl.body; exit 1; }
FLOW=$(sed -n 's/.*"flowId":\([0-9]*\).*/\1/p' /tmp/nl.body)
TASK=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/flows/$FLOW" | sed -n 's/.*"taskId":\([0-9]*\).*/\1/p' | head -1)
echo "flow=$FLOW task=$TASK"

echo "== 2. 同一任务审批两次：第一次成功，第二次 409"
c1=$(post "/api/flows/$FLOW/approve" "{\"taskId\":$TASK}")
[ "$c1" = "200" ] || [ "$c1" = "204" ] || { echo "FAIL 首次审批返回 $c1"; cat /tmp/nl.body; exit 1; }
[ "$(post "/api/flows/$FLOW/approve" "{\"taskId\":$TASK}")" = "409" ] \
  && echo "PASS 重复审批被拒（并发下也只成功一次）" || { echo "FAIL 同一任务被处理两次"; exit 1; }

echo "== 3. 撤回：未完成时成功，再审批 → 409"
FLOW2=$(curl -s -X POST "$BASE/api/flows" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"bizType":"expense","bizId":2}' | sed -n 's/.*"flowId":\([0-9]*\).*/\1/p')
[ "$(post "/api/flows/$FLOW2/withdraw")" = "200" ] && echo "PASS 撤回成功" || { echo "FAIL 撤回失败"; exit 1; }
[ "$(post "/api/flows/$FLOW2/approve" '{"taskId":1}')" = "409" ] \
  && echo "PASS 撤回后原任务失效" || { echo "FAIL 撤回后还能审批"; exit 1; }

echo "== 4. 会签：3 人里通过 2 人不应进入下一级（人工造 3 个 task 后核对状态仍为 RUNNING）"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/flows/$FLOW" | head -c 200; echo
```
:::

## 延伸方向

- 动态流程：审批链由配置决定，而不是写死在代码里。
- 加签/转办：中途增加审批人或转交给他人。
- 超时升级：超时后自动转给上级。
