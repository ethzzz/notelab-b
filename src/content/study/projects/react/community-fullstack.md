---
title: 社区社群全栈：从 0 到 1
route: react
direction: 全栈
level: L4
weeks: 8-12
hours: 40-60
requires: react:5-6
tags: Node.js, Express, MySQL, Redis, 架构, 社群
summary: 从需求、架构、数据模型到认证、信息流、通知、审核、部署，完整搭一个可上线的社区全栈项目；重点练架构取舍和工程闭环。
---

## 业务背景

社区/社群产品是用户反馈的枢纽：用户在这里发帖、评论、点赞、关注，运营在这里收集声音、做活动、促活和会员转化。

它看起来只是「发帖 + 评论」，但真正难的是：

- 信息流怎么在关注关系和规模之间取舍；
- 点赞、通知、计数怎么保证幂等和最终一致；
- 内容审核和举报怎么闭环；
- 多实例下通知怎么推、会话怎么共享；
- 上线后怎么观测、限流、回滚。

这个项目就是把这些工程问题完整走一遍。

## 需求（用户故事）

- 作为用户，我能注册、登录、维护个人资料。
- 作为用户，我能发帖、评论、点赞、关注别人。
- 作为用户，我能在首页看到关注的人发的帖子，并继续翻页。
- 作为用户，别人点赞/评论/关注我时，我能收到通知，未读能标记已读。
- 作为用户，我能举报不良内容。
- 作为运营，我能在后台审核帖子、处理举报、封禁用户。
- 作为用户，我能购买会员并看到权益。
- 作为用户，我能搜索帖子和用户。

## 接口契约

统一前缀 `/api/v1`，统一响应：

```json
{ "code": "OK", "data": {}, "traceId": "..." }
```

错误：

```json
{ "code": "POST_NOT_FOUND", "message": "Post not found", "details": {}, "traceId": "..." }
```

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 刷新 token |
| POST | `/auth/logout` | 登出 |
| GET | `/users/me` | 当前用户 |
| PATCH | `/users/me` | 修改资料 |
| POST | `/users/:id/follow` | 关注 |
| DELETE | `/users/:id/follow` | 取关 |
| GET | `/feed` | 关注流，游标分页 |
| POST | `/posts` | 发帖 |
| GET | `/posts/:id` | 帖子详情 |
| DELETE | `/posts/:id` | 删除帖子 |
| POST | `/posts/:id/like` | 点赞 |
| DELETE | `/posts/:id/like` | 取消点赞 |
| GET | `/posts/:id/comments` | 评论列表 |
| POST | `/posts/:id/comments` | 发评论 |
| GET | `/notifications` | 通知列表 |
| POST | `/notifications/read` | 标记已读 |
| GET | `/notifications/stream` | SSE 通知 |
| POST | `/reports` | 举报 |
| GET | `/admin/posts?status=pending` | 待审核 |
| POST | `/admin/posts/:id/approve` | 通过 |
| POST | `/admin/posts/:id/reject` | 驳回 |
| GET | `/admin/reports` | 举报列表 |
| POST | `/admin/reports/:id/resolve` | 处理举报 |
| GET | `/plans` | 会员套餐 |
| POST | `/orders` | 下单 |
| POST | `/orders/:id/mock-pay` | 模拟支付回调 |
| POST | `/uploads/presign` | 获取直传地址 |
| GET | `/search?q=` | 搜索 |

分页统一游标：`?cursor=<created_at>_<id>&limit=20`；后台可用页码。

写接口支持 `Idempotency-Key`，重复请求返回第一次结果。

## 验收标准

- [ ] 注册 → 登录 → 刷新 → 登出全链路可用；
- [ ] access 过期能用 refresh 换新，旧 refresh 失效；
- [ ] 关注/取关幂等；
- [ ] 发帖后进入待审核，审核通过才出现在信息流；
- [ ] 点赞重复请求不重复计数；
- [ ] 信息流游标分页不重复、不丢数据；
- [ ] 点赞/评论/关注能产生通知，自己操作自己不通知；
- [ ] 通知断线重连后能拉到未读；
- [ ] 举报 → 后台处理 → 审计记录闭环；
- [ ] 订单重复提交只产生一单；
- [ ] 有单测、集成测试、e2e 和压测报告；
- [ ] Docker 可部署，Nginx 反代，SSE 不被缓冲；
- [ ] 有日志、指标、健康检查、优雅退出。

## 关键决策

:::hint 先想清楚这几件事，再动手
1. **为什么先做模块化单体，不做微服务？** 社区边界还在变，微服务会放大事务、部署和排查成本；先用模块化单体把边界跑清楚。
2. **信息流为什么先拉后推？** 拉模式写放大低、实现简单；推模式适合关注多、读多写少的场景，但要做收件箱和扇出。
3. **通知为什么用 Outbox + 队列？** 点赞和通知必须解耦；Outbox 保证事件不丢，队列负责重试。
4. **点赞为什么靠唯一约束？** 「先查再插」在并发下会重复；唯一键 + 事务才是幂等的根。
5. **认证为什么 access + refresh 轮换？** access 短、泄露影响小；refresh 可撤销、可轮换，解决 JWT 无法登出的问题。
6. **搜索为什么先 MySQL？** 社区初期数据量不大，先 LIKE + 索引；规模上来再上 Meilisearch/ES。
:::

## 参考实现

### 0. 技术栈与目录

| 层 | 选择 | 理由 |
|---|---|---|
| 运行时 | Node.js 20 + TypeScript strict | 长期支持、类型即契约 |
| 框架 | Express 5 | 生态大、中间件简单、支持 async 错误 |
| ORM | Prisma | schema/migration 清晰，复杂查询用 raw SQL |
| DB | MySQL 8 | 事务、索引成熟 |
| 缓存/队列 | Redis 7 + ioredis + BullMQ | 缓存、限流、队列一套 |
| 校验 | Zod | 运行时校验 + 类型推导 |
| 日志/指标 | Pino + prom-client | 结构化、Prometheus 标准 |
| 前端 | React 18 + Vite + TanStack Query | 开发快、生态熟 |
| 部署 | Docker + Nginx + GitHub Actions | 简单可迁移 |

```text
community/
  apps/api/src/
    modules/{auth,users,posts,comments,likes,feed,notifications,moderation,memberships,admin}/
    common/{config,errors,middleware,db,redis,logger,metrics,events,utils}/
    app.ts
    server.ts
  apps/api/prisma/{schema.prisma,migrations,seed.ts}
  apps/api/tests/
  apps/web/src/
  packages/shared/src/{types,contracts}/
  infra/{docker-compose.yml,nginx/}
  docs/adr/
```

### 1. 架构总览

```text
Web (React)
  → Nginx
    → API (Express)
      → MySQL（主数据）
      → Redis（缓存/队列/会话/限流）
      → MinIO/OSS（图片）
```

分层：

```text
interface（HTTP）
  → application（用例）
    → domain（规则）
      → infrastructure（DB/Redis/队列/存储）
```

规则：Controller 不写业务；Service 不拼 SQL；Repository 只管数据；跨模块用事件。

### 2. 数据模型

核心表：

```sql
users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64) NOT NULL,
  avatar_url VARCHAR(512),
  status ENUM('active','banned','deleted') DEFAULT 'active',
  created_at DATETIME(3),
  updated_at DATETIME(3)
)

refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3),
  created_at DATETIME(3),
  UNIQUE KEY uk_token (token_hash),
  KEY idx_user (user_id)
)

posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  author_id BIGINT NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  status ENUM('draft','pending','published','rejected','deleted') DEFAULT 'pending',
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at DATETIME(3),
  deleted_at DATETIME(3),
  KEY idx_author_time (author_id, created_at),
  KEY idx_status_time (status, created_at)
)

comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  parent_id BIGINT,
  content VARCHAR(2000) NOT NULL,
  status ENUM('pending','published','rejected','deleted') DEFAULT 'published',
  created_at DATETIME(3),
  KEY idx_post_time (post_id, created_at)
)

likes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  target_type ENUM('post','comment') NOT NULL,
  target_id BIGINT NOT NULL,
  created_at DATETIME(3),
  UNIQUE KEY uk_like (user_id, target_type, target_id),
  KEY idx_target (target_type, target_id)
)

follows (
  follower_id BIGINT NOT NULL,
  followee_id BIGINT NOT NULL,
  created_at DATETIME(3),
  PRIMARY KEY (follower_id, followee_id),
  KEY idx_followee (followee_id)
)

notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type ENUM('like','comment','follow','system') NOT NULL,
  actor_id BIGINT,
  target_type VARCHAR(32),
  target_id BIGINT,
  payload JSON,
  read_at DATETIME(3),
  created_at DATETIME(3),
  KEY idx_user_time (user_id, created_at)
)

outbox_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending','processing','done','failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at DATETIME(3),
  processed_at DATETIME(3),
  KEY idx_status (status, created_at)
)
```

**计数冗余**：`like_count/comment_count` 放在 `posts`，点赞/评论同事务 `+1`；定期对账修正。

### 3. 工程骨架

```bash
mkdir community && cd community
pnpm init
pnpm add -D typescript tsx @types/node eslint prettier husky lint-staged
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.json` 开 `strict` 和 `noUncheckedIndexedAccess`。monorepo 的理由：前后端共享类型、统一 lint/test/build；代价是依赖和构建配置更复杂。

### 4. 基础设施

`infra/docker-compose.yml`：

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: community
    ports: ["3306:3306"]
    volumes: ["mysql-data:/var/lib/mysql"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio-data:/data"]

volumes:
  mysql-data:
  minio-data:
```

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 5. 最小服务

```ts
import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}
```

```ts
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => console.log(`API on ${port}`));
```

先跑通 `/health`，再叠配置、日志、数据库。

### 6. 配置、日志、错误、trace

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
});

export const config = schema.parse(process.env);
```

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password'],
});
```

```ts
export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
```

```ts
app.use((req, res, next) => {
  const traceId = req.header('x-trace-id') ?? crypto.randomUUID();
  (req as any).traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
});

app.use((err, req, res, next) => {
  const traceId = (req as any).traceId;

  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      traceId,
    });
  }

  logger.error({ err, traceId }, 'unhandled error');
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal error', traceId });
});
```

### 7. Prisma 与迁移

```bash
pnpm --filter api add @prisma/client
pnpm --filter api add -D prisma
pnpm --filter api exec prisma init
```

schema 按第 2 节表映射；迁移：

```bash
pnpm --filter api exec prisma migrate dev --name init
pnpm --filter api exec prisma db seed
```

PrismaClient 单例导出，不要每个请求 new。

### 8. 认证与 RBAC

密码用 argon2：

```ts
import argon2 from 'argon2';

export const hashPassword = (p: string) => argon2.hash(p);
export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p);
```

Token：

- access：15 分钟 JWT，放请求头；
- refresh：7 天随机串，哈希存 DB，httpOnly Cookie；
- 刷新时轮换，旧 refresh 失效；
- 登出撤销 refresh。

```ts
const accessToken = jwt.sign(
  { sub: user.id, roles: user.roles },
  config.JWT_SECRET,
  { expiresIn: '15m' },
);
```

中间件：

```ts
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new AppError('UNAUTHORIZED', 401, 'Login required');

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    req.user = { id: BigInt(payload.sub), roles: payload.roles };
    next();
  } catch {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid token');
  }
}
```

RBAC：权限码唯一来源；前端隐藏只是体验，后端逐接口校验。

### 9. 用户与关注

```ts
await prisma.follows.upsert({
  where: { followerId_followeeId: { followerId, followeeId } },
  create: { followerId, followeeId },
  update: {},
});
```

唯一主键 + upsert 保证幂等；不能关注自己。

### 10. 帖子、评论、点赞

发帖 + Outbox 同事务：

```ts
await prisma.$transaction(async tx => {
  const post = await tx.post.create({
    data: { authorId: user.id, title, content, status: 'pending' },
  });

  await tx.outboxEvent.create({
    data: {
      type: 'post.created',
      payload: { postId: post.id.toString(), authorId: user.id.toString() },
    },
  });

  return post;
});
```

点赞：

```ts
await prisma.$transaction(async tx => {
  const created = await tx.like.createMany({
    data: [{ userId, targetType: 'post', targetId: postId }],
    skipDuplicates: true,
  });

  if (created.count === 1) {
    await tx.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });
    await tx.outboxEvent.create({
      data: {
        type: 'post.liked',
        payload: { postId: postId.toString(), userId: userId.toString() },
      },
    });
  }
});
```

**为什么**：唯一约束 + `skipDuplicates` 保证幂等；计数和点赞同事务；通知走 Outbox，不阻塞请求。

### 11. 信息流

先拉模式：

```sql
SELECT p.*
FROM posts p
JOIN follows f ON f.followee_id = p.author_id
WHERE f.follower_id = ?
  AND p.status = 'published'
  AND (p.created_at, p.id) < (?, ?)
ORDER BY p.created_at DESC, p.id DESC
LIMIT ?;
```

首页第一页缓存 30 秒；关注变化时失效。规模上来再演进到推模式（收件箱 + 扇出）。

### 12. 通知：Outbox + BullMQ + SSE

Outbox worker：

```ts
setInterval(async () => {
  const events = await prisma.outboxEvent.findMany({
    where: { status: 'pending' },
    take: 100,
    orderBy: { id: 'asc' },
  });

  for (const event of events) {
    await notificationQueue.add(event.type, event.payload, {
      jobId: event.id.toString(),
      removeOnComplete: true,
    });
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'processing' },
    });
  }
}, 1000);
```

SSE：

```ts
app.get('/api/v1/notifications/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const channel = `notify:${req.user.id}`;
  const sub = redis.duplicate();
  sub.subscribe(channel);
  sub.on('message', (_, message) => {
    res.write(`event: notification\ndata: ${message}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sub.quit();
  });
});
```

多实例用 Redis pub/sub；自己操作自己不通知；重复事件靠 `jobId` 去重。

### 13. 审核与举报

状态机：

```text
draft → pending → published
              ↘ rejected
published → deleted
```

- 敏感词命中 → `pending`；
- 用户举报 → `reports` pending；
- 后台处理 → `resolved/rejected`，写 `moderation_records`；
- 权限码：`post:review`、`report:handle`。

### 14. 会员与订单

```ts
const key = req.header('Idempotency-Key');
const existing = await prisma.order.findUnique({ where: { idempotencyKey: key } });
if (existing) return existing;

const order = await prisma.order.create({
  data: { userId, planId, amountCents, status: 'pending', idempotencyKey: key },
});
```

支付回调：验签 → 幂等 → 事务更新订单 + 发权益 + Outbox。

### 15. 文件上传

- 前端向服务端要 presigned URL；
- 直传 MinIO/OSS；
- 服务端只存元数据；
- 校验类型/大小；
- 异步压缩/审核。

### 16. 搜索

先 MySQL `LIKE` + 索引；规模上来上 Meilisearch/Elasticsearch；通过 Outbox 同步索引。

### 17. 后台管理

- RBAC + 权限码；
- 审核、举报、封禁、删除；
- 所有操作写审计；
- 页码分页；
- 前端独立后台。

### 18. 测试

- 单元：Service、纯函数、边界；
- 集成：Supertest + 测试库，注册/登录/发帖/点赞；
- e2e：Playwright 注册 → 发帖 → 评论 → 点赞 → 通知；
- 压测：`autocannon -c 100 -d 30 /api/v1/feed`。

### 19. 部署

Dockerfile 多阶段：deps → build → runtime；Nginx 反代；SSE 的 location 单独关 `proxy_buffering`；CI 卡 lint/typecheck/test/build；部署前 `prisma migrate deploy`，迁移向前兼容。

### 20. 可观测性

- Pino 结构化日志 + traceId；
- prom-client `/metrics`；
- `/health`、`/ready`；
- 告警：错误率、P95、DB 连接、Redis、队列积压；
- 可选 OpenTelemetry。

### 21. 高并发演进

| 阶段 | 问题 | 方案 |
|---|---|---|
| 单机 | DB 压力 | 索引、缓存、连接池 |
| 读多 | 列表慢 | Redis、本地缓存、读写分离 |
| 写多 | 计数/通知慢 | MQ、异步、批量 |
| 热点 | 单 key 打满 | 本地缓存、分片、限流 |
| 数据大 | 单表慢 | 分区、归档、分库分表 |
| 多实例 | 会话/SSE | Redis 共享、pub/sub |
| 故障 | 雪崩 | 限流、熔断、降级 |

## 验收脚本

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000/api/v1}"

expect() {
  local want=$1 desc=$2; shift 2
  local got; got=$(curl -s -o /tmp/nl.body -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then printf 'PASS %s (%s)\n' "$desc" "$got"
  else printf 'FAIL %s want=%s got=%s\n' "$desc" "$want" "$got"; cat /tmp/nl.body; exit 1; fi
}

echo "== 1. 注册登录"
expect 201 "注册" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"email":"a@test.com","password":"Passw0rd!","nickname":"A"}'
expect 200 "登录" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"a@test.com","password":"Passw0rd!"}'

echo "== 2. 发帖 → 待审核"
expect 201 "发帖" -X POST "$BASE/posts" -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' -d '{"title":"hello","content":"world"}'

echo "== 3. 点赞幂等：连续两次，计数只加一"
curl -s -X POST "$BASE/posts/1/like" -H 'Authorization: Bearer <token>' >/dev/null
curl -s -X POST "$BASE/posts/1/like" -H 'Authorization: Bearer <token>' >/dev/null

echo "== 4. 压测信息流"
npx autocannon -c 100 -d 30 "$BASE/feed"
```

浏览器核对：

- [ ] 两个账号互相关注，首页能看到对方已发布的帖子；
- [ ] 点赞后作者收到通知，自己赞自己不通知；
- [ ] 断网重连后通知能补齐；
- [ ] 重复提交订单只产生一单。

## 延伸方向

- 前端页面与状态管理；
- 搜索服务（Meilisearch/ES）；
- 支付接入与对账；
- K8s 部署与滚动更新；
- 推荐流与热度排序；
- 多租户与内容安全。

## 版本记录

| 版本 | 日期 | 修改 |
|---|---|---|
| v0.1 | 2026-11-07 | 初版：需求、架构、数据模型、核心模块、测试、部署、高并发演进 |
| v1.0 | 待定 | 补前端、搜索、支付、K8s，完成可演示验收 |
