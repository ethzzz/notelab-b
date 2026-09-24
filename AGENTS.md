# notelab-b —— B 端（管理后台，antd 版）

> 本文件只写「本仓特有、不知道就会出错」的信息。完整功能清单（逐页说明）见本仓 `README.md`；全局信息见根 `../AGENTS.md`。

## 定位
原 `myapp` 管理端的 1:1 迁移 + UI 全量 antd 化。Next.js App Router + antd，**basePath `/admin`**（写死在 `next.config.ts`）。

| 项 | 值 |
|---|---|
| 服务器目录 | `/root/notelab-b` |
| pm2 进程 | `notelab-b` |
| 端口 | **3020** |
| nginx | `location ^~ /admin`，保留前缀转发 |
| 线上入口 | http://117.72.32.87/admin/ |
| GitHub | `git@github.com:ethzzz/notelab-b.git`（main） |
| 关键依赖 | next 16.2.12 / react 19.2.4 / antd ^6.6.1 / tailwindcss ^4 |

## 最重要的一条：不要加 `/api` rewrites
页面内 `/api/*` 全部是**同域绝对路径**，由 nginx 直达 `notelab-java`（:8001）。`next.config.ts` **刻意不配任何 rewrites**——加上会让请求绕一圈甚至断掉。

唯一例外：英语发音走 `/admin/api/tts`（本仓 Next route handler，Kokoro :8880 为主、edge-tts 兜底），前端用 `BASE_PATH + "/api/tts"` 访问。

## 路由
`src/app/(admin)/` 是 **路由组，不进 URL** —— 例：`(admin)/translate/page.tsx` 的真实路径是 `/admin/translate`。

**业务页 20 个**：`dashboard` / `chat` / `arena` / `toolbox` / `tools` / `rag` / `english` / `extract` / `lowcode` / `notes` / `docs` / `trpg/gen` / `spire-editor` / `ui` / `perm` / `c-users` / `translate` / `user/accounts` / `user/invites` / `user/roles`。逐页说明见 `README.md` 的功能清单表。

- `/trpg` → `/trpg/gen`（307），写在 `next.config.ts` 的 `redirects()`。
- ⚠️ **`/trpg` 本体、`/trpg/play`、`/spire`、`/vs` 这四个页面已在 P6 从本端删除**（随玩法功能一起移到 C 端）。别因为本地镜像里还留着它们就以为还在。
- **新增页面必须登记权限路由**：`perm_routes` 表 + `/admin/perm` 页面配角色，否则普通用户的菜单里不会出现。Java 启动时会自动注册新路由，但角色授权要人工配。

## ⚠️ 本地镜像停留在 P6 之前的旧快照
`E:\code\NoteLab\notelab-b` 里存在一批**从未入库、服务器上也没有**的文件：`src/app/(admin)/spire/`、`(admin)/trpg/page.tsx`、`(admin)/trpg/play/`、`(admin)/vs/`、`src/lib/vs-engine.ts`、`src/components/ThemePicker.tsx`、`src/components/ui/`。

它们正是 P6「B 端移除游玩功能」删掉的那批残留。**不要把它们当成本仓结构，更不要据此恢复入口**。需要准确版本时以服务器 `/root/notelab-b` 为准。

## 主题
只维护 light / dark 两套：antd 动态 `algorithm` + localStorage `notelab_b_theme` + 首帧防闪烁内联脚本 + Tailwind v4 `@custom-variant dark`。改外壳或页面样式时这几条链路都要顾到。

## 构建与发布（生产在服务器，本地只读参考）
```bash
ssh myapp
cd /root/notelab-b && npm run build && pm2 restart notelab-b
```
- **只用 npm**（镜像已配在 `/root/.npmrc`）。
- 会话 Cookie 为 `notelab_session`（HMAC，与 Java / Python 版兼容）；改认证相关代码前先确认这一点，不要换格式。

## 纪律与禁区
- 不动 `myapp`（旧前端，可随时回切）、`notelab`（旧 Python 版）、`notelab-c`（C 端）。
- 玩法功能已整体移到 C 端：**本端不再新增游玩入口**（后端玩法 API 仍保留）。
- 本目录是**镜像**：真正生效的代码在服务器 `/root/notelab-b`。别只在本地改。
