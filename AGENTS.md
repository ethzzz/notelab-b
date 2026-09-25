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
- **新增页面必须登记权限路由**，否则普通用户的菜单里不会出现、也进不去：
  1. ⚠️ **Java 侧要同时改两处常量**——`MenuTree.MENUS` 加菜单节点 **+** `PageRoutes.PAGE_ROUTES` 加页面路由。`/ui` 界面配置只能改已有节点的名称/图标，**加不了新节点**；Java 启动时"自动注册新路由"**只覆盖 API 路由**（从 SpringMVC 映射采集），页面路由是手写常量。只改一处会分别表现为"超管能看普通角色看不了"和"谁都看不见"。详见 `../notelab-java/AGENTS.md` 的「新增后台页面」章节。
  2. 页面进了 `perm_routes` 之后，才会出现在 `/admin/perm`、`/user/roles` 里可勾选；已存在的角色**不会**自动获得新页面（Java 的默认权限只在角色路由为空时写入一次）。

## 用户组 ↔ 菜单/路由：绑定链路与两个配置入口
B 端的「用户组」就是 `perm_roles`（UI 上叫「角色组」），**与 C 端的 `c_user_groups` 无关**（那是玩家端标签，见 `../notelab-java/ops/SPIRE-CHAR-GATING.md`）。完整链路：

```
users.role → perm_role_routes（该组持有的 page:* / api:* 权限码）
              ↓
        /api/menu 同时产出 menu（可见菜单）+ pages（可进入页面）
              ↓
        菜单过滤（看不见） + 页面守卫（进不去）
```

两个配置入口（**都仅超管可用**，服务端逐个接口校验 `isSuperAdmin`，不靠前端隐藏按钮）：

| 入口 | 能干什么 |
|---|---|
| `/admin/user/roles` | 建组 / 改名 / 删组、**分配路由**（Tree，按菜单分组勾选）、**批量加·移成员** |
| `/admin/user/accounts` | 建号、单人改角色（行内下拉）、**批量设置用户组**（行多选，`preserveSelectedRowKeys` 跨页保留） |

- ⚠️ **`users.role` 是单值**——一个账户只属于一个用户组，所以「加入 A 组」是**改属**而非追加。批量加/移都走 `POST /api/perm/users/batch-role`；角色组页的「移出」= 并入内置 `user` 组（与删组时的迁移策略一致）。该接口有**超管归零保护**：按「本次降级了几个超管」算，剩余为 0 就整批拒绝。
- ⚠️ **内置组刻意不给成员管理入口**：`super_admin` 的成员变更等于权限授予、`user` 是默认组且「移出」无处可去。这两处的成员调整走账户管理页。删组会把成员并入 `user`，不会悬空。
- ⚠️ **`api:*` 权限码目前只登记、不强制校验**。接口的实际防护来自各 Controller 自己的登录/超管判断；把某个 `api:*` 从角色组里勾掉**不会**让接口拒绝访问。真正生效的是 `page:*`（= 菜单可见性 + 页面守卫）。要做接口级授权得另加服务端拦截。
- 新增页面/接口后，**已有角色组不会自动获得**新权限码（Java 的默认权限只在角色路由为空时写入一次），必须去 `/admin/user/roles` 勾选。

## 页面级守卫：只有后端下发的路由才进得去
`(admin)/layout.tsx` 有一层页面守卫，数据源是 `GET /api/menu` 的 **`pages`** 字段（= 当前账户被授予的页面路径清单，超管为全部；由 Java `PermService.allowedPagePaths` 计算，以 `PageRoutes.PAGE_ROUTES` 为准遍历，故数据库里的脏权限码不会凭空开通路径）。

- **点菜单与直接敲 URL 走同一套判定**：`usePathname()` 不在 `pages` 内 → 直接不渲染子页面（子组件不挂载，连请求都不会发出去）→ 403 提示 1.2s → `/admin/no-access?next=<清单里首个可进入页面>`。
- ⚠️ **归一处理（改判定逻辑时别漏）**：仪表盘在菜单里的 `path` 是 `/`，真实路由却是 `/dashboard`（`src/app/page.tsx` 把 `/admin` 307 到 `/admin/dashboard`）。守卫把 `pathname === "/dashboard"` 归一成 `/` 再比对，否则会把首页误杀。
- ⚠️ **`/no-access` 必须留在 `(admin)` 分组之外**（`src/app/no-access/page.tsx` → `/admin/no-access`）。放进 `(admin)` 会被守卫再判一次 → 死循环；`/login`、`/register` 同理都在组外。
- **fail-open**：`pages` 缺失（旧后端 / `/api/menu` 拉取异常）时**不拦截**。好处是前端可先于后端发布而不锁死所有人；代价是**这层不是安全边界**——它拦的是"误入页面"，不是"绕过 UI 调接口"（`/api/c-admin/*` 目前仍只要求 B 端登录）。
- 菜单负责「看不见」、守卫负责「进不去」，两者共用同一份后端清单但**判定独立**，改一处别忘另一处。

## ⚠️ 本地镜像停留在 P6 之前的旧快照
`E:\code\NoteLab\notelab-b` 里存在一批**从未入库、服务器上也没有**的文件：`src/app/(admin)/spire/`、`(admin)/trpg/page.tsx`、`(admin)/trpg/play/`、`(admin)/vs/`、`src/lib/vs-engine.ts`、`src/components/ThemePicker.tsx`、`src/components/ui/`。

它们正是 P6「B 端移除游玩功能」删掉的那批残留。**不要把它们当成本仓结构，更不要据此恢复入口**。需要准确版本时以服务器 `/root/notelab-b` 为准。

## 主题
只维护 light / dark 两套：antd 动态 `algorithm` + localStorage `notelab_b_theme` + 首帧防闪烁内联脚本 + Tailwind v4 `@custom-variant dark`。改外壳或页面样式时这几条链路都要顾到。

## 构建与发布（本地改 → 服务器从 git 同步）
```bash
# 本地：改完提交推送
git push origin main
# 服务器：同步 + 构建 + 重启一条命令搞定
ssh myapp "/root/notelab-java/ops/sync-deploy.sh notelab-b"
```
- **不要在 `/root/notelab-b` 里手改代码**——服务器是只读部署目标；脚本发现工作区脏会直接拒绝执行。完整行为与参数见根 `AGENTS.md`「开发流程」。
- 脚本只在**有变更**时构建；仅文档变更自动跳过（强制构建加 `--build`）；**构建失败不会重启服务**，老进程继续服务。
- **只用 npm**（镜像已配在 `/root/.npmrc`）。
- 会话 Cookie 为 `notelab_session`（HMAC，与 Java / Python 版兼容）；改认证相关代码前先确认这一点，不要换格式。

## 纪律与禁区
- 不动 `myapp`（旧前端，可随时回切）、`notelab`（旧 Python 版）、`notelab-c`（C 端）。
- 玩法功能已整体移到 C 端：**本端不再新增游玩入口**（后端玩法 API 仍保留）。
- 本目录是本地工作副本，**改这里**；服务器 `/root/notelab-b` 是只读部署目标（由 `ops/sync-deploy.sh notelab-b` 从 git 拉取）。别去服务器上改。
