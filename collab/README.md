# notelab-collab —— 协作画布的同步服务

B 端「协作画布」(`/admin/canvas`) 的后端同步进程。**不参与 Next 构建**，独立跑在 pm2 里。

## 它做什么

| | |
|---|---|
| 框架 | `@tldraw/sync-core` 的 `TLSocketRoom`（每个房间一个权威实例） |
| 持久化 | 单文件 SQLite（`data/rooms.db`），每房间一个 `tablePrefix`；用 Node 内置 `node:sqlite`，无需原生编译 |
| 鉴权 | WebSocket 握手时把 cookie 转发给 Java `/api/auth/verify`，**只放行 B 端登录会话**（`scope=b`），否则 401 拒绝升级 |
| 端口 | `127.0.0.1:3030`（只监听本机，公网经 nginx `/collab/` 进来） |

## 端点

nginx 把 `/collab/` 前缀剥掉后到达本进程：

| 方法 | 路径 | 说明 |
|---|---|---|
| WS | `/connect/<roomId>` | 协作连接（roomId = 16 位 hex） |
| GET | `/health` | 健康检查 `{ok, rooms, db}` |
| DELETE | `/rooms/<roomId>` | 清理房间表（仅本机；Java 删画布时 best-effort 调用） |

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `COLLAB_PORT` | `3030` | 监听端口 |
| `COLLAB_DB` | `<本目录>/data/rooms.db` | SQLite 文件路径 |
| `COLLAB_AUTH_VERIFY` | `http://127.0.0.1:8001/api/auth/verify` | 鉴权端点 |

## 启动

```bash
# 服务器（/root/Notelab/notelab-b/collab）
npm install --omit=dev
pm2 start server.mjs --name notelab-collab --node-args="--disable-warning=ExperimentalWarning"
pm2 save
```

⚠️ `node:sqlite` 是实验性 API（Node 22.5+），会有 `ExperimentalWarning` 日志。用
`--disable-warning=ExperimentalWarning` 静音，**不要**用 `--no-warnings`（会连真问题一起吞掉）。

## 与另外两处的关系

- **Java**（`CanvasController`）管**元数据**（有哪些画布、叫什么名、谁建的），存 MySQL `canvas_doc`；
  删画布时调本服务的 `DELETE /rooms/<id>` 清内容（失败不回滚，room_id 随机不复用）。
- **B 端页面**（`/admin/canvas`）管**交互**：列表 + tldraw 编辑器，用 `useSync` 连本服务。

两边靠 `room_id` 关联，**各管一半**。改这里的房间号格式（`ROOM_ID_RE`）必须同步改
Java 的 `CanvasController.newRoomId()`，否则握手会被静默拒绝。
