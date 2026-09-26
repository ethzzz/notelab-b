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

**业务页 25 个**：`dashboard` / `chat` / `arena` / `toolbox` / `tools` / `rag` / `english` / `extract` / `lowcode` / `notes` / `docs` / `trpg/gen` / **`spire-editor` ×6** / `ui` / `perm` / `c-users` / `translate` / `user/accounts` / `user/invites` / `user/roles`。逐页说明见 `README.md` 的功能清单表。

- `/trpg` → `/trpg/gen`、`/spire-editor` → `/spire-editor/cards`（307），都写在 `next.config.ts` 的 `redirects()`。
  ⚠️ 重定向必须放在 config 层（而不是页面里 `redirect()`）：它发生在 React 之前，**不经过 `(admin)` 的页面守卫** ——
  守卫只认"能进入的页面"，而 `/spire-editor` 这个裸路径已不在 `PageRoutes` 里，放到页面里会被自己的守卫拦掉。
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

## 爬塔尖塔内容工坊：6 个子页共享一份文档（2026-09-26 拆分）

原来是一个页面里的 4 个 Tab，现在拆成 `src/app/(admin)/spire-editor/` 下的 6 个子页：

| 子页 | 路由 | 干什么 |
|---|---|---|
| 卡片制作 | `/spire-editor/cards` | 自定义卡牌 |
| 角色制作 | `/spire-editor/chars` | 自定义角色（可引用技能库） |
| 技能制作 | `/spire-editor/skills` | 主动/被动技能模板 |
| 素材资源 | `/spire-editor/assets` | **槽位 → 素材路径**（节点整图 / 连线 / 背景 / 角色立绘） |
| 地图生成 | `/spire-editor/map` | 生成整套 3 幕的**节点配置 JSON**，多套命名方案、选一套发布 |
| 角色授权 | `/spire-editor/access` | 按 C 端用户组配置可选角色白名单 |

**核心约束：这 6 页编辑的是同一份文档。** 后端 `POST /api/spire-content` 是**整包覆盖写**，
漏带任何一个切片都会把它清空 —— 所以状态全部集中在 `_shared/store.tsx`，
子页只做自己那一片的编辑 UI，点任意一页的「保存」都是提交全量。

- `_shared/store.tsx` 的**脏标记用「整份文档指纹比对」**（`fingerprint()` 排序后 JSON 序列化），
  不是让每个 setter 手动置位：新增切片时不需要记得改标记逻辑，漏置位不会发生。
  ⚠️ 因此**前后端的净化口径必须一致**（空值一律丢弃，不存空串），否则保存往返一次指纹就变，永远显示「有未保存改动」。
- `saveQuiet()`（不刷本地引擎预览）给素材/地图页用；`publish()` 先 `commit()` 再发布，保证"发布的是服务端已落库的内容"。
- 子页可以假定切片已可用 —— 加载门在 `layout.tsx` 的 `Shell` 里，`!loaded` 时子页**根本不挂载**。

### 怎么加一类新的素材槽位（"配置类型之后再做拓展"的落点）

1. `src/lib/spire-assets.ts` 的 `ASSET_SLOTS` 加一行（页面是**声明式渲染**的，不用改页面代码）；
   `default` 填 C 端当前的硬编码值，页面用它显示「内置默认」并提供「恢复默认」。
2. 到 `notelab-c/lib/spire-assets.ts` 加对应的**消费点**（同一个 key）。
   ⚠️ **key 一经发布不可改名**：改名不报错，只会静默失配 → 回落默认，表现为"后台配了但没生效"。
3. 固定槽位走注册表；**角色立绘这组例外**，由 `slotsWithChars(charPool)` 按运行时角色池动态展开
   （所以新建工坊角色会立刻多出一个 `char.<id>` 槽位）；`sanitizeAssetMap` 对 `char.*` 是**开放命名空间**，
   不能因为注册表里没有就把值丢掉。
4. **敌人形象槽位刻意未开**：敌人 id 清单只在 C 端引擎里，要先由后端提供一份镜像常量，否则就是两份真相。
   （同理 C 端 `NODE_META.art` 是节点整图的**唯一默认来源**，B 端只存覆盖值，不复制一份路径表。）

### 地图生成：产物是自包含 JSON，不是参数

`src/lib/spire-mapgen.ts` 是 **C 端 `generateMap` 的移植版**（纯函数 + `mulberry32` 带种子可复现），
产物直接存节点表 `{act, layers, nodes:[{id,row,col,type,next}]}`，C 端不读参数、不读 `map-gen.config.json`。

- ⚠️ **不要用本仓 `src/lib/spire-engine.ts` 的 `generateMap`** —— 那份是 C 端引擎的**陈旧副本**
  （`MAP_ROWS=7`、无参老版本），只为卡/角色净化与卡面渲染而留。
- 生成后**必过一遍硬约束自校验**（`generateVerified`）：不交叉 / 无死路 / 全覆盖 / 唯一 BOSS / 开局安全层 /
  商店营地不相邻 / BOSS 前一层补给。有 violation 就**拒绝保存** —— 概率性生成器"看着像对的"说明不了任何事。
- 校验逻辑与 C 端的加载校验**分工不同**：B 端管"生成得对不对"（语义），C 端管"读进来的能不能建图"（结构 + `next` 交叉引用）。
  后端 `SpireContentController.sanitizeMaps` 只做形状与体积，不做地图语义 —— 避免变成第三套规则真相源。
- 预览用内联 SVG（第 0 层在下、层号向上递增，与 C 端盘面同向），配色与 C 端 `TYPE_STYLE` 取同一批色值。

### 发布链路的验证：两个脚本，分工不同

这套功能跨 `notelab-b` → `notelab-java` → `notelab-c`，坏点几乎都在**形状**而非类型上（字段被后端吃掉、发布读错键、
C 端校验器不认），类型检查一律看不出来。所以验证分两层：

| 脚本 | 跑在哪 | 证明什么 |
|---|---|---|
| `.sync/verify-maps-e2e.js` | 本地，不用服务器 | 生成器与 C 端校验器的**契约**一致（808 条断言） |
| `.sync/verify-map-publish-e2e.js` | 本地打生产 HTTP | 中间那层（java 净化 + 落库 + 发布快照 + C 端匿名读）**不丢字段、不改形状**（39 条断言） |

两者都用**逐字转译真实 TS**（`ts.transpileModule`）而不重写逻辑 —— 重写一遍等于测自己的想象。

⚠️ **`verify-map-publish-e2e.js` 会写生产 `ui_config`**（`POST /api/spire-content` 是整包覆盖写）。跑之前先留底：

```bash
scp .sync/backup-uiconfig.sh myapp:/root/ && ssh myapp "sh /root/backup-uiconfig.sh"   # 整表 dump 到 /root/backups
node .sync/verify-map-publish-e2e.js                                                    # 写入→发布→读→建图，finally 自动回滚
ssh myapp "sh /root/restore-uiconfig.sh"                                               # 精确整表还原
```

- 脚本的 `finally` 会「写回原草稿 + 按原发布态 publish/unpublish」，但那只做到**语义等价**：
  原始 `spire` 里连 `assets`/`maps` 键都没有，一旦走过 `save`，后端就会把这两个键（哪怕空对象）写进库。
  要让 DB 回到**原始字节**，必须再跑一次 `restore-uiconfig.sh`（整表还原）。
- 因此脚本里的回滚断言用的是**规范化口径 + C 端语义比对**，不是逐字节比 —— 逐字节比会因一个空 `defaultId` 假失败。
- 排查这类脚本时记住两个探针事实：`ui_config` 的列名是 **`config`**（不是 `cfg`），
  `mysqldump` 的 `--defaults-file` **必须排在参数首位**（否则报 `unknown variable`），且本机账号需要 `--no-tablespaces`。

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
