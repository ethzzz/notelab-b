---
title: 社区社群全栈：从 0 到 1
route: react
direction: 全栈
level: L4
weeks: 8-12
hours: 40-60
requires: react:5-6
tags: Node.js, Express, MySQL, Redis, 架构, 社群
summary: 按真实开发顺序，从仓库初始化、基础设施、认证、帖子、点赞、信息流、通知、审核、会员，一路做到前端、测试、部署和高并发演进；每一步都有命令、完整关键代码和验收。
---

## 项目说明

这个项目按「能跟着做出来」组织，不是架构综述。

- 业务：社区/社群（发帖、评论、点赞、关注、信息流、通知、审核、会员）。
- 后端：Node.js 20 + TypeScript + Express 5 + Prisma + MySQL 8 + Redis 7 + BullMQ。
- 前端：React 18 + Vite + TanStack Query。
- 交付：Docker + Nginx + GitHub Actions；K8s 作为演进。
- 原则：**先跑通闭环，再加缓存、队列和治理**。

每一步都有：

1. **目标**：这一步结束能做什么；
2. **命令**：复制即用；
3. **代码**：关键文件完整代码；
4. **为什么**：为什么这样设计；
5. **验收**：curl 或命令；
6. **常见错误**：这一步最容易踩的坑。

> 代码里的 `BigInt` 会在 `app.ts` 统一转字符串，避免 `res.json` 报 `Do not know how to serialize a BigInt`。

## 需求（用户故事）

- 用户：注册、登录、刷新、登出、个人资料。
- 内容：发帖、评论、回复、点赞、关注。
- 信息流：关注流，游标分页。
- 通知：点赞、评论、关注；未读/已读；SSE 实时。
- 治理：审核、举报、封禁、审计。
- 商业化：会员套餐、订单、权益。
- 搜索：帖子、用户。
- 运营后台：审核、举报、用户管理。

## 接口契约

统一前缀 `/api/v1`；统一响应：

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
| POST | `/auth/refresh` | 刷新 |
| POST | `/auth/logout` | 登出 |
| GET | `/users/me` | 当前用户 |
| PATCH | `/users/me` | 改资料 |
| POST | `/users/:id/follow` | 关注 |
| DELETE | `/users/:id/follow` | 取关 |
| GET | `/feed` | 关注流 |
| POST | `/posts` | 发帖 |
| GET | `/posts/:id` | 详情 |
| DELETE | `/posts/:id` | 删除 |
| POST | `/posts/:id/like` | 点赞 |
| DELETE | `/posts/:id/like` | 取消 |
| GET | `/posts/:id/comments` | 评论列表 |
| POST | `/posts/:id/comments` | 发评论 |
| GET | `/notifications` | 通知列表 |
| POST | `/notifications/read` | 标记已读 |
| GET | `/notifications/stream` | SSE |
| POST | `/reports` | 举报 |
| GET | `/admin/posts` | 待审核 |
| POST | `/admin/posts/:id/approve` | 通过 |
| POST | `/admin/posts/:id/reject` | 驳回 |
| GET | `/admin/reports` | 举报列表 |
| POST | `/admin/reports/:id/resolve` | 处理 |
| GET | `/plans` | 套餐 |
| POST | `/orders` | 下单 |
| POST | `/orders/:id/mock-pay` | 模拟支付 |
| POST | `/uploads/presign` | 直传签名 |
| GET | `/search?q=` | 搜索 |

分页：游标 `?cursor=<createdAt>_<id>&limit=20`；后台用页码。

## 验收标准

- [ ] 注册 → 登录 → 刷新 → 登出；
- [ ] 关注/取关幂等；
- [ ] 发帖进入待审核，通过后进入信息流；
- [ ] 重复点赞不重复计数；
- [ ] 信息流游标分页不重不漏；
- [ ] 点赞/评论/关注产生通知，自己操作自己不通知；
- [ ] SSE 断线重连能补未读；
- [ ] 举报 → 处理 → 审计闭环；
- [ ] 重复下单只产生一单；
- [ ] 有单测、集成、e2e、压测；
- [ ] Docker 部署、Nginx 反代、SSE 不缓冲；
- [ ] 有日志、指标、健康检查、优雅退出。

## 关键决策

:::hint 先定这六个决策
1. **模块化单体**：社区边界还在变，先保证事务和部署简单；后续按模块拆。
2. **信息流先拉后推**：拉模式简单；推模式适合关注多、读多写少的场景。
3. **Outbox + 队列**：点赞和通知解耦，事件不丢，失败可重试。
4. **点赞靠唯一约束**：并发下「先查再插」会重复，唯一键才是幂等的根。
5. **access + refresh 轮换**：access 短、refresh 可撤销，解决 JWT 登出问题。
6. **搜索先 MySQL**：数据量不大先用索引；规模上来再上 Meilisearch/ES。
:::

## 阶段一：骨架与基础设施

### 1.1 初始化 monorepo

**目标**：一个 pnpm workspace，包含 `apps/api`、`apps/web`、`packages/shared`。

```bash
mkdir community && cd community
git init
pnpm init
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - apps/*
  - packages/*
```

根 `package.json`：

```json
{
  "name": "community",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter api dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0"
  }
}
```

`tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  }
}
```

**为什么**：monorepo 让前后端共享类型和契约，统一 lint/test/build；代价是依赖管理更复杂。

**验收**：`pnpm -v` 正常，目录结构存在。

### 1.2 起 MySQL / Redis / MinIO

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
docker compose -f infra/docker-compose.yml ps
```

**验收**：

```bash
docker exec -it $(docker ps -qf name=mysql) mysql -uroot -proot -e "select 1"
docker exec -it $(docker ps -qf name=redis) redis-cli ping
```

**常见错误**：3306/6379/9000 被本机服务占用；先停冲突服务或改端口。

### 1.3 最小 Express 服务

`apps/api/package.json`：

```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/api/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

```bash
pnpm install
```

`apps/api/src/app.ts`：

```ts
import express from 'express';
import { healthRouter } from './common/health.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/health', healthRouter);
  return app;
}
```

`apps/api/src/common/health.ts`：

```ts
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});
```

`apps/api/src/server.ts`：

```ts
import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  console.log(`API listening on ${port}`);
});
```

```bash
pnpm --filter api dev
curl http://127.0.0.1:3000/health
```

**为什么**：先确认 Node、TS、Express、端口都正常，再叠复杂度。

### 1.4 配置、日志、错误、trace

`apps/api/src/common/config/index.ts`：

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = schema.parse(process.env);
```

`apps/api/.env.example`：

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="mysql://root:root@127.0.0.1:3306/community"
REDIS_URL="redis://127.0.0.1:6379"
JWT_SECRET="replace-with-32-char-random-string"
JWT_REFRESH_SECRET="replace-with-another-32-char-random-string"
WEB_ORIGIN="http://localhost:5173"
```

`apps/api/src/common/logger.ts`：

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
    ],
    censor: '[REDACTED]',
  },
});
```

`apps/api/src/common/errors.ts`：

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

export const errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', 401, 'Login required'),
  forbidden: () => new AppError('FORBIDDEN', 403, 'No permission'),
  notFound: (code = 'NOT_FOUND') => new AppError(code, 404, 'Not found'),
  conflict: (code: string, message: string) => new AppError(code, 409, message),
  validation: (details: unknown) =>
    new AppError('VALIDATION_ERROR', 400, 'Invalid request', details),
};
```

`apps/api/src/common/middleware.ts`：

```ts
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { logger } from './logger.js';

export function trace(req: Request, res: Response, next: NextFunction) {
  const traceId = req.header('x-trace-id') ?? randomUUID();
  (req as any).traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);
  const traceId = (req as any).traceId;

  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      traceId,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: err.flatten(),
      traceId,
    });
    return;
  }

  logger.error({ err, traceId }, 'unhandled error');
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal error',
    traceId,
  });
}
```

`AppError` 控制器里直接 `throw errors.forbidden()`；`asyncHandler` 把 rejected Promise 交给错误中间件。

**为什么**：统一错误结构、traceId、日志脱敏；前端只处理一种错误格式。

**验收**：访问不存在的路由返回统一 JSON；日志有 traceId。

### 1.5 Prisma 与迁移

```bash
pnpm --filter api add @prisma/client
pnpm --filter api add -D prisma
pnpm --filter api exec prisma init
```

`apps/api/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum UserStatus { active banned deleted }
enum PostStatus { draft pending published rejected deleted }
enum CommentStatus { pending published rejected deleted }
enum LikeTarget { post comment }
enum NotificationType { like comment follow system }
enum ReportStatus { pending resolved rejected }
enum OrderStatus { pending paid cancelled refunded }

model User {
  id           BigInt     @id @default(autoincrement())
  email        String?    @unique
  passwordHash String
  nickname     String
  avatarUrl    String?
  bio          String?
  status       UserStatus @default(active)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([createdAt])
  @@map("users")
}

model RefreshToken {
  id        BigInt    @id @default(autoincrement())
  userId    BigInt
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@map("refresh_tokens")
}

model Role {
  id          BigInt @id @default(autoincrement())
  code        String @unique
  name        String
  permissions RolePermission[]
  users       UserRole[]

  @@map("roles")
}

model Permission {
  id     BigInt @id @default(autoincrement())
  code   String @unique
  name   String
  roles  RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       BigInt
  permissionId BigInt
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId BigInt
  roleId BigInt
  role   Role   @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
  @@map("user_roles")
}

model Post {
  id           BigInt     @id @default(autoincrement())
  authorId     BigInt
  title        String?
  content      String     @db.Text
  status       PostStatus @default(pending)
  likeCount    Int        @default(0)
  commentCount Int        @default(0)
  createdAt    DateTime   @default(now())
  deletedAt    DateTime?

  @@index([authorId, createdAt])
  @@index([status, createdAt])
  @@map("posts")
}

model Comment {
  id        BigInt        @id @default(autoincrement())
  postId    BigInt
  authorId  BigInt
  parentId  BigInt?
  content   String        @db.VarChar(2000)
  status    CommentStatus @default(published)
  createdAt DateTime      @default(now())
  deletedAt DateTime?

  @@index([postId, createdAt])
  @@map("comments")
}

model Like {
  id         BigInt     @id @default(autoincrement())
  userId     BigInt
  targetType LikeTarget
  targetId   BigInt
  createdAt  DateTime   @default(now())

  @@unique([userId, targetType, targetId])
  @@index([targetType, targetId])
  @@map("likes")
}

model Follow {
  followerId BigInt
  followeeId BigInt
  createdAt  DateTime @default(now())

  @@id([followerId, followeeId])
  @@index([followeeId])
  @@map("follows")
}

model Notification {
  id         BigInt           @id @default(autoincrement())
  userId     BigInt
  type       NotificationType
  actorId    BigInt?
  targetType String?
  targetId   BigInt?
  payload    Json?
  readAt     DateTime?
  createdAt  DateTime         @default(now())

  @@index([userId, createdAt])
  @@index([userId, readAt])
  @@map("notifications")
}

model Report {
  id         BigInt       @id @default(autoincrement())
  reporterId BigInt
  targetType String
  targetId   BigInt
  reason     String
  status     ReportStatus @default(pending)
  handledBy  BigInt?
  createdAt  DateTime     @default(now())

  @@index([status, createdAt])
  @@map("reports")
}

model ModerationRecord {
  id         BigInt   @id @default(autoincrement())
  targetType String
  targetId   BigInt
  action     String
  operatorId BigInt
  reason     String?
  createdAt  DateTime @default(now())

  @@map("moderation_records")
}

model Plan {
  id          BigInt @id @default(autoincrement())
  code        String @unique
  name        String
  priceCents  Int
  durationDays Int
  status      String @default("active")

  @@map("plans")
}

model Order {
  id             BigInt      @id @default(autoincrement())
  userId         BigInt
  planId         BigInt
  amountCents    Int
  status         OrderStatus @default(pending)
  idempotencyKey String      @unique
  createdAt      DateTime    @default(now())
  paidAt         DateTime?

  @@index([userId, createdAt])
  @@map("orders")
}

model Entitlement {
  id        BigInt   @id @default(autoincrement())
  userId    BigInt
  type      String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId, type])
  @@map("entitlements")
}

model OutboxEvent {
  id          BigInt   @id @default(autoincrement())
  type        String
  payload     Json
  status      String   @default("pending")
  retryCount  Int      @default(0)
  createdAt   DateTime @default(now())
  processedAt DateTime?

  @@index([status, createdAt])
  @@map("outbox_events")
}

model IdempotencyKey {
  key         String   @id
  userId      BigInt
  requestHash String
  response    Json?
  status      String   @default("processing")
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@map("idempotency_keys")
}
```

```bash
pnpm --filter api exec prisma migrate dev --name init
pnpm --filter api exec prisma generate
```

`apps/api/package.json` 加 seed 配置：

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

`apps/api/src/common/db.ts`：

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});
```

**为什么单例**：每个请求 new PrismaClient 会耗尽连接池。

**验收**：`prisma studio` 能看到表；`prisma migrate status` 正常。

## 阶段二：认证与权限

### 2.1 注册、登录、刷新、登出

```bash
pnpm --filter api add argon2 jsonwebtoken cookie-parser cors
pnpm --filter api add -D @types/jsonwebtoken @types/cookie-parser @types/cors
```

`apps/api/src/modules/auth/token.service.ts`：

```ts
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { config } from '../../common/config/index.js';
import { prisma } from '../../common/db.js';

export type AccessPayload = { sub: string; roles: string[] };

export function signAccess(userId: bigint, roles: string[]) {
  return jwt.sign(
    { sub: userId.toString(), roles },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TTL },
  );
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, config.JWT_SECRET) as AccessPayload;
}

export function newRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function saveRefresh(userId: bigint, token: string) {
  const expiresAt = new Date(
    Date.now() + config.REFRESH_TTL_DAYS * 24 * 3600 * 1000,
  );
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return expiresAt;
}
```

`apps/api/src/modules/auth/auth.service.ts`：

```ts
import argon2 from 'argon2';
import { prisma } from '../../common/db.js';
import { errors } from '../../common/errors.js';
import {
  signAccess, newRefreshToken, hashToken, saveRefresh,
} from './token.service.js';

export async function register(input: {
  email: string;
  password: string;
  nickname: string;
}) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw errors.conflict('EMAIL_EXISTS', 'Email already registered');

  const passwordHash = await argon2.hash(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      nickname: input.nickname,
    },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'active') {
    throw errors.unauthorized();
  }
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw errors.unauthorized();

  const roles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });

  const roleCodes = roles.map(r => r.role.code).filter(Boolean);
  const accessToken = signAccess(user.id, roleCodes);
  const refreshToken = newRefreshToken();
  await saveRefresh(user.id, refreshToken);

  return { user, accessToken, refreshToken };
}

export async function refresh(oldToken: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(oldToken) },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw errors.unauthorized();
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const roles = await prisma.userRole.findMany({
    where: { userId: record.userId },
    include: { role: true },
  });
  const roleCodes = roles.map(r => r.role.code).filter(Boolean);

  const accessToken = signAccess(record.userId, roleCodes);
  const refreshToken = newRefreshToken();
  await saveRefresh(record.userId, refreshToken);

  return { accessToken, refreshToken };
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

`apps/api/src/modules/auth/auth.controller.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { config } from '../../common/config/index.js';
import * as service from './auth.service.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  nickname: z.string().min(1).max(24),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(res, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: config.REFRESH_TTL_DAYS * 24 * 3600 * 1000,
  });
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await service.register(input);
  res.status(201).json({ code: 'OK', data: { id: user.id.toString() } });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await service.login(
    input.email, input.password,
  );
  setRefreshCookie(res, refreshToken);
  res.json({
    code: 'OK',
    data: {
      accessToken,
      user: { id: user.id.toString(), nickname: user.nickname },
    },
  });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) throw errors.unauthorized();
  const { accessToken, refreshToken } = await service.refresh(token);
  setRefreshCookie(res, refreshToken);
  res.json({ code: 'OK', data: { accessToken } });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) await service.logout(token);
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  res.json({ code: 'OK', data: {} });
}));
```

`apps/api/src/modules/auth/auth.middleware.ts`：

```ts
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../../common/config/index.js';
import { errors } from '../../common/errors.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(errors.unauthorized());

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    (req as any).user = {
      id: BigInt(payload.sub),
      roles: payload.roles ?? [],
    };
    next();
  } catch {
    next(errors.unauthorized());
  }
}
```

**为什么 refresh 放 httpOnly Cookie**：JS 读不到，降低 XSS 窃取风险；access 放内存/请求头。

**验收**：

```bash
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@test.com","password":"Passw0rd!","nickname":"A"}'

curl -i -c /tmp/c.txt -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@test.com","password":"Passw0rd!"}'

curl -i -b /tmp/c.txt -X POST http://127.0.0.1:3000/api/v1/auth/refresh
```

**常见错误**：`JWT_SECRET` 少于 32 字符启动即失败；refresh Cookie 的 `path` 要和接口前缀一致。

### 2.2 RBAC：权限码与中间件

`apps/api/src/modules/auth/rbac.ts`：

```ts
import { prisma } from '../../common/db.js';
import { errors } from '../../common/errors.js';

export async function permissionsOf(userId: bigint): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ code: string }[]>`
    SELECT DISTINCT p.code
    FROM user_roles ur
    JOIN role_permissions rp ON rp.roleId = ur.roleId
    JOIN permissions p ON p.id = rp.permissionId
    WHERE ur.userId = ${userId}
  `;
  return new Set(rows.map(r => r.code));
}

export function requirePermission(code: string) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.user) throw errors.unauthorized();
      const perms = await permissionsOf(req.user.id);
      if (!perms.has(code)) throw errors.forbidden();
      next();
    } catch (e) {
      next(e);
    }
  };
}
```

**为什么**：权限码是唯一来源；前端隐藏只是体验，后端必须校验。生产可把权限缓存进 Redis，变更时失效。

`apps/api/prisma/seed.ts`：

```ts
import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from '../src/common/db.js';

const PERMISSIONS = [
  ['post:review', '审核帖子'],
  ['report:handle', '处理举报'],
  ['user:ban', '封禁用户'],
  ['admin:access', '后台访问'],
];

async function main() {
  for (const [code, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    create: { code: 'admin', name: '管理员' },
    update: {},
  });

  for (const [code] of PERMISSIONS) {
    const p = await prisma.permission.findUnique({ where: { code } });
    if (p) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {},
      });
    }
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    create: {
      email: 'admin@test.com',
      passwordHash: await argon2.hash('Admin123!'),
      nickname: 'admin',
    },
    update: {},
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });
}

main().finally(() => prisma.$disconnect());
```

```bash
pnpm --filter api exec prisma db seed
```

**验收**：admin 登录后能访问后台接口；普通用户 403。

### 2.3 用户与关注

`apps/api/src/modules/users/users.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', asyncHandler(async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw errors.notFound('USER_NOT_FOUND');
  res.json({
    code: 'OK',
    data: {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
  });
}));

usersRouter.patch('/me', asyncHandler(async (req: any, res) => {
  const schema = z.object({
    nickname: z.string().min(1).max(24).optional(),
    bio: z.string().max(255).optional(),
    avatarUrl: z.string().url().optional(),
  });
  const input = schema.parse(req.body);

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: input,
  });

  res.json({ code: 'OK', data: { id: user.id.toString() } });
}));

usersRouter.post('/:id/follow', asyncHandler(async (req: any, res) => {
  const followeeId = BigInt(req.params.id);
  if (followeeId === req.user.id) {
    throw errors.validation({ message: 'cannot follow yourself' });
  }

  await prisma.$transaction(async tx => {
    const created = await tx.follow.createMany({
      data: [{ followerId: req.user.id, followeeId }],
      skipDuplicates: true,
    });

    if (created.count === 1) {
      await tx.outboxEvent.create({
        data: {
          type: 'user.followed',
          payload: {
            followerId: req.user.id.toString(),
            followeeId: followeeId.toString(),
          },
        },
      });
    }
  });

  res.json({ code: 'OK', data: {} });
}));

usersRouter.delete('/:id/follow', asyncHandler(async (req: any, res) => {
  await prisma.follow.deleteMany({
    where: { followerId: req.user.id, followeeId: BigInt(req.params.id) },
  });
  res.json({ code: 'OK', data: {} });
}));
```

**为什么 upsert + deleteMany**：重复关注/取关幂等，不报错。

**验收**：连续两次关注，`follows` 表只有一行。

## 阶段三：社区核心

### 3.1 发帖

`apps/api/src/modules/posts/posts.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const postsRouter = Router();
postsRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(20000),
});

postsRouter.post('/', asyncHandler(async (req: any, res) => {
  const input = createSchema.parse(req.body);

  const post = await prisma.$transaction(async tx => {
    const created = await tx.post.create({
      data: {
        authorId: req.user.id,
        title: input.title,
        content: input.content,
        status: 'pending',
      },
    });

    await tx.outboxEvent.create({
      data: {
        type: 'post.created',
        payload: {
          postId: created.id.toString(),
          authorId: req.user.id.toString(),
        },
      },
    });

    return created;
  });

  res.status(201).json({
    code: 'OK',
    data: { id: post.id.toString(), status: post.status },
  });
}));
```

postsRouter.get('/', asyncHandler(async (_req: any, res) => {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  res.json({
    code: 'OK',
    data: posts.map(p => ({
      id: p.id.toString(),
      title: p.title,
      content: p.content,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
    })),
  });
}));

postsRouter.get('/:id', asyncHandler(async (req: any, res) => {
  const id = BigInt(req.params.id);
  const post = await prisma.post.findFirst({
    where: {
      id,
      OR: [{ status: 'published' }, { authorId: req.user.id }],
    },
  });
  if (!post) throw errors.notFound('POST_NOT_FOUND');

  res.json({
    code: 'OK',
    data: {
      id: post.id.toString(),
      title: post.title,
      content: post.content,
      status: post.status,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
    },
  });
}));

postsRouter.delete('/:id', asyncHandler(async (req: any, res) => {
  const id = BigInt(req.params.id);
  const result = await prisma.post.updateMany({
    where: { id, authorId: req.user.id, deletedAt: null },
    data: { status: 'deleted', deletedAt: new Date() },
  });
  if (result.count === 0) throw errors.notFound('POST_NOT_FOUND');
  res.json({ code: 'OK', data: {} });
}));

**为什么 pending**：先审核再发布；Outbox 与帖子同事务，事件不丢。

**验收**：发帖后 `posts.status = pending`，`outbox_events` 有一条 pending。

### 3.2 评论

`apps/api/src/modules/comments/comments.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

const createSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

commentsRouter.post('/posts/:postId/comments', asyncHandler(async (req: any, res) => {
  const postId = BigInt(req.params.postId);
  const input = createSchema.parse(req.body);

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== 'published') {
    throw errors.notFound('POST_NOT_FOUND');
  }

  const comment = await prisma.$transaction(async tx => {
    const created = await tx.comment.create({
      data: {
        postId,
        authorId: req.user.id,
        parentId: input.parentId ? BigInt(input.parentId) : null,
        content: input.content,
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    await tx.outboxEvent.create({
      data: {
        type: 'comment.created',
        payload: {
          commentId: created.id.toString(),
          postId: postId.toString(),
          authorId: req.user.id.toString(),
        },
      },
    });

    return created;
  });

  res.status(201).json({ code: 'OK', data: { id: comment.id.toString() } });
}));
```

commentsRouter.get('/posts/:postId/comments', asyncHandler(async (req: any, res) => {
  const postId = BigInt(req.params.postId);
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  const comments = await prisma.comment.findMany({
    where: { postId, status: 'published', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.json({
    code: 'OK',
    data: comments.map(c => ({
      id: c.id.toString(),
      parentId: c.parentId?.toString() ?? null,
      content: c.content,
      authorId: c.authorId.toString(),
      createdAt: c.createdAt,
    })),
  });
}));

**为什么同事务**：评论和计数不能一个成功一个失败；通知走 Outbox。

### 3.3 点赞

`apps/api/src/modules/likes/likes.routes.ts`：

```ts
import { Router } from 'express';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const likesRouter = Router();
likesRouter.use(requireAuth);

likesRouter.post('/posts/:postId/like', asyncHandler(async (req: any, res) => {
  const postId = BigInt(req.params.postId);

  await prisma.$transaction(async tx => {
    const created = await tx.like.createMany({
      data: [{ userId: req.user.id, targetType: 'post', targetId: postId }],
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
          payload: {
            postId: postId.toString(),
            userId: req.user.id.toString(),
          },
        },
      });
    }
  });

  res.json({ code: 'OK', data: {} });
}));

likesRouter.delete('/posts/:postId/like', asyncHandler(async (req: any, res) => {
  const postId = BigInt(req.params.postId);

  await prisma.$transaction(async tx => {
    const deleted = await tx.like.deleteMany({
      where: { userId: req.user.id, targetType: 'post', targetId: postId },
    });

    if (deleted.count === 1) {
      await tx.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
    }
  });

  res.json({ code: 'OK', data: {} });
}));
```

**为什么唯一约束 + `skipDuplicates`**：并发下两个请求都插入，只有一个 count=1，计数只加一次。

**验收**：连续点赞两次，`like_count` 只加 1。

### 3.4 信息流

`apps/api/src/modules/feed/feed.routes.ts`：

```ts
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const feedRouter = Router();
feedRouter.use(requireAuth);

function parseCursor(cursor?: string) {
  if (!cursor) return null;
  const [at, id] = cursor.split('_');
  if (!at || !id) return null;
  return { at: new Date(at), id: BigInt(id) };
}

feedRouter.get('/', asyncHandler(async (req: any, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const cursor = parseCursor(req.query.cursor as string | undefined);

  const cursorClause = cursor
    ? Prisma.sql`AND (p.createdAt < ${cursor.at} OR (p.createdAt = ${cursor.at} AND p.id < ${cursor.id}))`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.title, p.content, p.likeCount, p.commentCount, p.createdAt
    FROM posts p
    JOIN follows f ON f.followeeId = p.authorId
    WHERE f.followerId = ${req.user.id}
      AND p.status = 'published'
      ${cursorClause}
    ORDER BY p.createdAt DESC, p.id DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1);

  res.json({
    code: 'OK',
    data: {
      items: items.map(p => ({
        id: p.id.toString(),
        title: p.title,
        content: p.content,
        likeCount: Number(p.likeCount),
        commentCount: Number(p.commentCount),
        createdAt: p.createdAt,
      })),
      nextCursor: hasMore && last
        ? `${new Date(last.createdAt).toISOString()}_${last.id}`
        : null,
    },
  });
}));
```

> 这里用 `Prisma.sql` 拼条件、`Prisma.empty` 拼空条件；不要把 `$queryRaw` 嵌套在模板里。游标是 `(createdAt, id)` 复合条件，不用 `OFFSET`。

**为什么游标**：`OFFSET` 越翻越慢；游标稳定且不重不漏。

**验收**：连续翻页，id 不重复；最后一页 `nextCursor=null`。

## 阶段四：通知与治理

### 4.1 Outbox Worker + BullMQ

```bash
pnpm --filter api add bullmq ioredis
```

`apps/api/src/common/queue.ts`：

```ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config/index.js';

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const notificationQueue = new Queue('notifications', { connection });
export { connection as redisConnection };
```

`apps/api/src/modules/notifications/outbox.worker.ts`：

```ts
import { prisma } from '../../common/db.js';
import { notificationQueue } from '../../common/queue.js';
import { logger } from '../../common/logger.js';

export function startOutboxWorker() {
  setInterval(async () => {
    try {
      await prisma.$transaction(async tx => {
        const events = await tx.$queryRaw<any[]>`
          SELECT id, type, payload
          FROM outbox_events
          WHERE status = 'pending'
          ORDER BY id ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;

        for (const event of events) {
          await notificationQueue.add(event.type, event.payload, {
            jobId: event.id.toString(),
            removeOnComplete: true,
          });
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'processing' },
          });
        }
      });
    } catch (err) {
      logger.error({ err }, 'outbox worker failed');
    }
  }, 1000);
}
```

> `FOR UPDATE SKIP LOCKED` 需要包在事务里；生产建议用 Prisma `$transaction` + 原生 SQL，或专用的 outbox 库。

### 4.2 通知消费者与 SSE

`apps/api/src/modules/notifications/notification.worker.ts`：

```ts
import { Worker } from 'bullmq';
import { prisma } from '../../common/db.js';
import { redisConnection } from '../../common/queue.js';

export function startNotificationWorker() {
  new Worker('notifications', async job => {
    if (job.name === 'user.followed') {
      const { followerId, followeeId } = job.data as any;

      const n = await prisma.notification.create({
        data: {
          userId: BigInt(followeeId),
          type: 'follow',
          actorId: BigInt(followerId),
          targetType: 'user',
          targetId: BigInt(followerId),
          payload: { followerId },
        },
      });

      await redisConnection.publish(
        `notify:${followeeId}`,
        JSON.stringify({ id: n.id.toString(), type: n.type, createdAt: n.createdAt }),
      );
      return;
    }

    if (!['post.liked', 'comment.created'].includes(job.name)) return;

    const { postId, userId, commentId } = job.data as any;

    const post = await prisma.post.findUnique({ where: { id: BigInt(postId) } });
    if (!post) return;

    // 自己操作自己不通知
    if (post.authorId === BigInt(userId)) return;

    const n = await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: job.name === 'post.liked' ? 'like' : 'comment',
        actorId: BigInt(userId),
        targetType: 'post',
        targetId: post.id,
        payload: { postId, commentId },
      },
    });

    await redisConnection.publish(
      `notify:${post.authorId}`,
      JSON.stringify({
        id: n.id.toString(),
        type: n.type,
        postId,
        createdAt: n.createdAt,
      }),
    );
  }, { connection: redisConnection });
}
```

`apps/api/src/modules/notifications/stream.routes.ts`：

```ts
import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { redisConnection } from '../../common/queue.js';

export const streamRouter = Router();

streamRouter.get('/notifications/stream', requireAuth, async (req: any, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const sub = redisConnection.duplicate();
  await sub.subscribe(`notify:${req.user.id}`);

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

`apps/api/src/modules/notifications/notifications.routes.ts`：

```ts
import { Router } from 'express';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', asyncHandler(async (req: any, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  res.json({
    code: 'OK',
    data: items.map(n => ({
      id: n.id.toString(),
      type: n.type,
      readAt: n.readAt,
      payload: n.payload,
      createdAt: n.createdAt,
    })),
  });
}));

notificationsRouter.post('/read', asyncHandler(async (req: any, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ code: 'OK', data: {} });
}));
```

**为什么**：Outbox 保证事件不丢；BullMQ 重试；Redis pub/sub 支持多实例；SSE 比 WebSocket 简单。

**验收**：A 点赞 B 的帖子，B 的 SSE 收到通知；A 点赞自己的帖子不通知。

### 4.3 审核与举报

`apps/api/src/modules/moderation/moderation.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.js';

export const moderationRouter = Router();
moderationRouter.use(requireAuth);

const reportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string(),
  reason: z.string().min(1).max(255),
});

moderationRouter.post('/reports', asyncHandler(async (req: any, res) => {
  const input = reportSchema.parse(req.body);
  const report = await prisma.report.create({
    data: {
      reporterId: req.user.id,
      targetType: input.targetType,
      targetId: BigInt(input.targetId),
      reason: input.reason,
    },
  });
  res.status(201).json({ code: 'OK', data: { id: report.id.toString() } });
}));

moderationRouter.get(
  '/admin/posts',
  requirePermission('post:review'),
  asyncHandler(async (req: any, res) => {
    const posts = await prisma.post.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({
      code: 'OK',
      data: posts.map(p => ({ id: p.id.toString(), title: p.title, content: p.content })),
    });
  }),
);

moderationRouter.post(
  '/admin/posts/:id/approve',
  requirePermission('post:review'),
  asyncHandler(async (req: any, res) => {
    const id = BigInt(req.params.id);
    await prisma.$transaction([
      prisma.post.update({ where: { id }, data: { status: 'published' } }),
      prisma.moderationRecord.create({
        data: {
          targetType: 'post',
          targetId: id,
          action: 'approve',
          operatorId: req.user.id,
        },
      }),
    ]);
    res.json({ code: 'OK', data: {} });
  }),
);
```

moderationRouter.post(
  '/admin/posts/:id/reject',
  requirePermission('post:review'),
  asyncHandler(async (req: any, res) => {
    const id = BigInt(req.params.id);
    await prisma.$transaction([
      prisma.post.update({ where: { id }, data: { status: 'rejected' } }),
      prisma.moderationRecord.create({
        data: {
          targetType: 'post',
          targetId: id,
          action: 'reject',
          operatorId: req.user.id,
          reason: req.body?.reason,
        },
      }),
    ]);
    res.json({ code: 'OK', data: {} });
  }),
);

moderationRouter.get(
  '/admin/reports',
  requirePermission('report:handle'),
  asyncHandler(async (_req: any, res) => {
    const reports = await prisma.report.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({
      code: 'OK',
      data: reports.map(r => ({
        id: r.id.toString(),
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    });
  }),
);

moderationRouter.post(
  '/admin/reports/:id/resolve',
  requirePermission('report:handle'),
  asyncHandler(async (req: any, res) => {
    const id = BigInt(req.params.id);
    await prisma.$transaction([
      prisma.report.update({
        where: { id },
        data: { status: 'resolved', handledBy: req.user.id },
      }),
      prisma.moderationRecord.create({
        data: {
          targetType: 'report',
          targetId: id,
          action: 'resolve',
          operatorId: req.user.id,
        },
      }),
    ]);
    res.json({ code: 'OK', data: {} });
  }),
);

**为什么状态机 + 审计**：内容可回溯，审核动作有记录；驳回同理，写 `reject`。

在 `apps/api/src/server.ts` 启动两个 worker：

```ts
import { startOutboxWorker } from './modules/notifications/outbox.worker.js';
import { startNotificationWorker } from './modules/notifications/notification.worker.js';

startOutboxWorker();
startNotificationWorker();
```

## 阶段五：商业化与交付

### 5.1 会员与订单

`apps/api/src/modules/memberships/orders.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { errors } from '../../common/errors.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const createSchema = z.object({ planId: z.string() });

ordersRouter.post('/', asyncHandler(async (req: any, res) => {
  const input = createSchema.parse(req.body);
  const key = req.header('Idempotency-Key');
  if (!key) throw errors.validation({ message: 'Idempotency-Key required' });

  const existing = await prisma.order.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    res.json({ code: 'OK', data: { id: existing.id.toString(), reused: true } });
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { id: BigInt(input.planId) } });
  if (!plan || plan.status !== 'active') throw errors.notFound('PLAN_NOT_FOUND');

  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      planId: plan.id,
      amountCents: plan.priceCents,
      idempotencyKey: key,
    },
  });

  res.status(201).json({ code: 'OK', data: { id: order.id.toString() } });
}));

ordersRouter.post('/:id/mock-pay', asyncHandler(async (req: any, res) => {
  const id = BigInt(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.id) throw errors.notFound('ORDER_NOT_FOUND');
  if (order.status === 'paid') {
    res.json({ code: 'OK', data: { alreadyPaid: true } });
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { id: order.planId } });

  await prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() },
    });

    await tx.entitlement.create({
      data: {
        userId: req.user.id,
        type: `membership:${plan?.code ?? 'unknown'}`,
        expiresAt: new Date(Date.now() + (plan?.durationDays ?? 30) * 86400000),
      },
    });
  });

  res.json({ code: 'OK', data: {} });
}));
```

`apps/api/src/modules/memberships/plans.routes.ts`：

```ts
import { Router } from 'express';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';

export const plansRouter = Router();

plansRouter.get('/', asyncHandler(async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { status: 'active' },
    orderBy: { priceCents: 'asc' },
  });

  res.json({
    code: 'OK',
    data: plans.map(p => ({
      id: p.id.toString(),
      code: p.code,
      name: p.name,
      priceCents: p.priceCents,
      durationDays: p.durationDays,
    })),
  });
}));
```

`apps/api/prisma/seed.ts` 里补套餐：

```ts
await prisma.plan.upsert({
  where: { code: 'monthly' },
  create: { code: 'monthly', name: '月卡', priceCents: 1900, durationDays: 30 },
  update: {},
});
```

**为什么幂等键**：用户连点/网络重试不会重复下单；支付回调用订单状态保证只发一次权益。

### 5.2 文件上传

```bash
pnpm --filter api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

`apps/api/src/modules/uploads/uploads.routes.ts`：

```ts
import { Router } from 'express';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { asyncHandler } from '../../common/middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:9000',
  forcePathStyle: true,
  credentials: { accessKeyId: 'minio', secretAccessKey: 'minio123' },
});

const schema = z.object({
  filename: z.string(),
  contentType: z.string().regex(/^image\/(png|jpe?g|webp)$/),
});

uploadsRouter.post('/presign', asyncHandler(async (req: any, res) => {
  const input = schema.parse(req.body);
  const key = `uploads/${req.user.id}/${Date.now()}-${input.filename}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: 'community',
      Key: key,
      ContentType: input.contentType,
    }),
    { expiresIn: 300 },
  );

  res.json({ code: 'OK', data: { url, key } });
}));
```

**为什么直传**：图片不经过 API 服务器，省带宽和内存；服务端只发签名和存元数据。

> 生产把 endpoint/credentials 换成环境变量或 STS 临时凭证；预签名只签类型不够，大小要在 bucket policy 或服务端回调里校验。

### 5.3 搜索

`apps/api/src/modules/search/search.routes.ts`：

```ts
import { Router } from 'express';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';

export const searchRouter = Router();

searchRouter.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json({ code: 'OK', data: { posts: [], users: [] } });
    return;
  }

  const [posts, users] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: 'published',
        OR: [{ title: { contains: q } }, { content: { contains: q } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, content: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { nickname: { contains: q } },
      take: 10,
      select: { id: true, nickname: true, avatarUrl: true },
    }),
  ]);

  res.json({
    code: 'OK',
    data: {
      posts: posts.map(p => ({
        id: p.id.toString(),
        title: p.title,
        excerpt: p.content.slice(0, 120),
        createdAt: p.createdAt,
      })),
      users: users.map(u => ({
        id: u.id.toString(),
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
      })),
    },
  });
}));
```

**为什么先 LIKE**：数据量不大时够用；上规模后换 Meilisearch/ES，通过 Outbox 同步索引。
**注意**：MySQL 的 `LIKE %q%` 用不到普通索引；数据量大时要上全文索引或独立搜索引擎。

### 5.4 后台管理

- 审核、举报、封禁、删除；
- 所有写操作 `moderation_records`；
- 权限码：`post:review`、`report:handle`、`user:ban`、`admin:access`；
- 分页用页码；
- 后台前端独立。

`apps/api/src/modules/admin/admin.routes.ts`：

```ts
import { Router } from 'express';
import { prisma } from '../../common/db.js';
import { asyncHandler } from '../../common/middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/rbac.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get(
  '/users',
  requirePermission('admin:access'),
  asyncHandler(async (req: any, res) => {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);

    const [total, items] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nickname: true,
          email: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      code: 'OK',
      data: {
        total,
        page,
        pageSize,
        items: items.map(u => ({
          id: u.id.toString(),
          nickname: u.nickname,
          email: u.email,
          status: u.status,
          createdAt: u.createdAt,
        })),
      },
    });
  }),
);

adminRouter.post(
  '/users/:id/ban',
  requirePermission('user:ban'),
  asyncHandler(async (req: any, res) => {
    const id = BigInt(req.params.id);

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status: 'banned' } }),
      prisma.moderationRecord.create({
        data: {
          targetType: 'user',
          targetId: id,
          action: 'ban',
          operatorId: req.user.id,
          reason: req.body?.reason,
        },
      }),
    ]);

    res.json({ code: 'OK', data: {} });
  }),
);
```

**为什么后台单独一个 router**：后台接口天然带 `admin:*` 前缀，权限码集中，方便审计和网关限制。

### 5.5 app.ts 完整接线

每加一个模块，就在 `app.ts` 挂一行；最终如下：

`apps/api/src/app.ts`：

```ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { config } from './common/config/index.js';
import { errorHandler, trace } from './common/middleware.js';
import { healthRouter } from './common/health.js';

import { authRouter } from './modules/auth/auth.controller.js';
import { usersRouter } from './modules/users/users.routes.js';
import { postsRouter } from './modules/posts/posts.routes.js';
import { commentsRouter } from './modules/comments/comments.routes.js';
import { likesRouter } from './modules/likes/likes.routes.js';
import { feedRouter } from './modules/feed/feed.routes.js';
import { streamRouter } from './modules/notifications/stream.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { moderationRouter } from './modules/moderation/moderation.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { ordersRouter } from './modules/memberships/orders.routes.js';
import { plansRouter } from './modules/memberships/plans.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { searchRouter } from './modules/search/search.routes.js';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function createApp() {
  const app = express();

  app.use(trace);
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/health', healthRouter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/posts', postsRouter);
  app.use('/api/v1', commentsRouter);
  app.use('/api/v1', likesRouter);
  app.use('/api/v1/feed', feedRouter);
  app.use('/api/v1', streamRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1', moderationRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/plans', plansRouter);
  app.use('/api/v1/uploads', uploadsRouter);
  app.use('/api/v1/search', searchRouter);

  app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
```

**为什么 BigInt 转字符串**：Prisma 的 BigInt 不能直接 `res.json`；全局 `toJSON` 让所有响应安全。
**为什么 CORS + credentials**：前端 5173 跨域带 Cookie；`origin` 不能是 `*`。
**为什么 `/api/v1` 挂多个 router**：comments/likes/moderation 的路径里已经带完整子路径，避免重复前缀。

## 阶段六：前端与测试

### 6.1 前端骨架

```bash
pnpm create vite apps/web --template react-ts
pnpm --filter web add react-router-dom @tanstack/react-query
```

`apps/web/vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
```

`apps/web/src/lib/api.ts`：

```ts
const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

let accessToken = '';

export function setAccessToken(token: string) {
  accessToken = token;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      const data = await refreshed.json();
      setAccessToken(data.data.accessToken);
      return api(path, options);
    }
  }

  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'request failed');
  return body.data as T;
}
```

**为什么**：统一带上 access 和 Cookie，401 自动刷新一次；避免每个页面重复写。

### 6.2 登录与信息流

`apps/web/src/pages/Login.tsx`：

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../lib/api';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.accessToken);
      navigate('/feed');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit}>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" />
      <button type="submit">登录</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

`apps/web/src/pages/Feed.tsx`：

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type Post = {
  id: string;
  title?: string;
  content: string;
  likeCount: number;
  commentCount: number;
};

export function Feed() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api<{ items: Post[] }>('/feed'),
  });

  if (isLoading) return <p>加载中…</p>;

  return (
    <div>
      {data?.items.map(p => (
        <article key={p.id}>
          <h2>{p.title ?? '无标题'}</h2>
          <p>{p.content}</p>
          <span>{p.likeCount} 赞 · {p.commentCount} 评论</span>
        </article>
      ))}
    </div>
  );
}
```

`apps/web/src/pages/PostDetail.tsx`：

```tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type Comment = { id: string; content: string; authorId: string };

export function PostDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [content, setContent] = useState('');

  const post = useQuery({
    queryKey: ['post', id],
    queryFn: () => api<any>(`/posts/${id}`),
  });

  const comments = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api<Comment[]>(`/posts/${id}/comments`),
  });

  const like = useMutation({
    mutationFn: () => api(`/posts/${id}/like`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', id] }),
  });

  const comment = useMutation({
    mutationFn: () => api(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
    onSuccess: () => {
      setContent('');
      qc.invalidateQueries({ queryKey: ['comments', id] });
    },
  });

  if (post.isLoading) return <p>加载中…</p>;
  if (!post.data) return <p>帖子不存在</p>;

  return (
    <article>
      <h1>{post.data.title ?? '无标题'}</h1>
      <p>{post.data.content}</p>
      <button onClick={() => like.mutate()}>{post.data.likeCount} 赞</button>

      <h2>评论</h2>
      <ul>
        {comments.data?.map(c => (
          <li key={c.id}>{c.content}</li>
        ))}
      </ul>

      <textarea value={content} onChange={e => setContent(e.target.value)} />
      <button disabled={!content.trim() || comment.isPending} onClick={() => comment.mutate()}>
        发表评论
      </button>
    </article>
  );
}
```

`apps/web/src/App.tsx`：

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { PostDetail } from './pages/PostDetail';

const qc = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="*" element={<Navigate to="/feed" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**为什么**：Feed 只负责浏览；详情负责读、点赞、评论，按页面拆查询，避免把所有逻辑塞进一个组件。

### 6.3 SSE 通知

`apps/web/src/hooks/useNotificationStream.ts`：

```ts
import { useEffect } from 'react';

export function useNotificationStream(onNotify: (data: any) => void) {
  useEffect(() => {
    const ac = new AbortController();

    const connect = async () => {
      const res = await fetch('/api/v1/notifications/stream', {
        signal: ac.signal,
        credentials: 'include',
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!;
        for (const part of parts) {
          const data = part
            .split('\n')
            .filter(l => l.startsWith('data:'))
            .map(l => l.slice(5).trim())
            .join('');
          if (data) onNotify(JSON.parse(data));
        }
      }
    };

    void connect();
    return () => ac.abort();
  }, [onNotify]);
}
```

### 6.4 测试

```bash
pnpm --filter api add -D supertest @types/supertest
```

`apps/api/tests/auth.test.ts`：

```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('auth', () => {
  it('register and login', async () => {
    const email = `t${Date.now()}@test.com`;

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Passw0rd!', nickname: 't' })
      .expect(201);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Passw0rd!' })
      .expect(200);

    expect(res.body.data.accessToken).toBeTruthy();
  });
});
```

压测：

```bash
npx autocannon -c 100 -d 30 http://127.0.0.1:3000/api/v1/feed
```

**验收**：P95、错误率、DB/Redis 指标。

## 阶段七：部署与演进

### 7.1 Docker 与 Nginx

`apps/api/Dockerfile`：

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter api build
RUN pnpm --filter api exec prisma generate

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

`infra/nginx/community.conf`：

```nginx
server {
  listen 80;
  server_name community.example.com;

  location /api/ {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /api/v1/notifications/stream {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 3600s;
    add_header X-Accel-Buffering no;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
  }
}
```

### 7.2 CI/CD

`.github/workflows/ci.yml`：

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm --filter api exec tsc --noEmit
      - run: pnpm --filter api test
      - run: pnpm --filter api build
```

**门禁**：lint、类型、测试、构建；生产部署再加镜像扫描和迁移。

### 7.3 可观测性

```bash
pnpm --filter api add prom-client
```

```ts
import client from 'prom-client';

client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [50, 100, 200, 500, 1000, 3000],
});
```

```ts
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

**验收**：`/health`、`/metrics` 可访问；日志有 traceId；告警基于错误率和 P95。

### 7.4 高并发演进

| 阶段 | 问题 | 方案 |
|---|---|---|
| 单机 | DB 压力 | 索引、缓存、连接池 |
| 读多 | 列表慢 | Redis、本地缓存、读写分离 |
| 写多 | 计数/通知慢 | MQ、异步、批量 |
| 热点 | 单 key 打满 | 本地缓存、分片、限流 |
| 数据大 | 单表慢 | 分区、归档、分库分表 |
| 多实例 | 会话/SSE | Redis 共享、pub/sub |
| 故障 | 雪崩 | 限流、熔断、降级 |

`apps/api/src/common/cache.ts`：

```ts
import { redisConnection as redis } from './queue.js';

export async function cached<T>(
  key: string,
  ttlSec: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;

  const value = await load();
  const ttl = ttlSec + Math.floor(Math.random() * 30);
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
  return value;
}
```

`apps/api/src/common/rate-limit.ts`：

```ts
import { redisConnection as redis } from './queue.js';

export function rateLimit(limit: number, windowSec: number) {
  return async (req: any, res: any, next: any) => {
    const who = req.user?.id?.toString() ?? req.ip;
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const key = `rl:${who}:${bucket}`;

    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSec);

    if (current > limit) {
      res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests' });
      return;
    }
    next();
  };
}
```

**为什么**：固定窗口实现简单，但窗口边界会有突刺；生产可换令牌桶/滑动窗口。缓存加随机 TTL，避免同时过期。

每次演进写 ADR：问题、方案、代价、回滚。

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

EMAIL="t$(date +%s)@test.com"

echo "== 1. 注册 / 登录"
expect 201 "注册" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd!\",\"nickname\":\"t\"}"
expect 200 "登录" -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd!\"}"

echo "== 2. 未登录访问 → 401"
expect 401 "未登录发帖" -X POST "$BASE/posts" -H 'Content-Type: application/json' \
  -d '{"content":"x"}'

echo "== 3. 压测信息流（登录 token 手动替换）"
npx autocannon -c 100 -d 30 "$BASE/feed"
```

**浏览器核对**

- [ ] 两个账号互相关注，首页能看到对方已发布帖子；
- [ ] 点赞后作者收到通知；
- [ ] 断网重连后通知补齐；
- [ ] 重复提交订单只产生一单。

## 常见坑

- PrismaClient 每个请求 new → 连接池耗尽；
- `res.json` 遇到 BigInt → 统一 `BigInt.prototype.toJSON`；
- 点赞先查再插 → 并发重复，必须唯一约束；
- 深分页 OFFSET → 越翻越慢，用游标；
- 评论/点赞计数与写入不同事务 → 数据不一致；
- Outbox worker 多实例重复消费 → `SKIP LOCKED` / 去重；
- Outbox 事件卡在 `processing` → 加超时回收和重试；
- 并发同 `Idempotency-Key` → 唯一键冲突，捕获 `P2002` 返回已有订单；
- 预签名上传只限类型不限大小 → 配 policy 或服务端校验；
- 固定窗口限流在边界有突刺 → 生产用令牌桶/滑动窗口；
- SSE 客户端断开没 abort 上游 → 模型继续生成、继续计费；
- SSE 没关 `proxy_buffering` → 流被憋住；
- refresh 不轮换 → 旧 token 可重放；
- 日志打印 password/token → 泄露；
- 迁移和代码同时删列 → 回滚失败。

## 延伸方向

- 前端完整页面与权限；
- Meilisearch/ES 搜索；
- 支付回调与对账；
- K8s 滚动更新；
- 推荐流与热度排序；
- 多租户与内容安全。

## 版本记录

| 版本 | 日期 | 修改 |
|---|---|---|
| v0.1 | 2026-11-07 | 初版：架构、数据模型、部分模块 |
| v0.2 | 2026-11-07 | 重写为按开发顺序的完整流程，补全各阶段命令、关键代码、验收与常见错误 |
| v1.0 | 待定 | 补前端完整页面、搜索、支付、K8s，完成可演示验收 |
