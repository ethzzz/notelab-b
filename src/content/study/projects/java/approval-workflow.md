---
title: 审批流引擎
route: java
direction: 平台
level: L3
weeks: 14-16
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

:::solution 条件更新 + 会签计数
```java
@Transactional
public void approve(long flowId, long taskId, long actor, String comment) {
    // 只有 PENDING 且 assignee 是自己才能处理
    int updated = taskMapper.markDone(taskId, actor);
    if (updated == 0) throw new ConflictException("任务已处理或无权处理");

    logMapper.append(flowId, actor, "APPROVE", comment);

    int pending = taskMapper.countPending(flowId, currentLevel);
    if (pending > 0) return;                 // 会签未满，等待其他人

    flowMapper.advanceLevel(flowId);          // 进入下一级或置为 APPROVED
}
```
```java
// 撤回：实例条件更新 + 未完成任务批量取消
if (flowMapper.withdraw(flowId, applicant) == 0) throw new ConflictException("不可撤回");
taskMapper.cancelPending(flowId);
```
:::

## 延伸方向

- 动态流程：审批链由配置决定，而不是写死在代码里。
- 加签/转办：中途增加审批人或转交给他人。
- 超时升级：超时后自动转给上级。
