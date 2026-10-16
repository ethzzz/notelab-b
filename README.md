# notelab-b —— NoteLab B 端管理后台（antd 版）

B/C 拆分阶段 4 产物：把原 /root/myapp 的全部管理端功能 1:1 迁移到本应用，
UI 全量 antd 化，经 nginx 以 `/admin` 前缀对外服务。**原 myapp 保持原样、可随时回切。**

## 架构位置

```
浏览器 → nginx :80
  ├─ /api/*        → 127.0.0.1:8001（notelab-java，Spring Boot，含 SSE 直通配置）
  ├─ ^~ /admin     → 127.0.0.1:3020（notelab-b，本项目，basePath="/admin"）
  └─ /             → 127.0.0.1:3010（notelab-c，C 端游戏中心）
```

- 页面内所有 `/api/*` 请求为**同域绝对路径**，由 nginx 直达 Java，Next 不做任何代理
  （next.config.ts 无 rewrites）。
- 唯一例外：英语发音 `/admin/api/tts`（Next route handler，Kokoro 本地 + edge-tts 兜底，
  与 myapp 相同），前端经 `BASE_PATH + "/api/tts"` 访问。
- 会话：B 端 Cookie `notelab_session`（HMAC，与 Python/Java 版兼容），登录/菜单/权限
  契约与 myapp 完全一致。

## 功能清单（与 myapp 19 页 1:1 + 新增页）

| 路由（/admin 下） | 功能 | antd 化情况 |
|---|---|---|
| `/` → `/dashboard` | 概览卡片入口 | 保持原交互 |
| `/chat` | 智能对话（SSE 流式，消费逻辑与 myapp 逐字节一致） | Select/确认弹窗走 antd |
| `/arena` | 模型竞技场（并行多模型 SSE + 心跳） | Tag.CheckableTag/Card/Button |
| `/toolbox` | 文本工具箱 | Button/Input.TextArea/Card |
| `/tools` | AI 工具库管理（超管） | Switch/Modal/Input/Checkbox |
| `/rag` | 文档问答 RAG（上传/问答/引用） | Upload.Dragger/Card/Tag |
| `/english` | 英语对话（SSE + 语法纠错 + TTS 播放 + 语音输入） | Modal 场景选择，其余保真 |
| `/extract` | 结构化抽取 | Button/Input/Card |
| `/lowcode` | 低代码平台（表单/流程/数据模型，本地草稿） | Select/确认弹窗走 antd |
| `/trpg/gen` | 剧本生成（轮询任务）+ **新增：发布/取消发布到 C 端** | Table/Tag/Button/Modal |
| `/trpg/play` | 玩剧本（跑团引擎） | Modal 走 antd，引擎零改动 |
| `/spire-editor/cards` | 尖塔工坊 · 卡片制作（原 Tab 拆分） | 原已 antd |
| `/spire-editor/chars` | 尖塔工坊 · 角色制作 | 原已 antd |
| `/spire-editor/skills` | 尖塔工坊 · 技能制作 | 原已 antd |
| `/spire-editor/assets` | 尖塔工坊 · **新增：素材资源配置**（槽位 → 素材路径，候选池来自 `GET /api/spire-assets/catalog` 后端扫盘） | 全 antd（Select 可搜 + 分组 + 缩略图预览） |
| `/spire-editor/map` | 尖塔工坊 · **新增：地图生成**（整套 3 幕节点 JSON，多套命名方案、选一套发布，生成后过 7 条硬约束自校验） | 全 antd + 内联 SVG 预览 |
| `/spire-editor/access` | 尖塔工坊 · 角色授权（按 C 端用户组配可选角色） | 原已 antd |
| `/spire-editor` | 旧入口，307 → `/spire-editor/cards` | 见 `next.config.ts` |
| `/spire` | 爬塔游戏 | 引擎零改动（localStorage 加 b_ 前缀） |
| `/vs` | 吸血鬼幸存者 | 引擎零改动（localStorage 加 b_ 前缀） |
| `/ui` | 界面配置 + **新增「C 端背景」说明区与预览** | 保持原交互 |
| `/perm` | 权限路由表 + **C 端用户管理直达入口** | Table/Tag/Card |
| `/user/accounts` | 账户管理（服务端分页） | 原已 antd |
| `/user/roles` | 角色组管理（路由授权树） | 原已 antd |
| `/c-users` | **新增：C 端用户管理**（/api/c-admin/*，用户+用户组 Tabs） | 全 antd（Table/Form/Modal/Popconfirm/Tabs） |
| `/translate` | **新增：翻译句子库**（每日英语翻译练习，/api/admin/translate/*）——句子组列表（状态/句子数/激活日期/来源）+ 新建/入队/设激活日期强制发布/删除；组详情分阶句子表 + 手动加句 / 批量导入（中文句末标点+换行切分，前端实时预览切分结果）/ AI 批量生成（场景+提示词+每阶数量 → 生成入库 → 预览可删） | 全 antd（Card/Table/Tag/Modal/Input/InputNumber/Select/AutoComplete/Popconfirm/Tooltip/Alert/Spin） |
| `/login` | 登录（回跳被拦截路由） | Form/Input/Button |
| `/register` | 注册关闭说明页 | 保持原样 |

> ⚠️ 上表里的 `/trpg/play`、`/spire`、`/vs` 三行是 **P6 之前的迁移记录**，页面已在 P6 随玩法功能移到 C 端时删除，
> 现在**不存在**（后端玩法 API 仍保留）。爬塔工坊也已由单页 4 个 Tab 拆成 6 个子页（2026-09-26）。

外壳：antd `Layout` + `Sider`（Menu 数据源 `/api/menu`，多级 SubMenu，ready=false 打
「敬请期待」Tag 并禁用）+ 固定 Header（主题切换/用户信息/超级管理员标记/退出）+ 移动端
Drawer 菜单。认证守卫与 myapp 一致（/api/me 401 → rememberPath → /login）。
ThemePicker 保留（antd Modal 承载，写 /api/ui-config 的 background，即 C 端匿名拉取的背景）。
全局 `App` 包裹 + `@ant-design/nextjs-registry` SSR 样式注入；toast 统一由 antd message 承载。

## 环境依赖

- Node 20+（与 myapp 相同）、npm 镜像 `registry.npmmirror.com`（/root/.npmrc 已配）
- 主要依赖：next 16.2.12 / react 19.2.4 / antd ^6.6.1 / @ant-design/nextjs-registry /
  @ant-design/icons / lucide-react / node-edge-tts / tailwindcss ^4（与 antd 共存，同 myapp）
- 无新增环境变量（TTS 沿用默认 Kokoro `http://127.0.0.1:8880` + edge-tts 兜底）

## 构建与启动

```bash
cd /root/notelab-b
npm install            # 首次
npm run build          # 零错误产物
pm2 restart notelab-b  # 生产重启（:3020，env PORT=3020 NODE_ENV=production）
pm2 logs notelab-b     # 日志
```

## 端口说明

| 服务 | 端口 | 说明 |
|---|---|---|
| notelab-b | 3020 | 本应用（仅本机/内网直连；公网经 nginx /admin） |
| nginx | 80 | 统一入口：/、/admin、/api |

## 与 myapp 的关系及切流

- myapp（:3000）代码与数据**零改动**，仍按原方式访问；本项目独立目录、独立进程。
- 二者共用同一后端（:8001）与会话 Cookie，登录态互通。
- 切流：公网用户直接访问 `http://<host>/admin` 即为 B 端新界面；如需把旧入口指过来，
  由人工在 nginx 层把原站点流量改指向即可（本阶段未动 nginx）。
- 回滚：见 /root/notelab-java/ops/BC-SPLIT-P4.md（占位壳备份在 /root/.notelab-b-p0-backup）。

## 已知遗留

1. `/c-users` 未进左侧菜单：菜单树是 Java 端常量（MenuTree）+ RBAC 过滤，不改 Java
   的前提下，入口放在「权限管理」页顶部（直达按钮）。
2. C 端菜单/路由权限由后端控制；`/api/c-admin/*` 后端仅校验 B 端登录（未限超管），前端入口放在超管可见的权限页内。
3. 未做**全站**真实浏览器自动化测试，交互正确性依赖构建零报错 + 代码走查 + 接口层 curl 验证。
   例外：博客管理的三个页面有浏览器级验收（`.sync/shot-blog-p3b.js`：带登录态用系统 Chrome/CDP
   打开页面、点「预览」、截图 + 读 DOM 断言），见下节。

## 博客管理三页（2026-10-16 起）

| 路由 | 干什么 |
|---|---|
| `/admin/blog-gen` | **文章起草 / 编辑（新建=编辑同页）**：`?slug=<文章>` 决定编辑哪一篇；干跑检查、存草稿 / 发布、AI 起草、预览 |
| `/admin/blog-articles` | 文章记录：浏览数 + 后台改动记录；行操作＝编辑 / 上线 / 下线 / 重新部署 / 删除（仅草稿） |
| `/admin/blog-deploy` | **部署状态**：最近一次、配置、历史 20 条 + 日志抽屉；有构建时 5 秒轮询、空闲 20 秒 |

- **「干跑检查」与真写共用同一份计划**（Java 侧 `BlogArticleService.plan()`），所以弹窗里看到的
  URL / 阻塞项 / 警告就是真写会遇到的那些；**AI 起草的结果直接填进同一套字段**，不另存一份。
- **预览为什么与线上一致**：点「预览」是把当前内容 POST 给 `/api/blog/preview` 拿一个短时 token，
  再把 `/blog/preview/<token>/` 嵌进 iframe —— 那一页由**博客自己的 Astro SSR** 渲染，
  与线上文章页同一套布局与 markdown 管线（expressive-code / KaTeX / 提示块 / 标题锚点）。
  编辑区右侧那个是编辑器自带的 marked 快速预览，两者不是一回事（页面上也标了）。
- ⚠️ 构建进行中（约 1 分钟）改文章会被 **409** 拒：构建脚本要 `git pull` 并读整个工作区快照，
  与提交并发会互相踩（Java 侧 `BlogRepoService.exclusive` + `BlogDeployService` 的单线程队列）。
  页面会说明原因，等它结束即可。
- ⚠️ 这三页都是**仅超管**（`PermGuard.SUPER_ONLY_PAGES` + `/api/blog` 在受限前缀里）；
  新增页面时 `MenuTree` 与 `PageRoutes` **两处常量都要改**，仅超管页还要进 `SUPER_ONLY_PAGES`，
  接口归属要进 `RouteGroups`（详见根 `AGENTS.md`）。
