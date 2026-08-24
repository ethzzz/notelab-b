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

## 功能清单（21 个路由，与 myapp 19 页 1:1 + 新增 1 页）

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
| `/spire-editor` | 尖塔工坊（卡/角色/技能）+ **新增：发布/取消发布快照** | 原已 antd，补发布按钮与状态 |
| `/spire` | 爬塔游戏 | 引擎零改动（localStorage 加 b_ 前缀） |
| `/vs` | 吸血鬼幸存者 | 引擎零改动（localStorage 加 b_ 前缀） |
| `/ui` | 界面配置 + **新增「C 端背景」说明区与预览** | 保持原交互 |
| `/perm` | 权限路由表 + **C 端用户管理直达入口** | Table/Tag/Card |
| `/user/accounts` | 账户管理（服务端分页） | 原已 antd |
| `/user/roles` | 角色组管理（路由授权树） | 原已 antd |
| `/c-users` | **新增：C 端用户管理**（/api/c-admin/*，用户+用户组 Tabs） | 全 antd（Table/Form/Modal/Popconfirm/Tabs） |
| `/login` | 登录（回跳被拦截路由） | Form/Input/Button |
| `/register` | 注册关闭说明页 | 保持原样 |

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
3. 未做真实浏览器自动化测试，交互正确性依赖构建零报错 + 代码走查 + 接口层 curl 验证。
