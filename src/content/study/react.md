# React 熟练路线 · 9 周（面向 C 端）

> **给谁**：能写页面、但还不敢说自己「会 React」的前端/全栈。
> **终点**：L3 熟练 —— 能判断该用哪种渲染方式，能把首屏压进预算，能设计可分享的 URL 状态，能定位一次重渲染的代价，能安全上线与回滚。
> **靶场**：`notelab-c`（`src/app` + `src/features/home` + `apps/play`）。任务都落在真实文件上，不是造 demo。

## 这条路线要把你带到哪

| 级别 | 叫法 | 能做什么 | 怎么算达到 |
|---|---|---|---|
| L1 | 会写 | 能改组件、加一个交互 | 在现有页面里加一个筛选并生效 |
| L2 | 能独立 | 独立做一页、接接口、处理三态 | 交付一个可上线的页面 |
| **L3** | **熟练（本路线终点）** | 选渲染方式、定性能预算、设计 URL 状态、做诊断 | 通过文末毕业 rubric |
| L4 | 专家 | 设计组件体系/构建方案、解决框架级问题 | 不在本路线范围 |

## 知识地图：四个域

| 域 | 熟练要求 | 对应周 |
|---|---|---|
| 渲染与路由 | 说得清 SSR/SSG/客户端边界，能写出可索引的页面 | 1–2 |
| 性能与体验 | 能量 LCP/CLS/INP，能压进预算，能处理弱网 | 3–4 |
| 状态与数据 | URL 即状态、缓存与失效、错误边界 | 5–6、9 |
| 交付与质量 | a11y、SEO、构建、发布与回滚 | 7–8 |

---

## C 端与 B 端的五个硬差异

| 维度 | B 端（notelab-b） | C 端（notelab-c） |
|---|---|---|
| 用户 | 登录后的管理员，出错能重试 | 匿名访客，**第一次打开就决定走不走** |
| 入口 | 从菜单点进来 | 搜索引擎、分享链接、直接敲 URL |
| 性能 | 内网、可容忍 3 秒 | 4G 手机 + 首屏预算，**LCP 超过 2.5s 就开始丢人** |
| 状态 | 全局登录态 + 页面状态 | **URL 就是状态**（可分享、可回退、刷新不丢） |
| 失败 | 提示后重试 | 弱网、断网、接口 5xx 都要有兜底，**不能白屏** |

这五条决定了本路线的主线：**先让页面能被找到、被打得开、被手机用，再谈功能。**

---

## 阶段一 · 理解 C 端（第 1–2 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L1 → L2 |
| 这一阶段解决 | 从「会写组件」到「知道这一页该在哪渲染、能不能被搜到」 |
| 核心知识 | 三层入口（路由壳/外壳/内容）、`parseHomeRoute`、RSC 与 `"use client"`、metadata |
| 场景项目 | 场景 #2：一个详情页（要有 title/OG、刷新不丢、可分享） |
| 离开时应该能 | 为一个新页面选对渲染方式，并让 `curl` 看到它的 title |

### 第 1 周：先把 C 端跑起来，画出它的骨架

**本周目标**：在本地跑起 `notelab-c`，并能任取一个 URL，说清它经过哪三个文件、最后渲染出什么。

**为什么是这些内容**：这周不写新功能，只做两件事——把环境跑起来、把页面的分层看清楚。原因很直接：后面八周的所有判断（metadata 写在哪、`"use client"` 加在哪、数据由谁取、性能量哪一段）都建立在这条链路上。C 端不是「一个 `page.tsx` 一个页面」，而是「一个很薄的路由壳 + 一个共享外壳 + 按 URL 切换的内容组件」。看不清这层，最典型的后果有三个：把 SEO 元数据写进客户端组件，构建时直接报错；同一个接口在路由壳和内容组件里各请求一次；改一个 tab 却要动三个文件。这一周还要顺手建立「URL 是唯一真源」的直觉：刷新页面和点击侧栏必须走同一个解析函数，否则两者会出现两套高亮。学会的标志不是「跑起来了」，而是随便给一个地址，你能在三十秒内指出它经过哪几个文件、哪一行决定当前 tab。项目当前是 React 19.2 + Next 16，App Router 默认服务端组件，版本差异会在第 2 周展开。

#### 步骤 1.1 跑起来并找到三层入口

先确认 Node 20 以上（Next 16 的硬要求），在仓根安装依赖并启动。本仓是 npm workspace，在 `notelab-c` 根目录执行一次 `npm install` 会同时装好 `packages/*` 和 `apps/*`，不需要进子目录单独装。

```bash
cd notelab-c
npm install     # 首次；workspace 会一起装 packages/shared 与 apps/play
npm run dev     # next dev，默认 http://localhost:3000
```

然后依次打开 `/`、`/learn`、`/learn/java`、`/tools/dev`，对照源码找出三层：

```text
src/app/(home)/learn/page.tsx              路由壳：只导出 metadata + 渲染 <HomeApp />
src/features/home/App.tsx                  外壳：解析 URL 选 tab，拼标题、副标题与侧栏
src/features/home/components/LearnTab.tsx  内容：按 track 渲染语言列表或某门语言的课时
```

逐点解释这三行。第一，`(home)` 是路由组，括号不进入 URL，所以这个文件的真实路径就是 `/learn`；`@home/*` 是 `tsconfig.json` 里指向 `src/features/home/*` 的别名，等价于相对路径。第二，路由壳只做两件事：声明这一页的 metadata、把外壳挂上去，它不取数据、不判断 tab。第三，`App.tsx` 第一行是 `"use client"`，它是整棵交互树的边界；`LearnTab` 自己不解析 URL，只接收父级传下来的 `track`，这样「列表态 / 详情态」的切换逻辑只有一份。注意 `/learn/java` 并不校验语言白名单，未收录的 code 会渲染「没有这门语言」，而不是 404。

:::hint 为什么要先看路由壳
C 端的每个页面都是「路由壳 + 共享外壳 + 内容组件」。不理解这个分层，你会把 SEO 元数据写进客户端组件（无效或直接报错），或者把数据请求写进路由壳（每次切 tab 都重复请求）。
:::

:::solution 三层职责的参考答案
```text
路由壳  src/app/(home)/learn/page.tsx
        server component；只导出 metadata 与 <HomeApp />，决定这一页在搜索结果里的标题与描述。

外壳    src/features/home/App.tsx
        client component；useHomeRoute 把 pathname 解析成 { tab, cat, tool, track }，
        再按 tab 从 Record<HomeTab, TabContent> 里取标题与内容。

内容    src/features/home/components/LearnTab.tsx
        不读 URL；只接收 track。track 为 null 渲染语言列表，有值渲染详情。
```
:::

#### 步骤 1.2 找出 C 端特有的五个约束

打开 `/learn` 的源码和 `src/features/home/lib/learn.ts`，找出它为了「匿名可访问」做了哪些事，并写下五条约束，每条都要附一个文件作为证据。读的时候重点看注释，不要只看代码——C 端绝大多数取舍都写在「为什么这么写」里。例如 `learn/page.tsx` 顶部那句「本页不需要登录：内容走 Java 的公开只读出口」，就是一句设计决策：内容对匿名开放，进度只存浏览器，因此这一页不能依赖任何会话信息，也不能因为接口失败就整页白屏。

这个练习的价值在于：以后你每加一个页面，都要重新回答这五个问题，而不是复制上一页的代码。比如「失败有兜底」在这里不是加个提示就完了：`useLearning` 先读内存缓存再后台刷新，刷新失败时保留旧内容并标记「可能不是最新」，只有连缓存都没有才显示错误页。同一个约束，实现深浅可以差很远，写清楚证据才知道自己做到哪一层。再追问一步：学习进度为什么不进数据库？因为匿名用户没有 uid，要存服务端就得先登录，直接违背第一条约束；而进度只影响本机体验，清了也能重做，所以它留在 `localStorage` 是成本最低的选择。

:::hint 读代码要读「为什么这么写」
`/learn` 的注释写着「本页不需要登录：内容走 Java 的公开只读出口」，`learn.ts` 又写明「内容不落 localStorage」。这两句话直接决定了三件事：接口必须是公开只读的、进度不能进数据库、页面不能假设用户已登录。C 端的很多取舍都能从这类注释里读出来。
:::

:::solution 五条约束与证据
```text
1. 匿名可用：learn/page.tsx 注释 + lib/learn.ts 请求 /api/learning/public
2. 可被索引：learn/page.tsx 导出 metadata（title / description）
3. 失败有兜底：LearnTab.tsx 有 loading、!doc 错误态与「重试」按钮
4. 手机可用：共享外壳与 TabLayout 负责 375px 布局（第 4 周展开）
5. 可分享：/learn/<code> 是真实 URL，由 parseHomeRoute 解析，不存组件 state
```
:::

#### 步骤 1.3 用「URL → 组件」的方式读一次路由

打开 `src/features/home/lib/hooks.ts`，找到 `parseHomeRoute()`。它是 SSR 与客户端共用的唯一解析入口，返回四个字段：`tab`（顶层 tab）、`cat`（工具分类）、`tool`（工具详情 slug）、`track`（语言 code）。先别运行，拿下面五个地址自己写出四个字段，再打开页面验证高亮是否符合。

```ts
parseHomeRoute("/")               // { tab: 'projects', cat: 'all', tool: null,        track: null }
parseHomeRoute("/learn")          // { tab: 'learn',    cat: 'all', tool: null,        track: null }
parseHomeRoute("/learn/java")     // { tab: 'learn',    cat: 'all', tool: null,        track: 'java' }
parseHomeRoute("/tools/dev")      // { tab: 'tools',    cat: 'dev', tool: null,        track: null }
parseHomeRoute("/tools/translate") // { tab: 'tools',    cat: 'all', tool: 'translate', track: null }
```

逐行看逻辑。`pathname.split('/').filter(Boolean)` 先丢掉空段，所以 `/` 得到空数组。`tools` 分支排在最前，因为 `/tools/<slug>` 与 `/tools/<cat>` 共用一层路径，必须先查工具注册表，查不到才当分类；非法分类不报错，退回 `all`。`learn` 分支只取第二段当 `track`，刻意不校验白名单，这样将来加语言时旧链接不会突然失效。剩下的顶层 tab 一律查 `NAV_TAB_IDS` 表，这张表由 `nav.ts` 的 `NAV_GROUPS` 自动派生，加 tab 只需要改一处。末段既不是 tab、也不是 tools/learn 的地址会退回 `projects`，函数还留了一次旧 hash 外链的机会；服务端没有 `window` 时直接回退，不会因为读 `location` 报错，这是兼容旧链接的兜底，不是正常导航路径。

你可以打开 `/tools/translate` 验证后半段：地址在工具下，内容区渲染翻译工具，但左栏高亮落在它归属的「全部工具」；换成 `/tools/flashcards`，归属变成「知识库」，高亮跟着跑过去。同一个 `/tools/*` 前缀，高亮由工具注册表里的 `domain` 决定，而不是由 URL 前缀决定。再往下读一层：`useHomeRoute` 里的 `goTab`、`goCat`、`goTrack` 都用 `router.replace` 并带 `{ scroll: false }`，意思是切 tab 只替换当前历史记录、不堆栈、不跳回页顶、也不整页刷新。所以按浏览器后退不会在 tab 之间来回弹——这是「状态进 URL」的第一课，第 5 周会展开。

:::hint 路由解析是唯一真源
`parseHomeRoute` 同时被 SSR 和客户端调用，所以「刷新」和「点击导航」走的是同一套逻辑。改路由规则只改这里，不要在组件里再判断一次 pathname。
:::

:::solution 五个地址的完整结果
```text
/                 → tab=projects  cat=all  tool=null         track=null
/learn            → tab=learn     cat=all  tool=null         track=null
/learn/java       → tab=learn     cat=all  tool=null         track=java
/tools/dev        → tab=tools     cat=dev  tool=null         track=null
/tools/translate  → tab=tools     cat=all  tool=translate    track=null
```
:::

#### 步骤 1.4 在 `"use client"` 边界上认一次 React 19

Next 16 的 App Router 默认全部是服务端组件，只有在文件顶部声明了 `"use client"` 的那棵子树才会被打进客户端包。`App.tsx` 就是这条边界：它要用 `useMemo` 和 `useHomeRoute`（后者内部用 `useState` / `useEffect`），所以必须声明客户端；而它 import 的所有组件（`TabLayout`、`LearnTab`、`ProjectsTab`……）都跟着变成客户端组件。但「客户端组件」不等于「只在浏览器渲染」——React 19 仍会在服务端把它们预渲染成 HTML，浏览器拿到首屏后再 hydration 接上事件。这一点必须亲手验一次，否则你会把「客户端组件」和「空 HTML」混为一谈。

```bash
# ① 服务端返回的 HTML 里已经有标题
curl -s http://localhost:3000/learn | grep -o '<title>[^<]*</title>'

# ② 服务端也渲染了 loading 文案（说明 client 组件被 SSR 了）
curl -s http://localhost:3000/learn | grep -c '正在加载课程内容'

# ③ 数一下客户端边界有多少个
grep -rl '^"use client"' src | wc -l
```

如果第 ② 条返回 0，说明这一页被整体跳过了预渲染，先检查是否有 `ssr: false` 的动态导入。更直观的验法是打开 DevTools 的 Settings 禁用 JavaScript 再刷新：侧栏和标题还在，但点击 tab 不再切换——这就是「HTML 由服务端给、交互由 hydration 接」的分界线。React 19 还有一处和本周相关的版本差异：`ref` 现在可以作为普通 prop 传进函数组件，不再必须包一层 `forwardRef`（`src/components/ui/form.tsx` 里的旧写法仍然能跑，只是不再是唯一写法）。知道这一点，读老代码时就不会误以为 `forwardRef` 是 React 的硬性规则。React 19 的写法是：函数组件把 `ref` 当普通 prop 解构出来直接挂到 DOM 上，类型里写上 `ref?: Ref<HTMLInputElement>` 即可，调用方完全不用改。

:::hint 边界越低，首屏越轻
`"use client"` 不是「只在客户端渲染」，而是「这份代码客户端也要」。它会把整棵子树打进 JS 包，所以能留在服务端的组件就不要加这行。
:::

:::solution 三条命令的预期输出
```text
<title>编程语言学习 · NoteLab</title>     ← 页面 title 套了根布局的 %s · NoteLab 模板
1                                          ← HTML 里确实有 loading 文案
41                                         ← 当前 src 下 "use client" 文件数（会随代码变化）
```
结论：客户端组件被服务端预渲染出了首屏 HTML，交互要等 hydration；`"use client"` 标记的是打包边界，不是渲染位置。
:::

:::error 端口被占用
```text
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use :::3000
```
根因：上一次 `npm run dev` 没退干净，或另一个 Next 项目占着 3000。修复：先关掉旧进程，或换端口启动 `npx next dev -p 3001`；换端口后上面所有 `curl` 的地址要一起改。不要用「删 `.next` 再重装依赖」这类大动作处理端口冲突，那不是同一个问题。
:::

**自测**（合上文档回答）

1. `src/app/(home)/learn/page.tsx` 里为什么只有 metadata 和 `<HomeApp />`，而不直接写列表？
2. `/learn/java` 和点击侧栏进入 Java，为什么必须走同一个 `parseHomeRoute`？
3. `"use client"` 标记的组件，为什么 `curl` 还能看到它渲染的 HTML？

**验收**

- [ ] `npm run dev` 无报错，`/`、`/learn`、`/learn/java`、`/tools/dev` 四个地址都能打开
- [ ] `curl -s http://localhost:3000/learn | grep -o '<title>[^<]*</title>'` 输出 `编程语言学习 · NoteLab`
- [ ] 能写出三层文件与各自的一句话职责，且指出哪一层带 `"use client"`
- [ ] 五个地址的 `{ tab, cat, tool, track }` 预测全对，并在 `/tools/translate` 与 `/tools/flashcards` 上验证高亮分别落在「全部工具」和「知识库」
- [ ] 能解释为什么页面 HTML 里有「正在加载课程内容」，以及它什么时候会被替换

---

### 第 2 周：渲染策略与元数据

**本周目标**：给任意一个页面说清它在哪渲染、为什么，并让它有能被 `curl` 看见的 title、description 与 OG。

**为什么是这些内容**：第 1 周看清了「URL 到组件」的链路，这一周决定链路上每一段在哪执行。C 端的流量来自搜索与分享，页面能不能被搜到，在写第一行组件时就定了。选错渲染方式的代价往往不是慢，而是功能不存在：metadata 写进客户端组件会直接报错；动态路由不 `await params` 会 500；公开内容全放客户端，HTML 里只剩标题，爬虫拿不到正文。反过来，把登录后才该看的数据强行服务端渲染，又会把个人数据写进公共缓存。所以这一周要建立一张判断表，只看三件事：内容是否公开、是否因人而异、多久变一次。还要纠正本路线原大纲的一处误判：`/learn` 的正文其实是客户端拉的，路由壳只是静态壳，它「能被搜到」的只有标题与描述。看清这一点，才知道第 8 周为 `/roadmap` 单独做服务端取数是在补哪块短板。元数据不是装饰，它是这一页在搜索结果里的全部形象。

#### 步骤 2.1 判断一个页面该 SSR、SSG 还是纯客户端

拿三类页面投票：`/learn`（内容公开、更新不频繁）、`/me`（登录后）、`/games`（有交互动画）。先记住 Next 16 App Router 的默认值：**没有动态 API 就是静态**。只要组件里出现 `cookies()`、`headers()`、`searchParams`，或用了不缓存的 `fetch`，路由就会转为动态渲染。所以大多数「我明明没配置」的页面其实是构建期就生成好的静态页。

```tsx
// A. 公开、更新不频繁：静态 + 定时再生（与 B 二选一，不要同时出现）
export const dynamic = "force-static"
export const revalidate = 300   // 最多 300 秒旧内容；不写就是永不主动再生

// B. 因人而异 / 实时：每次请求都渲染
// export const dynamic = "force-dynamic"
```

两行配置的含义要分清：`dynamic` 决定「构建时生成还是每次请求生成」，`revalidate` 决定静态产物多久可以旧一次。`force-static` 的副作用是动态 API 会返回空值而不是退出静态，所以它适合「确定不需要请求上下文」的页面。

回到本仓的实际选择。`/learn` 的路由壳里没有 fetch，因此构建期就生成静态 HTML；正文由 `App.tsx` 里的 `useLearning` 在浏览器拉 `/api/learning/public`。这不是「SSR」，而是「静态壳 + 客户端取数」。为什么不做成服务端取数？看 `learn/[code]/page.tsx` 的注释：语言清单来自后端接口，`generateStaticParams` 的静态枚举会变成一份会过期的副本，所以这条路由干脆不枚举。注意它解决的是「枚举过期」，不是「首屏没正文」——后者要靠把取数挪到服务端，第 8 周再补。代价是正文不进 HTML。另外两类页面则没有悬念：`/me` 依赖会话，只能客户端取数并且不该被索引；`/games` 的交互重、首屏只需要壳，所以用静态壳加客户端渲染，和 `/learn` 同一套路，只是它连正文都不需要被搜到。

:::hint 判断只看两件事
**内容是否需要被搜索引擎看到**、**数据是否因人而异**。公开且不常变 → 静态/增量；公开且实时 → 服务端渲染；因人而异 → 客户端取数（但要给骨架）。
:::

:::solution 三个页面的结论
```text
/learn   静态壳 + 客户端取数   匿名可看；正文不进 HTML，title/description 进
/me      纯客户端              依赖登录态，不该被索引
/games   客户端 + 静态壳        交互重，首屏只需要壳
```
若要让 `/learn` 正文也被索引：把取数挪到路由壳（服务端）再把数据当 props 传给内容组件，而不是改 metadata。
:::

#### 步骤 2.2 给新页面加 metadata

`metadata` 是一个只读导出，只在服务端组件里生效，Next 在生成 HTML 时把它变成 `<title>`、`<meta name="description">` 和 OG 标签。本仓的 `/learn` 已经写了 title 与 description，但缺 OG 和 canonical。OG 决定分享到聊天软件时的卡片标题与摘要，canonical 告诉搜索引擎「这一页的正式地址是哪个」，对带查询参数或镜像域名的情况尤其重要。

```tsx
// src/app/(home)/learn/page.tsx（在原文件上补 alternates 与 openGraph）
import type { Metadata } from "next"
import HomeApp from "@home/App"

export const metadata: Metadata = {
  title: "编程语言学习",
  description: "从入门到精通的编程语言学习路线：分阶段讲解 + 可运行示例 + 随堂测试。无需登录，学习进度只存在你自己的浏览器里。",
  alternates: { canonical: "https://haolo.cloud/learn" },
  openGraph: {
    title: "编程语言学习 · NoteLab",
    description: "分阶段讲解 + 可运行示例 + 随堂测试，无需登录。",
    url: "https://haolo.cloud/learn",
    type: "website",
  },
}

export default function LearnPage() {
  return <HomeApp />
}
```

逐行看：`import type` 只参与类型检查，编译后消失，不会把任何东西带进客户端包。`title` 会被根布局的模板加工，实际输出是「编程语言学习 · NoteLab」；`openGraph.title` 由分享卡片直接读取，通常自己写完整标题，不要依赖那个模板。`description` 要当广告语写，它可能直接成为搜索结果里的两行摘要。OG 的 `url` 与 canonical 都写正式域名 `haolo.cloud`，不要写 `localhost`，否则分享出去会指向本机。

```bash
curl -s http://localhost:3000/learn | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/learn | grep -o '<meta property="og:title"[^>]*>'
curl -s http://localhost:3000/learn | grep -o '<link rel="canonical"[^>]*>'
```

:::hint metadata 必须写服务端
`export const metadata` 只在服务端组件生效。写进 `"use client"` 组件会在构建时直接报错——这是 C 端最常见的「做了 SEO 但没生效」。
:::

:::solution 三条命令的预期输出
```text
<title>编程语言学习 · NoteLab</title>
<meta property="og:title" content="编程语言学习 · NoteLab"/>
<link rel="canonical" href="https://haolo.cloud/learn"/>
```
三条都出现才算生效；只看到 title 说明 OG 没写进同一个导出对象。
:::

#### 步骤 2.3 客户端组件的边界

`"use client"` 是**边界声明**，不是「这个文件只能在浏览器跑」。它的规则有两条：从服务端组件 import 一个带指令的文件，这个文件和它 import 的整棵子树都进客户端包；但在已经属于客户端的子树里再写一次指令，等于什么都没发生。`App.tsx` 因为用了 `useHomeRoute`、`useLearning` 这类客户端 hook 必须是客户端，它 import 的 `ProjectsTab`、`LearnTab`、`TabLayout` 于是全都成了客户端组件——其中 `ProjectsTab` 只是把 `PROJECTS` 常量渲染成卡片，没有状态、没有事件、没有浏览器 API，它自己那行 `"use client"` 是冗余的。在 React 19 里，客户端组件同样会被服务端预渲染成 HTML，所以这条边界影响的是「谁被打进包」，不是「谁在服务端渲染」。

```bash
# 列出所有客户端边界；数一下有多少个
grep -rl '^"use client"' src | sort

# 拿 ProjectsTab 做实验：删掉第一行后，类型检查与构建都应通过
npx tsc --noEmit
npm run build
```

这个实验要理解的是「删了为什么没变化」：`ProjectsTab` 仍被 `App` 这个客户端组件引用，所以它依然是客户端组件，只是不再自己声明边界。真正能减包的做法是把边界往上移——让路由壳在服务端取数，把纯展示部分留在服务端，只把交互岛标成客户端。注意方向：服务端组件不能 import 进客户端组件（会被同化成客户端），所以只能把边界上移，不能把服务端组件塞进客户端树里。这需要改数据流，不是删一行指令就能完成的，本周先学会分辨「真边界」和「冗余声明」。

:::hint 边界越低，首屏越轻
`"use client"` 会把整棵子树打进客户端包。判断标准只有一条：这个组件有没有 state、事件处理器或浏览器 API。没有，就别加。
:::

:::solution 三个组件的边界判断
```text
App.tsx         需要 client   用 useHomeRoute / useLearning / useMemo
LearnTab.tsx    需要 client   学习进度用 useState + useEffect 读写 localStorage
ProjectsTab.tsx 不需要        纯常量渲染；因被 App 引用而仍是客户端组件
```
结论：`"use client"` 要写在「从服务端进入客户端」的那一层；写在客户端子树内部只是注释。
:::

#### 步骤 2.4 动态路由的 metadata 与 async params

`/learn/<code>` 的标题必须带语言名，静态 `metadata` 做不到，要用 `generateMetadata`。Next 15 起 `params` 是一个 Promise，必须 `await` 之后再读 `code`——从更早的版本升级过来最容易踩这一处。

```tsx
// src/app/(home)/learn/[code]/page.tsx（本仓真实写法）
import type { Metadata } from "next"
import HomeApp from "@home/App"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  return { title: `${code} · 编程语言学习` }
}

export default function LearnTrackPage() {
  return <HomeApp />
}
```

逐行看：函数必须是 `async`，否则没有 `await` 可用；参数类型写 `Promise<{ code: string }>`，这是在类型层面强制你 await。返回值只用 slug 拼标题，刻意不为了显示名再发一次请求——`generateMetadata` 会阻塞 HTML 的返回，在里面做慢请求等于把首字节时间往后拖。slug 直接当标题也够用：`/learn/java` 输出「java · 编程语言学习 · NoteLab」，分享出去能看出是哪门语言。这个路由没有 `generateStaticParams`，语言清单在构建期不可枚举，所以首次访问时按需渲染，每次执行一次 `generateMetadata`，更要注意别加重活。

```bash
curl -s http://localhost:3000/learn/java | grep -o '<title>[^<]*</title>'
# <title>java · 编程语言学习 · NoteLab</title>
```

:::hint 动态标题只拼 slug
`generateMetadata` 在服务端、在返回 HTML 之前执行。为标题多发一次接口，等于让所有访客多等一个往返；能从上文拿到的信息就别再请求。
:::

:::solution 验证与边界
```text
curl /learn/java      → <title>java · 编程语言学习 · NoteLab</title>
curl /learn/unknown   → <title>unknown · 编程语言学习 · NoteLab</title>
```
未知 code 也给得出标题：路由不校验白名单，页面自己渲染「没有这门语言」，标题仍可用。
:::

:::error 两个和这一周直接相关的报错
```text
Error: Route "/learn/[code]" used `params.code`. `params` should be awaited before using its properties.
```
根因：Next 16 的 `params` 是 Promise，同步解构拿到的是 Promise 对象。修复：`const { code } = await params`，并把函数改成 `async`。

```text
You are attempting to export "metadata" from a component marked with "use client", which is disallowed.
```
根因：`metadata` 写进了客户端组件。修复：把它挪到服务端路由壳，或改用同文件里的 `generateMetadata`（那个文件同样不能带 `"use client"`）。不要靠删掉指令硬压报错——先想清楚这一页到底该在哪渲染。
:::

**自测**（合上文档回答）

1. `/learn` 的 HTML 里有标题但没有课程正文，这是哪一种渲染策略？要补正文该改哪一层？
2. 为什么 `metadata` 不能写在 `App.tsx` 里？写错了会在什么时候、以什么形式暴露？
3. `generateMetadata` 里为什么不应该为了语言显示名再请求一次接口？

**验收**

- [ ] `curl /learn` 同时看到 `<title>`、`og:title`、`canonical` 三条，且 title 带 `· NoteLab`
- [ ] `curl /learn/java` 输出 `java · 编程语言学习 · NoteLab`
- [ ] 能为 `/learn`、`/me`、`/games` 各写一句策略与理由，`/learn` 写的是「静态壳 + 客户端取数」
- [ ] 能指出 `ProjectsTab.tsx` 的 `"use client"` 是冗余声明，并说清删了为什么行为不变
- [ ] 能说出若要让 `/learn` 正文被索引，改的是路由壳取数而不是 metadata

---

## 阶段二 · 首屏与移动端（第 3–4 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 |
| 这一阶段解决 | 从「能打开」到「在手机和弱网下也打得开」 |
| 核心知识 | LCP/CLS/INP、图片尺寸与懒加载、字体、骨架屏、375px、安全区、超时 |
| 场景项目 | 场景 #4：一个活动页（首屏预算 + 图片 + 埋点不阻塞） |
| 离开时应该能 | 把 LCP 压到 2.5s 内，并拿出改前/改后的对照数据 |

### 第 3 周：性能预算

**本周目标**：在 `npm run build && npm start` 的产物上，量出 `/` 与 `/learn` 的 LCP、CLS、TBT，并把 `/learn` 的 CLS 压到 0.1 以下，留下可复测的改前/改后对照。

**为什么是这些内容**：前两周解决「页面在哪渲染、能不能被搜到」，这一周解决「打开要多久、打开过程中会不会跳」。C 端的首屏预算不是可选项：LCP 超过 2.5 秒，用户开始离开；CLS 超过 0.1，用户会点错。更关键的是，性能问题不能靠猜。这个主页与 `/learn` 里没有图片、没有网络字体，如果照着通用清单去优化图片和字体，会得出「已经优化完了」的假结论；更可能的瓶颈是首屏那句「正在加载课程内容…」和随后整块内容的替换。这一周练的是一套固定动作：先量基线、再看瓶颈落在哪一段、只改那一段、用同一口径复测。第 4 周会把这套方法用到移动端与弱网，第 9 周再用 Profiler 看单次交互的代价；本周只要求你拿出一张可信的对照表，并且能说清每个数字是在什么条件下测的。

#### 步骤 3.1 量出基线

先固定测量条件，否则数字没有意义：用生产构建（`npm run build && npm start`），不要用 `npm run dev`——开发模式的 JS 未压缩、还带热更新，首屏包能大出好几倍；同一个页面、同一台机器、同一个浏览器窗口大小，测两次取中位数。Lighthouse 默认就是移动端模拟，正好对上 C 端的真实场景。

```bash
npm run build
npm start        # 生产服务器，仍是 3000 端口

# 移动端性能报告，导出 JSON 便于取数
npx lighthouse http://localhost:3000/learn \
  --only-categories=performance \
  --output=json --output-path=./lh-learn.json \
  --chrome-flags="--headless=new"

# 从 JSON 里取三个核心指标
node -e "const a=require('./lh-learn.json').audits;console.log('LCP',a['largest-contentful-paint'].displayValue,'CLS',a['cumulative-layout-shift'].displayValue,'TBT',a['total-blocking-time'].displayValue)"
```

Lighthouse 的实验室环境给的是 TBT（总阻塞时间），它是 INP 的近似，不是 INP 本身；真正的 INP 要在页面上真的点几次才有。想测真实 INP，就在 Performance 面板录一段「点击语言卡、列表切换」的交互，找最长的那次事件处理；TBT 只说明主线程被占，不说明哪一次点击会卡。所以先接受「实验室看 TBT、真机看 INP」这个分工，别把两个数混着比。除了时间，还必须记录 **LCP 元素是谁**——同一个 2.4 秒，可能是大标题，也可能只是那句加载提示，后者说明内容根本还没出来。

```js
// 在 /learn 页面控制台执行；先刷新再跑，跑之前不要点击页面
new PerformanceObserver((list) => {
  const e = list.getEntries().at(-1)
  console.log("LCP", Math.round(e.startTime) + "ms", e.element)
}).observe({ type: "largest-contentful-paint", buffered: true })

let cls = 0
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value
  console.log("CLS", cls.toFixed(3))
}).observe({ type: "layout-shift", buffered: true })
```

`buffered: true` 让观察器拿到注册之前已经发生的条目，所以「刷新后立刻粘贴」也能读到完整数据。LCP 在第一次用户输入后就停止更新，这也是「先别点页面」的原因。CLS 里的 `hadRecentInput` 用来排除用户输入后 500 毫秒内的位移——那是用户自己触发的，不算页面不稳。

:::hint 先量再改
没有基线的优化都是猜。手机模式下 LCP 主要受三件事影响：首屏图片/字体、阻塞渲染的 CSS、首屏 JS 的执行时间。先确定是哪一件，再动手。
:::

:::solution 基线记录表（数字是格式示例，必须换成你的实测）
```text
页面     LCP      LCP 元素          CLS     TBT     首屏 JS（Network 面板）
/        1.9s     首屏标题          0.01    90ms    约 210KB
/learn   2.6s     「正在加载课程内容…」 0.14   150ms   约 260KB
```
把这张表连同测量条件（build + start、移动端模拟、窗口 412×823）一起贴进笔记，改完用同样条件再测一次。没有对照的「优化」不算数。
:::

#### 步骤 3.2 图片与字体：两个最常见的 LCP 杀手

先做一次审计，而不是先写优化代码。打开 DevTools 的 Network，按 Img 和 Font 过滤，硬刷新 `/learn`：两类请求都是 0。再在控制台看 `getComputedStyle(document.body).fontFamily`，得到的是系统字体栈，没有任何 `@font-face`。结论很明确：这一页的两个「常见杀手」都不存在，现在去给图片加 `loading="lazy"` 只是自我安慰。

但为什么还要学它们？因为只要页面加一张封面或一套品牌字体，这两个坑立刻生效。图片的问题永远是尺寸：没有 `width/height`，图片下载完会撑开布局，CLS 直接超标；首屏主图如果加了 `loading="lazy"`，浏览器会推迟发现它，LCP 反而更差。字体的坑是「等字体加载完才画字」，`font-display: swap` 让浏览器先用系统字体画出来，字体到了再换。

```tsx
import Image from "next/image"

// 首屏主图：给尺寸防 CLS，priority 让它别被懒加载
<Image src="/cover.webp" alt="活动封面" width={1200} height={630} priority
       sizes="(max-width: 768px) 100vw, 1200px" />

// 折叠线以下的图：懒加载，别抢首屏带宽
<Image src="/shot.webp" alt="界面截图" width={800} height={450} loading="lazy"
       sizes="(max-width: 768px) 100vw, 800px" />
```

```css
/* globals.css：自定义字体先 swap，避免文字被字体下载卡住 */
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter.woff2") format("woff2");
  font-display: swap;
}
```

字体文件放 `public/fonts/`，路径大小写必须与 CSS 完全一致（Linux 服务器区分大小写，本机 Windows 不区分，这类 bug 只在线上出现）。预加载可以写在组件里，React 19 会把 `<link>` 提升到 `<head>`，App Router 里没有 `next/head` 可用：

```tsx
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
```

`crossOrigin=""` 不能省：字体请求是 CORS 请求，缺了它预加载的副本和实际请求对不上，浏览器会下载两次。同理，`priority` 和 `loading="lazy"` 不要同时写在一张图上，两个意图互相冲突，Next 会给出警告，而最终行为取决于框架版本——这种「看起来都写了」的配置最难排查。

:::hint 没有尺寸的图片就是 CLS
`<img>` 不带 `width/height`，加载完会撑开布局，CLS 直接超标。字体同理：等字体加载完再渲染文本，LCP 会被拖到字体下载完成之后。
:::

:::solution 审计结论与本周决定
```text
Network（/learn，生产构建，硬刷新）:
  Img    0 个请求
  Font   0 个请求
  Doc    1 个请求
  JS     若干（只和改前/改后自己比，不和别的站比）

决定：本周不优化图片与字体（没有可优化的对象），把预算花在加载态。
```
写下「为什么不改」和写下「改了什么」同样重要，否则下次有人会重复审计一遍。
:::

#### 步骤 3.3 骨架屏与 Streaming

`/learn` 现在的加载态是 `LearnTab.tsx` 里的一行 `<p>正在加载课程内容…</p>`，数据到了再整块换成语言列表。这带来两个问题：加载文案本身可能成为 LCP 元素，数字好看但用户还没看到内容；替换的瞬间高度突变，CLS 被记上一笔。先明确一个容易误会的点：加 `app/(home)/learn/loading.tsx` **救不了这里**。路由级 `loading.tsx` 只包住服务端渲染那一段，而 `/learn` 的壳在构建期就完成了，数据是浏览器里等的，整条链路根本不经过它。骨架必须写在真正等待的组件里。

```tsx
// src/features/home/components/LearnSkeleton.tsx（新建）
export function LearnSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[96px] animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  )
}
```

```tsx
// src/features/home/components/LearnTab.tsx（替换原来的 loading 分支）
import { LearnSkeleton } from "./LearnSkeleton"

if (loading) {
  return <LearnSkeleton />
}
```

`h-[96px]` 只是起点，不是标准答案：先给列表卡片加一个 `data-track-card`，在加载完成的页面上用 `document.querySelector('[data-track-card]').getBoundingClientRect().height` 量出真实高度，再把骨架调到同一数值。骨架与真实内容的顶边位置差控制在 8 像素以内，替换时才不会被眼睛捕捉到跳动。`aria-hidden` 是必要的：骨架对读屏用户没有信息量，真正该播报的是 aria-live 区域里的「正在加载」，这条第 7 周会补。

骨架屏不是为了好看，它的作用是**让用户相信页面在动**。没有骨架的空屏，半秒就会被当成「打不开」；但骨架尺寸和真实内容差太多，加载完又会跳一下，等于把问题从「等」换成了「抖」。这里还有一个必须自己拆穿的陷阱：骨架块够大时，它本身就会成为 LCP 元素，LCP 数字会变好看，但内容并没有更早出现。所以复测时要多记一个「列表首次出现的时间」——在 Performance 面板看，或用 `MutationObserver` 监听列表节点——LCP 与内容可见时间一起看，才不会用骨架把指标刷漂亮。

如果这一页以后改成服务端取数，做法会变：用 `<Suspense fallback={<LearnSkeleton />}>` 包住慢的部分，让外壳先到、列表随后流式补上，那时骨架由 fallback 提供；两种方案解决的是同一个等待，区别只在等待发生在服务端还是浏览器，别把 `loading.tsx`、`Suspense`、组件内 loading 三种工具混着用。

:::hint 骨架屏不是为了好看
它的作用是让用户相信页面在动。尺寸要贴近真实内容，否则加载完会跳一下，又变成 CLS。
:::

:::solution 改前/改后的复测方式
```text
1. npm run build && npm start
2. 用 3.1 的控制台脚本记录 LCP 元素与 CLS（刷新后立刻执行，不点击）
3. 同一页面再跑一次 Lighthouse，取 LCP / CLS / TBT
4. 填回同一张表：/learn 的 CLS 应从 0.14（示例基线）降到 0.1 以下，
   LCP 元素应不再是那句加载文案；同时记下列表首次出现的时间做对照
```
若 CLS 仍超标，用 DevTools 的 Performance 面板录一次加载，看 Layout Shift 发生在哪一帧、被哪个元素顶开。
:::

:::error 字体加载失败
```text
Failed to decode downloaded font: http://localhost:3000/fonts/inter.woff2
OTS parsing error: invalid sfntVersion: 1231971952
```
根因：这个地址返回的不是字体文件。最常见的是路径写错被 404 页面接住，浏览器把 `<!DOCTYPE html>` 当字体解析，于是报 `invalid sfntVersion`。修复：在 Network 里确认状态 200、`Content-Type: font/woff2`；用十六进制查看文件头应为 `wOF2`；确认文件放在 `public/fonts/` 且大小写与引用一致。不要靠改 `font-display` 或加 `!important` 硬压，那只是把「字体没加载」变成「字体一直不生效」。
:::

**自测**（合上文档回答）

1. 为什么给 `/learn` 加 `loading.tsx` 不会改善首屏？这条链路上数据是在哪一步等的？
2. 为什么记录 LCP 时必须同时记 LCP 元素？只记时间会漏掉什么？
3. CLS 统计里的 `hadRecentInput` 排除了什么？为什么排除了才算「页面不稳」？

**验收**

- [ ] 在生产构建上跑过两次 Lighthouse（改前/改后），LCP、CLS、TBT 与测量条件写在同一张表里
- [ ] 控制台脚本能打印出 LCP 元素；改前是加载文案，改后能说清它变成了骨架块还是真实内容
- [ ] `/learn` 的 CLS < 0.1，且记下了「列表首次出现时间」；若 LCP 变好但内容没更早出现，能解释原因
- [ ] Network 面板确认 Img 与 Font 请求为 0，并在笔记里写明本周不优化它们的原因
- [ ] 骨架与真实卡片顶边位置差 ≤ 8px，加载完成的瞬间肉眼看不到跳动

---

### 第 4 周：移动端

**本周目标**：在 375×667 视口下，`/` 与 `/learn/java` 都量不出横向滚动；所有可点元素 ≥ 44×44；DevTools 的 Slow 3G 与 Offline 两档下，12 秒内出现带「重试」的错误态。

**为什么是这些内容**：第 3 周把首屏压进预算，量的是「慢」；这一周量「窄」和「手」。C 端的访客九成从手机竖屏进来：375 宽、一根拇指、拇指下面还有一条 Home 指示条、地铁里一格信号。这一周把第 3 周那套「先量再改」的方法，从时间轴搬到尺寸和输入上。不学会的后果非常具体：一张 399px 宽的卡片会让内容区横向滚动，而内容区自己就是滚动容器，你抄来的那句 `document.documentElement.scrollWidth` 探针返回 `false`，于是你得出「没问题」的假结论；一个 28px 高的按钮在真机上点三次不中一次；一个没有超时的请求在弱网下转圈三十秒，用户不会等——而他正是第一次来的匿名访客，走了就不会回来。第 5 周开始把这些交互状态搬进 URL，第 9 周再量化「点一下有多卡」（INP）。本周只解决三件事：不横着滚、点得中、等待有尽头。

#### 步骤 4.1 375px 重排

先把这个词拆开：**文档级**横向滚动是 `body` 被撑宽，**容器级**横向滚动是某个 `overflow` 容器自己多出一截。C 端外壳里，内容区 `.content` 写的是 `overflow-y: auto`（见 `src/features/home/components/TabLayout.module.css`）。按 CSS Overflow 的规则，一个轴的计算值不是 `visible` 时，另一个轴的 `visible` 会被计算成 `auto`——所以内容区同时也是横向滚动容器。后果是：卡片宽 399px 时，横向溢出的那截被内容区吃掉了，`document.documentElement.scrollWidth` 依然等于 `window.innerWidth`，自检返回 `false`，而用户手指明明能左右拖动。

所以探针要分三层查：文档、容器、元素。这也是本周唯一需要背下来的动作——**先确定滚动发生在哪一层，再谈修**。

```js
// 在 375px 宽度下执行；三层都"空"才算没有横向滚动
const vw = window.innerWidth

// ① 文档级：整页被撑宽
document.documentElement.scrollWidth > vw

// ② 容器级：谁自己成了横向滚动容器（C 端的内容区就是这种）
const boxes = [...document.querySelectorAll('*')].filter((el) => {
  const s = getComputedStyle(el)
  if (s.position === 'fixed') return false          // 固定层不参与滚动宽度
  return /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1
})

// ③ 元素级：谁的右边越过了视口右边线
const wide = [...document.querySelectorAll('body *')]
  .map((el) => ({ el, r: el.getBoundingClientRect(), pos: getComputedStyle(el).position }))
  .filter(({ r, pos }) => r.width > 0 && pos !== 'fixed' && r.right > vw + 1)
  .map(({ el, r }) => `${el.tagName.toLowerCase()} .${el.getAttribute('class') || ''} right=${Math.round(r.right)}`)

console.log({ boxes: boxes.length, wide: wide.length, detail: wide })
```

三点读法：`+1` 是给亚像素留的余量，缩放 125% 时 `getBoundingClientRect()` 会给出 `375.00003` 这种值；`r.width > 0` 排除 `display:none` 的元素（它们的矩形全是 0，会污染结果）；`position !== 'fixed'` 排除固定层——固定定位根本不参与滚动宽度，一个故意溢到屏幕外的固定提示条会被误报成「整页横滚」。侧栏抽屉（`position: fixed` 加 `translateX(-102%)`）也属于这一类，它的矩形在屏幕之外，与滚动无关。

常见根因按出现频率排：写死的 `width` / `min-width`；flex 子项的 `min-width` 默认是 `auto`，不写 `min-width: 0` 就缩不到内容宽度以下；长英文单词与 URL 不换行；代码块 `white-space: pre`；以及 `100vw`——它在有纵向滚动条的桌面浏览器里比可视宽度多出一个滚动条的宽度。修的时候不要用 `overflow-x: hidden` 一把盖住，那是把溢出藏起来，内容照样被切掉，只是没人看得见。

为什么偏偏测 375：它是仍在流通的机型里偏窄的一档（iPhone SE 系列、部分安卓），比它更窄的 320 已经很少；比它宽的 390 / 412 通常只会更宽松，唯独一个例外——横屏。横屏时可视宽度变成 667，但可视高度只剩 375，竖向内容会被挤成一条，所以横屏要单独看一眼「首屏还能不能看到主按钮」。

```css
/* 让该换行的换行、该自己滚的滚自己，别带动整页 */
.card { min-width: 0; overflow-wrap: anywhere; }
.row  { display: flex; flex-wrap: wrap; }
.row > * { min-width: 0; }
pre, .code { max-width: 100%; overflow-x: auto; }  /* 代码块自己滚是"对"的 */
```

:::hint 内容区自己就是滚动容器
在这个仓库里，`document.documentElement` 那条探针单独用会骗你。三层都要查，尤其是 `overflow-x` 计算成 `auto` 的容器。
:::

:::solution 排查记录（数字是格式示例，换成你的实测）
```text
改前：
  ① 文档级 false   ← 所以"看起来没问题"
  ② 容器级 1 个：div.TabLayout_content__xxx  scrollWidth 399 > clientWidth 343
  ③ 元素级 1 个：button .card right=399（宽度写死 20rem）

改后：
  ① false  ② 空  ③ 空
```
把这三行一起写进笔记。只写「已修好」而不写「改前是哪一层溢出」，下次换页面还得从头猜。
:::

#### 步骤 4.2 触控目标与安全区

先给 44 找到出处，否则它就是个玄学数字：WCAG 2.2 的 2.5.8（AA 级）只要求 **24×24** CSS 像素；44 来自 Apple HIG 的 44pt，Material 是 48dp。C 端取下限 44，是因为它同时满足「拇指点得中」和「走路时点得中」。相邻目标的间距建议 ≥ 8px，否则拇指边缘会同时压到两个。

这里有个「写了没生效」的经典：`<a>` 是非替换行内元素，`height` / `min-height` 对它**不适用**。给链接写 `min-height: 44px`，DevTools 里 `getBoundingClientRect().height` 仍然是 28——不是样式没生效，是这个属性对行内盒根本不参与计算。改成 `inline-flex` 就有了：

```css
/* 触控目标：≥44×44。inline 的 <a> / <span> 必须先变成能算尺寸的盒 */
.tap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
  padding: 0 12px;
}
.tap + .tap { margin-left: 8px; }

/* 底部固定栏：给 Home 指示条让位 */
.bottomBar {
  position: fixed;
  inset: auto 0 0 0;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
```

安全区还有一层前提：`env(safe-area-inset-*)` 只有在 `viewport-fit=cover` 时才有值。本项目在 `src/app/layout.tsx` 的 `viewport` 导出里已经声明了 `viewportFit: "cover"`（全屏游戏台需要），所以 `env()` 能取到值；换一个没声明它的项目，`calc(12px + 0px)` 永远等于 12px——公式看着没错，让位根本没发生。另外注意：Chrome 的设备模拟器通常把 safe-area 当 0，它只能验证公式没写错（`getComputedStyle` 能算出 12px），验证不了「是否真的让开了」。后者得上真机。

还有一个常被忽略的触屏事实：`:hover` 在触屏上没有对应状态。桌面端靠 `:hover` 展开的菜单、靠 `title` 显示的说明，在手机上要么永远不出现，要么点一下先触发 hover、再点一下才触发点击（iOS 的老行为）。做法是把交互改成点击驱动，需要保留 hover 视觉时用 `@media (hover: hover) and (pointer: fine)` 包起来，触屏设备干脆不给这套样式。

量一遍比看一遍可靠：

```js
// 列出所有小于 44×44 的可点元素
const small = [...document.querySelectorAll('button, a[href], [role="button"]')]
  .map((el) => ({ el, r: el.getBoundingClientRect() }))
  .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
  .map(({ el, r }) => `${el.tagName} ${Math.round(r.width)}×${Math.round(r.height)} ${(el.textContent || '').trim().slice(0, 8)}`)
console.log(small.length, small)
```

:::hint 手指不是鼠标
鼠标 1px 就能命中，拇指的接触面约 9mm。44px 是经验下限；相邻按钮间距小于 8px 会误触；底部固定栏必须用 `env()` 让位，而且 `env()` 依赖 `viewport-fit=cover`。
:::

:::solution 改前 / 改后尺寸表
```text
元素                     改前        改后      问题
顶栏「返回列表」按钮      74×28      74×44     padding 撑高，没给 min-height
语言卡（button）          343×96     343×96    本来合格
大纲里的课时项            260×32     260×44    行高挤，间距 4px → 8px
「重试」（错误态）        88×32      88×44     min-height 缺失
底部固定栏                padding 12 12+safe   env() 未用
```
:::

#### 步骤 4.3 弱网与断网

弱网这一步真正的坑不是「慢」，是「没有尽头」。`fetch` 默认没有应用层超时（浏览器给的连接超时是分钟级），所以 `await apiJson(...)` 在 Slow 3G 下能转很久；而离线时它**立刻**抛 `TypeError: Failed to fetch`。两种失败的表现完全不同，必须分开处理——否则你会把「离线」也写成「网络超时，请重试」，用户点了十次重试也不会好。

现在 `src/features/home/lib/learn.ts` 的 `fetchDoc()` 既没有 `signal` 也没有超时；而 `hooks.ts` 里的 `useLearning` 已经备好了两条路：有缓存就继续用并置 `stale`，没缓存就置 `error` 让 `LearnTab` 渲染错误态。也就是说，只要 `fetchDoc` 抛出的是一句人话，界面自动就是对的。所以本周只改这一层：

```ts
// learn.ts：给公开内容请求加 12 秒超时（真实实现建议抽成公共 withTimeout）
const TIMEOUT_MS = 12_000

export async function fetchDocWithTimeout(): Promise<LearningDoc> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    return await apiJson<LearningDoc>(API, { signal: ac.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('网络超时，请重试')
    }
    throw new Error('网络异常，请检查连接')
  } finally {
    clearTimeout(timer)
  }
}
```

逐行看三处：`setTimeout(() => ac.abort(), ...)` 只负责取消请求，**不负责收尾**——取消后 `fetch` 会 reject，异常仍然要你在 `catch` 里接住；`e instanceof DOMException && e.name === 'AbortError'` 是唯一可靠的分支判据（别用 `String(e).includes('abort')` 去猜，Safari 的措辞和大小写都不一样）；`finally` 里的 `clearTimeout` 不能省，否则请求成功之后计时器还在跑，12 秒后白白 abort 一个已经结束的控制器——今天无害，等这个控制器被复用时就是随机 bug。

顺带排掉一个常见的错误依赖：`navigator.onLine` 表示「有没有网络接口」，不是「能不能到服务器」。连着一个没有出口的 WiFi、或者 DNS 挂了的时候它仍然是 `true`，请求照样失败。所以它可以用来**提前**提示「你好像断网了」，不能用来判定成功或失败——判据永远是请求本身的结果。

:::hint 超时是必须的
没有超时的请求，在弱网下会挂 30 秒以上，用户只看到一直转圈。给请求 10–15 秒超时，失败给「重试」，比无限等待好得多。
:::

:::solution 三档网络的预期表现
```text
正常       → 骨架（第 3 周那一步做的）→ 内容；Network 里 /api/learning/public 200
Slow 3G    → 内容区先出错误态（12s）→ 点「重试」→ 重新发一次请求
Offline    → 立刻出「网络异常，请检查连接」，不转圈
有旧缓存   → 继续显示旧内容 + 「内容可能不是最新 · 刷新」角标（stale=true）
```
最后一行是第 6 周的伏笔：有缓存时**不该**把内容换成错误页。`useLearning` 已经这么做了，别在改造时把它改回去。
:::

:::error 超时之后的两种「看不见」的失败
```text
Uncaught (in promise) DOMException: The user aborted a request.
```
根因一：`abort()` 之后没人接。控制器只取消请求，取消引发的 reject 仍需要 `catch`；漏了它控制台是这行红字，而 UI 的 `loading` 会永远停在 `true`——页面既不报错也不出内容。

```text
TypeError: Failed to fetch
```
根因二：离线。它**不是** `AbortError`（`e.name` 是 `TypeError`），所以拿 `name === 'AbortError'` 统一判断会把离线误报成超时。修复：两支分支各给一句人话文案，并在 `finally` 里清计时器；abort 的那条路径必须落到 `setState`。
:::

**自测**（合上文档回答）

1. 在 C 端，为什么 `document.documentElement.scrollWidth > window.innerWidth` 可能返回 `false`，而页面其实能横向拖动？该改查哪三层？
2. 给 `<a>` 写 `min-height: 44px`，为什么量出来的高度还是 28？
3. 离线时报的是 `TypeError` 还是 `AbortError`？这个区别为什么会影响给用户看的那句文案？

**验收**

- [ ] 375×667 下跑三层探针：文档 `false`、容器数组为空、元素数组为空
- [ ] `querySelectorAll('button, a[href], [role="button"]')` 里没有一个矩形小于 44×44（`display:none` 的除外）
- [ ] iPhone 真机看底部固定栏：Home 指示条不压住内容，横屏再确认一次
- [ ] Slow 3G 下 12 秒内出现「网络超时，请重试」和可点的「重试」，点了会重新发请求
- [ ] Offline 下立刻出现「网络异常，请检查连接」，不是转圈
- [ ] 笔记里有「正常 / Slow 3G / Offline」三档的实际表现，以及改前改后的尺寸表

---

## 阶段三 · 状态与数据（第 5–6 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从「组件内 state」到「URL 即状态 + 缓存有失效策略」 |
| 核心知识 | `useSearchParams`、深链、`no-cache + ETag`、SWR、`error.tsx`/`not-found.tsx` |
| 场景项目 | 场景 #1：内容列表 + 筛选 + 分页（刷新不丢、可分享） |
| 离开时应该能 | 做出可分享、可回退、失败不白屏的列表页 |

### 第 5 周：URL 就是状态

**本周目标**：给 `/tools` 列表补上 `?cat=` 与 `?page=`，任何筛选/分页组合都能刷新保持、复制分享、后退可解释；详情用 `?id=` 打开且刷新不丢、命中不到时有明确提示。

**为什么是这些内容**：前四周解决「能不能打开、手机上能不能用」。这一周换一个维度：用户怎么把「我看到的东西」带走。C 端的入口不是菜单，是分享出去的链接和搜索结果——状态一旦只活在组件里，刷新、后退、分享三种行为同时失效，而这类 bug 你在开发时永远看不到，因为你不刷新。项目里其实已经有两套 URL 状态：`/learn/<code>` 用路径段承载「当前是哪门语言」，`/tools/<slug>?id=<itemId>` 用查询参数承载「工具里的哪一条」（`src/features/home/lib/deep-link.ts` 有完整注释）。本周要做的是给筛选与分页补上同一份契约，并分清两件事：**读**（服务端 `searchParams`、客户端 `useSearchParams`、挂载时读一次 `window.location.search`）与**写**（`replace` 还是 `push`）。第 6 周的缓存问题会从这一周的错误里长出来：同一个 URL 拿到不同内容时，你就分不清是缓存坏了还是状态压根没写进去。

#### 步骤 5.1 把筛选条件写进 URL

现象很朴素：给列表加一个分类筛选，用的是 `useState`。点起来一切正常，直到你刷新——回到默认；把链接发给别人——对方看到全量。这不是小毛病，是功能缺失。

做法就三件事：读的时候兜底、写的时候**合并**而不是覆盖、默认值不写进 URL。

```tsx
"use client"
import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type Cat = "all" | "ai" | "dev" | "game"
const isCat = (v: string): v is Cat => v === "all" || v === "ai" || v === "dev" || v === "game"

export function useCatParam() {
  const sp = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const raw = sp.get("cat")
  const cat: Cat = raw && isCat(raw) ? raw : "all"      // URL 是外来输入：非法值兜底，不 404

  const setCat = useCallback((next: Cat) => {
    const q = new URLSearchParams(sp.toString())        // 带上原有参数（page / q）
    if (next === "all") q.delete("cat")                 // 默认值不落 URL
    else q.set("cat", next)
    q.delete("page")                                    // 换分类回第一页
    const qs = q.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, sp])

  return [cat, setCat] as const
}
```

逐行看：`new URLSearchParams(sp.toString())` 而不是 `new URLSearchParams()`——后者一 `set` 就把 `page`、`q` 全丢了，用户在第 3 页切个分类会莫名跳回第 1 页；`q.delete("page")` 是显式表达「换筛选等于重置分页」，别指望读代码的人替你想；`{ scroll: false }` 是因为筛选是同一屏里的细化，跳回顶部会让用户每点一次都失去上下文；非法值兜底成 `all`，因为 C 端的 URL 会被手打、被聊天软件截断，`?cat=`、`?cat=../` 都可能出现，页面必须还能开。

分页是同一个套路的另一半，只是它读回来要过一遍数字校验：`const page = Math.max(1, Number(sp.get("page") ?? 1) || 1)`——`Number("abc")` 是 `NaN`，`NaN || 1` 才是 `1`；漏了这层，`?page=abc` 会让 `slice()` 参数变成 `NaN`，列表直接空白。

:::hint 为什么 URL 是状态
用户会复制链接发给人、会按后退、会收藏。写在 state 里的筛选，一刷新就没了——这在 C 端是「功能缺失」，不是小毛病。
:::

:::solution URL 对照表
```text
操作                      地址栏                刷新后
打开 /tools               /tools                all
点「AI」                  /tools?cat=ai         ai
再点「开发」              /tools?cat=dev        dev
在第 3 页点「游戏」        /tools?cat=game       game（page 被清掉）
点回「全部」              /tools                all（不留 ?cat=all）
分享 /tools?cat=dev       对方看到 dev           dev
```
最后两条最容易被忽略：默认值留在 URL 里会制造 `?cat=all&page=1` 这种「看着有状态其实什么都没变」的地址，既难看，也会让第 6 周的缓存 key 多出一堆重复项。
:::

#### 步骤 5.2 深链与刷新不丢

现象：详情用 `useState<string | null>(openId)` 打开。组件里一切正常；刷新——列表回来了、详情没了；把地址发给同事——他看到列表。用户不会理解「你少点了一下」，他只会觉得链接坏了。

判断一个状态该进路径段还是查询参数，只看两条：

```text
进路径段（/learn/java、/tools/flashcards）
  · 值域有界、可枚举（语言、分类、工具）
  · 值得独立 metadata、值得被索引
  · 一个值就等于一"屏"内容

进查询参数（/tools/flashcards?id=abc123）
  · 值域无界（用户生成的条目 id、时间戳、游标）
  · 只是同一屏的视图参数（?id= 定位到某一条）
  · 不想为每个值写一个 page.tsx
```

项目里两套都在用：`/learn/<code>` 是路径段（一门语言是一级内容），`/tools/<slug>?id=<itemId>` 是查询参数（条目是工具内部的一条）。`deep-link.ts` 里有两个刻意的选择值得抄：

```ts
// src/features/home/lib/deep-link.ts（节选，仓库里已有完整实现）
// ① 不用 useSearchParams：这些页面走预渲染，而这里只需「挂载时读一次」
useEffect(() => {
  const raw = new URLSearchParams(window.location.search).get("id")
  setId(raw && raw.trim() ? raw.trim() : null)
}, [])

// ② 数据就位后再定位；找不到就明确告诉用户，而不是静默落到列表首页
useEffect(() => {
  if (!ready || !id) return
  const raf = requestAnimationFrame(() => {
    const el = document.querySelector(`[data-item-id="${escAttr(id)}"]`)
    if (!el) { setStatus("missing"); return }
    setStatus("found")
    el.scrollIntoView({ block: "center" })
  })
  return () => cancelAnimationFrame(raf)
}, [ready, id])
```

为什么可以不用 hook：从 `/tools` 进到 `/tools/<slug>` 换了路由段，工具组件必然重新挂载，「读一次」就够；换成 hook 反而要多一层 Suspense 边界（见 5.3），收益为零。但反过来要当心：如果状态会在**同一路由段内**变化（`?cat=ai` → `?cat=dev` 不换路由段），就必须订阅，读一次会永远停在旧值。

`escAttr` 那行也别省：`id` 来自 URL，是外来输入，直接拼进选择器会让一个带引号的 id 把 `querySelector` 抛成语法错误，整个工具白屏。

:::hint 深链失败要说话
目标不存在（条目被删、换了设备——这些数据只存本机）时，静默落到工具首页是最难排查的：用户以为「我的记录没了」，你以为「深链没问题」。
:::

:::solution 两种写法的结果对比
```text
✅ /learn/java                     刷新还在、可分享、能被索引
✅ /tools/flashcards?id=abc123     刷新还在、可分享、命中不到时有明确提示
❌ 组件内 setOpen(true)            刷新就没了、分享出去是列表页
❌ 用 localStorage 记住"上次打开的" 换设备就丢、同机两个标签页互相污染
```
最后一行值得多想一秒：用 localStorage 补状态，看着解决了刷新，实际上把「可分享」和「多标签页」一起牺牲了，而且它会和第 6 周的内容缓存撞车。
:::

#### 步骤 5.3 useSearchParams 的正确姿势

现象：本地 `npm run dev` 一切正常，`npm run build` 报错。

```text
Error: useSearchParams() should be wrapped in a suspense boundary at page "/tools".
Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
```

原因是预渲染：静态页在构建期就把 HTML 生成好，那时不存在「查询参数」这件事。`useSearchParams` 会让最近的 Suspense 边界之内的子树变成客户端渲染，所以你必须给它一个边界，告诉框架「这块先渲染 fallback」。开发模式是按需渲染的，不会触发这条规则——这就是「本地好好的、上线挂了」的典型。

```tsx
// src/app/(home)/tools/page.tsx（现有壳，只补一个边界）
import { Suspense } from "react"
import HomeApp from "@home/App"

export default function ToolsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-400">加载工具列表…</p>}>
      <HomeApp />
    </Suspense>
  )
}
```

如果想让首屏 HTML 里就带着筛选结果，就得在服务端先读到参数再传进去——`searchParams` 在本项目的 Next 16 里是 Promise，必须 `await`：

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams
  // 注意：这要求 ToolsTab 的 props 契约里加 initialCat，不是白拿的
  return <ToolsTab initialCat={cat ?? "all"} />
}
```

两个补充事实：`layout.tsx` **拿不到** `searchParams`（共享布局在导航时不重新渲染，给了就是旧值），要读只能在 page 里读，或者用客户端 hook；服务端读到再当 props 传下去，省掉一层客户端渲染，代价是这页从静态变成动态——这笔账按「这页要不要被索引正文」来算。另外，React 19 里 `<Suspense>` 的 fallback 会在服务端就输出，所以 fallback 不能碰 `window`。

:::hint 静态页 + 查询参数 = 必须 Suspense
预渲染时读不到查询参数，Next 会要求边界；不加就会在 `next build` 时报错，或者整页退化成动态渲染。
:::

:::solution 三种读法对照
```text
服务端 page 的 searchParams（await）   首屏就有值、可参与 SSR 输出；页面变动态
客户端 useSearchParams()               能订阅变化；需 Suspense，子树变客户端渲染
挂载时读 window.location.search        零依赖、无边界；只读一次，不订阅变化
```
本项目三种都在用：工具深链用第三种（只读一次就够）、筛选类交互该用第二种（要跟着变）、`/learn/<code>` 干脆走路径段（不涉及参数）。选错的表现各不相同：选了第一种却忘了页面会变动态，选了第三种却发现值不跟着变。
:::

:::error 构建期与运行期的两个典型报错
```text
Error: useSearchParams() should be wrapped in a suspense boundary at page "/xxx".
```
↓ 用 `<Suspense>` 包住**使用它的那棵子树**，而不是包住整个 page 的返回值——边界必须在 hook 的祖先上，包在外面等于没包。也别用 `export const dynamic = "force-dynamic"` 来「修」它：那样确实不报错了，但你把整页改成动态渲染，第 3 周量出来的静态首屏优势一起没了。

```text
Error: Hydration failed because the server rendered HTML didn't match the client.
```
↓ 首帧不一致：`Date.now()`、`Math.random()`、`localStorage`、`window.innerWidth` 被直接写进渲染。修法是挪进 `useEffect`——首帧渲染同一个默认值，挂载后再更新；而不是加 `suppressHydrationWarning` 把警告按掉，警告没了，界面还是会闪一下。
:::

#### 步骤 5.4 replace 还是 push：后退键该回到哪

现象：筛选用了 `router.replace`，点两次分类，再按浏览器后退——直接退出站点，回到来之前那个页面，而不是「上一个筛选」。如果验收清单写的是「后退一次回到上一个筛选组合」，它永远不可能通过。

原因很简单：`replace` 替换当前历史条目，不新增。而项目的 `useHomeRoute` 里 `goTab` / `goCat` / `goTrack` **全部**用 `replace`（`src/features/home/lib/hooks.ts`），这是刻意的：外壳有 6 个 tab、4 个分类、每门语言一个详情，每次点击都 push 的话，用户要按二十次后退才能真正离开——后退键就变成了「在应用里倒着走」。

判据一句话：**同一屏的视图细化用 replace，进入新的一屏用 push**。而且无论选哪个，都要有显式返回控件（项目里是「← 全部语言」「← 全部工具」），别把「怎么回去」完全押在浏览器按钮上。

```ts
// 视图细化：替换当前条目，后退仍然是「离开本页」
router.replace(`/tools?${qs}`, { scroll: false })

// 进入详情：压一条历史，后退回到列表
router.push(`/learn/${code}`)

// 详情里的显式返回：有站内历史就退一步，否则兜底回列表
function backToList() {
  if (window.history.length > 1) router.back()
  else router.replace("/learn")
}
```

`history.length` 只是粗略判据：在新标签页里直接打开深链时它通常是 1，但从站内别的页面点进来时大于 1——后者 `back()` 会回到那一页，一般正是用户期望。真正的边界只有「全新标签页 + 直接粘贴」，所以验收时两种入口各试一次，别只试一种就下结论。

:::hint 后退键是用户的撤销
它撤销的是「我上一步做了什么」，不是「这个应用的层级是什么」。想清楚用户按后退时希望看到什么，答案就唯一了。
:::

:::solution 决策表 + 实测记录
```text
动作                        用哪个     后退一次到哪
切 tab / 切分类 / 翻页       replace   离开本页（回到外部来源）
打开某门语言 / 某个工具      push      回到列表
点详情里的返回按钮           back()    回到列表
```
实测记三行：连续两次 `replace` 后 `history.length` 有没有变；两次 `push` 后后退两次分别落在哪；新标签页直接打开 `/learn/java` 再点返回按钮，落点对不对。
:::

**自测**（合上文档回答）

1. 写筛选时为什么用 `new URLSearchParams(sp.toString())`，而不是 `new URLSearchParams()`？
2. 什么状态该进路径段、什么该进查询参数？各举本周项目里的一个例子。
3. 用 `replace` 改筛选之后，浏览器后退会发生什么？项目为什么仍然选 `replace`？

**验收**

- [ ] 任意 `?cat=` / `?page=` 组合刷新后保持，默认值不出现在地址栏
- [ ] 详情链接能被复制、能在新标签页直接打开，并落在同一条上
- [ ] 手改一个不存在的 `?id=`，看到明确提示而不是静默回列表
- [ ] `npm run build` 通过，没有 missing suspense 报错
- [ ] 后退行为符合 5.4 的决策表，笔记里写下实测的三行记录

---

### 第 6 周：公开数据与缓存

**本周目标**：让 `/learn` 的公开内容做到「B 端改完立刻生效」且「重复访问不全量下载」——用 `curl` 能看到 200 与 304 两种响应，同时切 tab 不重复请求；再给 500 和 404 各一个自己的页面。

**为什么是这些内容**：公开数据在这一周有两条约束同时成立。B 端改完，C 端必须立刻看到——`LearningContentController` 的注释管这叫「编辑即公开」；而同一份内容 170KB 上下，不能让每个访客每次都全量拖一遍。这两条互相打架：长缓存解决后一条，破坏前一条。解法在 HTTP 里现成：`Cache-Control: no-cache` 加 `ETag`。可只靠浏览器缓存不够——上周把筛选搬进 URL 之后，每点一次分类都是一次新渲染，如果每次都回源，用户切三次分类就等三次。所以还需要第二层：进程内的内存缓存，以及它必须回答的三个问题（多久算旧、谁失效、失效失败怎么办）。最后一步是这两层的兜底：缓存再准接口也会 500，URL 再对用户也会手打错路径。第 7 周会把错误页做成键盘可达、第 9 周用 Profiler 证明缓存到底省了什么；本周要求的是**每条缓存都能说出失效时机**，而不是「加了缓存所以快了」。

#### 步骤 6.1 读懂公开接口的缓存语义

先把三个词分清，混一次就写出「改完线上不变」的 bug：

```text
no-store          完全不存。每次都是全量，170KB 一次，一分不少。
max-age=600       十分钟内不回源。内容改了，用户最多十分钟后才看到。
no-cache          允许存，但每次用之前必须回源确认：
                  没变 → 304，无响应体（省流量）
                  变了 → 200 + 新内容（立刻生效）
```

线上那个端点用的就是第三种，而且 ETag 是**响应体算 SHA-256 取前 8 个字节的十六进制**，不是 `hashCode()`：后者碰撞太容易，一旦撞上，一个已经更新过的内容会被判成「没变」，用户会永远看到旧课程。这条注释在 `LearningContentController#etagOf` 里，值得读一遍——它顺手解释了为什么不用 `ShallowEtagHeaderFilter`：那个过滤器要把响应体整份缓存在内存里，而这个站还有 SSE 长连接。

```bash
# ① 看响应头：状态码、ETag、Cache-Control
curl -s -o /dev/null -D - https://haolo.cloud/api/learning/public \
  | grep -iE 'HTTP/|etag:|cache-control:'

# ② 带上 ETag 再请求一次：期望 304，且响应体为 0 字节
ETAG=$(curl -s -o /dev/null -D - https://haolo.cloud/api/learning/public \
  | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r')
curl -s -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\n' \
  -H "If-None-Match: $ETAG" https://haolo.cloud/api/learning/public

# ③ 反证：随便编一个 ETag，必须回到 200 + 全量
curl -s -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\n' \
  -H 'If-None-Match: "not-the-real-one"' https://haolo.cloud/api/learning/public
```

`tr -d '\r'` 不是多余动作：在 Windows 的 Git Bash 里，`curl` 写进管道的头行带 `\r`，抓出来的 ETag 尾部会多一个回车，于是 ② 永远拿到 200——你会以为服务端没在比对，其实是自己传错了值。这类「工具把值弄脏」的坑比协议本身更常见。

还有一个反直觉的事实要在 DevTools 里确认：**你在 JS 里看不到 304**。浏览器把 304 与本地副本合成为一次 200 交给 `fetch`，所以 `r.ok` 是 `true`、`r.json()` 正常返回；只有 Network 面板的 Status 列会写 `304`，Size 列显示来自缓存。

:::hint no-cache 不是 no-store
`no-cache` 是「可以存，但用之前必须问服务端」；`no-store` 是「完全不存」。前者能让内容改完立刻生效，又不重复下载全量——这是 C 端公开内容最合适的策略。
:::

:::solution 三种策略的现象对照
```text
策略                   改完多久生效      每次传输         适用
no-store              立即              ~170KB          带敏感信息、绝不能旧
no-cache + ETag       立即              304 时 0 字节    公开内容（本项目）
max-age=600           最长 10 分钟      10 分钟内 0      允许十分陈旧的数据
```
判断时只问一句：这份数据「旧」的代价大，还是「每次都传」的代价大。公开课程内容两边都不大，所以取中间那条。
:::

#### 步骤 6.2 客户端缓存与失效

HTTP 缓存解决了「刷新页面」，解决不了「同一会话里切来切去」。`src/features/home/lib/learn.ts` 已经有一版内存缓存：模块级 `memo`、`inflight` 并发去重、`peekDoc()` 先渲染旧内容再后台拉新；拉取失败时**不覆盖**缓存，只把 `stale` 置 true。这是 stale-while-revalidate 的手写版。

它缺的只有一样：TTL。现在 `peekDoc()` 只要有内容就永远命中，等于「这个会话里再也不刷新」。加时间戳之前，先回答三个问题——这是本周唯一的判断题，答不上就别加缓存：

```text
1. 多久算旧？        TTL 定多少，依据是什么（数据多久变一次 / 用户能容忍多久）
2. 谁负责失效？      写入方主动清？靠 TTL 自然过期？还是每次回源比对？
3. 失效失败会怎样？  拿不到新的，是白屏、还是继续显示旧的并标注「可能不是最新」
```

```ts
// src/features/home/lib/learn.ts（改造示意：在现有 memo 上加时间戳）
const TTL = 30_000
let memo: { doc: LearningDoc; at: number } | null = null
let inflight: Promise<LearningDoc> | null = null

/** 新鲜的缓存（过期就当没有，但对象仍留着给失败兜底） */
export function peekFresh(now: number): LearningDoc | null {
  return memo && now - memo.at < TTL ? memo.doc : null
}

export function fetchDoc(): Promise<LearningDoc> {
  if (inflight) return inflight                     // 并发去重：App 取角标与学习页会各调一次
  inflight = apiJson<LearningDoc>(API)
    .then((doc) => {
      memo = { doc, at: Date.now() }                // 只有成功才写缓存
      return doc
    })
    .finally(() => { inflight = null })
  return inflight
}

/** 失败时的兜底：过期也照给，调用方负责显示 stale 标记 */
export function staleDoc(): LearningDoc | null {
  return memo?.doc ?? null
}
```

四处关键：`if (inflight) return inflight` 挡的不是「重复渲染」而是「两个组件在同一帧挂载」——本项目的 `App` 取角标、`LearnTab` 取正文，没有这行就是两次 170KB；只有 `.then` 里写 `memo`、失败路径不写，否则一次 500 会让坏数据活满 30 秒；`peekFresh(now)` 把 `Date.now()` 做成参数，测试里就不用等真实时间；`staleDoc()` 与 `peekFresh()` 分开，是让「有旧数据」和「旧数据还新鲜」变成两件可以分别判断的事。改完记得把调用方接上：`useLearning` 的 effect 里要先 `peekFresh(Date.now())`，**只有它落空时才 `fetchDoc()`**，否则每次切 tab 照样回源，TTL 等于白写。

还有一个必须避开的坑：**`Date.now()` 不要出现在渲染期**。`useState(() => peekFresh(Date.now()))` 在服务端和客户端会拿到不同的时间，桶边界上一刷新就 hydration 不一致——这正是 5.3 那条报错的另一个来源。读时间放在 `useEffect` 里。

:::hint 缓存先答三个问题
多久算旧？谁负责失效？失效失败会怎样？答不上就别加。加错的缓存比没有缓存更难查：它会把「接口慢」变成「内容不对」。
:::

:::solution 失效矩阵
```text
数据变化来源              谁失效                    用户看到
B 端保存后（编辑即公开）    TTL 到期 / 手动刷新        最迟 30s 后是新内容
用户点「重试」             clearCache() + reload      立刻重新请求
接口 500 / 离线            不失效（保留 memo）        旧内容 + 「内容可能不是最新」
首次进入（无缓存）          —                          骨架 → 内容 / 错误态
```
第三行是重点：**失败不销毁缓存**。把 `memo` 置空的写法会让一次网络抖动直接把用户已经看到的内容换成错误页，那比显示旧数据糟得多。
:::

#### 步骤 6.3 错误边界与降级

前两步都在赌「请求会成功」。这一步处理赌输的时候。C 端目前没有 `src/app/error.tsx`，只有一个 `src/app/f/[slug]/not-found.tsx`——所以线上真抛异常时，匿名访客看到的是框架默认页：`Application error: a client-side exception has occurred`。他会关掉，不会截图发给你。

加两个文件就够，但有三条边界必须知道，否则你会以为「加了但没用」：

```tsx
// src/app/error.tsx —— 必须是客户端组件，必须是 default export
"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">页面出错了</h1>
      {/* 服务端渲染期抛的错，生产构建会把 message 换成通用文案，digest 才是能对上日志的线索 */}
      <p className="text-sm text-zinc-500">
        {error.message || "未知错误"}
        {error.digest ? `（${error.digest}）` : ""}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] rounded-lg bg-zinc-900 px-4 text-sm text-white"
        >
          重试
        </button>
        <a href="/" className="inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm">
          回首页
        </a>
      </div>
    </main>
  )
}
```

```tsx
// src/app/not-found.tsx —— 404 也要有出口，别让用户只剩后退键
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-lg font-semibold">没有这个页面</h1>
      <p className="mt-2 text-sm text-zinc-500">链接可能过期了，或者地址被截断了一半。</p>
      <a href="/" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm">
        回首页
      </a>
    </main>
  )
}
```

三条边界：① `reset()` 只是让 React 重渲染这段子树，**不会重新发请求**——如果出错原因是那次请求，用户点了「重试」还是同一份错误数据，所以真要重试得同时调 `location.reload()` 或缓存层的 `reload`；② 错误边界只捕获**渲染期**的异常，事件处理器里 `throw` 不会进去（那里必须自己 `try/catch`，这也是第 7 周乐观更新要用的东西）；③ 它捕获不了 root layout 自身的异常——那需要 `global-error.tsx`，而那个文件要自己渲染 `<html>` 和 `<body>`，写错了会连错误页都白屏。

顺带澄清一个 React 19 的事实：错误边界到现在也没有函数组件版（没有 `useErrorBoundary` 这类 hook），要么用 Next 的 `error.tsx` 约定，要么自己写 class 组件加 `getDerivedStateFromError`。看到别人在函数组件里写 `try { return <X /> } catch` 不要照抄——JSX 的渲染不发生在那个 `try` 里。

:::hint 错误边界是 C 端的面子
匿名用户撞上 500，看到的是 Next 的默认报错页——直接关掉。一个「出错了，回首页」的页面，能把人留下来。
:::

:::solution 三条验证路径（都要亲手走一遍）
```text
① 渲染期抛错     在某个组件里 if (true) throw new Error("boom")
                  → 看到自己的「页面出错了」；dev 下还有错误浮层，生产没有
② 不存在的路径   访问 /tools/does-not-exist
                  → 看到「没有这个页面」，而不是框架默认 404
③ 事件里抛错     onClick={() => { throw new Error("boom") }}
                  → 错误页**不出现**（边界管不到事件），控制台红字
```
② 要确认它真的走了你写的文件：临时把标题改成「没有这个页面 X」，刷新能看到 X 才算生效。
:::

:::error 加了 error.tsx 仍然看到默认报错页
```text
Application error: a client-side exception has occurred (see the browser console for more information).
```

三种原因，按命中率排：① 错误发生在 `error.tsx` **之外**——它只包住同层的 page 与子段，root layout 里抛的错归 `global-error.tsx` 管；② 错误是**事件处理器**里抛的，边界从不经过那里，必须 `try/catch` 后自己 `setState` 成错误态；③ 文件位置或导出不对——必须是 `app/error.tsx`（或某个段下的 `error.tsx`）、必须 `"use client"`、必须是 `default export` 且接收 `{ error, reset }`。判据很简单：在组件里 `console.log("boundary mounted")`，页面出错时这行**有没有打出来**——没打出来就是压根没挂上。
:::

**自测**（合上文档回答）

1. `no-store`、`no-cache + ETag`、`max-age=600` 三者，在「改完多久生效」和「省不省流量」上分别是什么结果？
2. 请求失败时为什么不能把内存缓存清空？清空之后用户会看到什么？
3. 加了 `src/app/error.tsx` 之后，哪两类错误仍然进不去？各自该在哪处理？

**验收**

- [ ] `curl` 第一次拿到 200 与 `ETag`、`Cache-Control: no-cache`；带同一个 ETag 再请求得到 304
- [ ] 故意传错 ETag 时回到 200 且响应体非 0，证明比对真的在发生
- [ ] 首次进入 `/learn`，Network 里只有一条 `/api/learning/public`（App 角标与正文共用一次请求）
- [ ] TTL 内切走再切回，没有新请求；等 TTL 过期再切回，出现一条 304（大小 0，内容仍是新的）
- [ ] 刷新页面看到 304，但内容仍是最新（DevTools 的 Status 列写 304，不是你在 JS 里读到 304）
- [ ] 组件里 `throw new Error("boom")` 时看到自己的错误页；点「重试」后能恢复
- [ ] 访问不存在的路径看到自己的 404 页，且临时改标题后刷新能看到改动

---

## 阶段四 · 可访问性、SEO 与交付（第 7–8 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 |
| 这一阶段解决 | 从「做完了」到「能被搜到、能被键盘用、敢发布」 |
| 核心知识 | 语义与键盘、sitemap/robots、第三方脚本策略、构建产物、发布与回滚 |
| 场景项目 | 场景 #3：评论与互动（乐观更新 + 失败回滚 + 降级） |
| 离开时应该能 | 走一次完整发布并回滚；说出自己页面的首屏 JS 大小 |

### 第 7 周：可访问性与 SEO

**本周目标**：不碰鼠标，只用 Tab / Enter 从地址栏走到 `/learn` 的语言卡片并打开详情，全程看得见焦点、且 Tab 不会掉进屏幕外关闭着的抽屉；`curl` 能拿到 `/sitemap.xml` 与 `/robots.txt`，sitemap 里只有匿名可见的页面；首屏资源里没有任何 `renderBlockingStatus: "blocking"` 的脚本。

**为什么是这些内容**：前六周的评价者一直是你自己——能打开、能分享、失败不白屏。这一周换三个人来验收：键盘用户、读屏软件、搜索引擎。C 端与 B 端的差别在这里最刺眼：B 端用户是登录后的管理员，页面难用他会重试、会问你；C 端是匿名访客，Tab 三次看不见焦点就关掉，搜索结果里出现的是登录页就再也不会点第二次。三件事还互相咬合：sitemap 决定哪些页值得被索引，robots 决定哪些页不要进索引，a11y 决定进了页面能不能用；而第三方脚本决定这一页多快开始能用——第 3 周量的 LCP、第 9 周要量的 INP，都会被一个同步脚本一起拖坏。第 8 周要把页面发上线，本周产出的就是发布前那张检查表。

#### 步骤 7.1 语义化与键盘

一个控件要让键盘和读屏都能用，需要四样东西：**能聚焦**、**有角色**、**有名字**、**有状态**。原生 `<button>` 一次给全；`<div onClick>` 一样没有——它不在 Tab 序列里，没有 `role`，读屏念不出它是按钮，空格键也不触发。这不是「写得不够规范」，是功能缺失。

先读已经做对的部分，省得白改：`TabLayout.tsx` 里侧栏项是 `<button type="button">`，当前页用 `aria-current="page"`，徽标走 `aria-label`（「项目，6 项」）并把数字本身标成 `aria-hidden`，图标也是 `aria-hidden`；`global.css` 里有全局 `:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px }`。这些别动。

真正的洞有两个，都能在 375px 下复现。

① **关着的抽屉仍可聚焦**。`TabLayout.module.css` 的 860px 断点把侧栏改成 `position: fixed; transform: translateX(-102%)`。`transform` 只改画在哪，不改在不在可聚焦树里。于是窄屏下几十个侧栏按钮排在正文之前，你按 Tab，焦点一次次跑到屏幕左侧外面——屏幕上什么都没发生，你以为键盘坏了。

② **没有 skip link**。`<main>` 在 TabLayout 里，但从地址栏进来要先 Tab 过整个侧栏（8 个顶层项 + 4 个分类 + 联系方式）才到正文。

先量，别猜。`focusin` 在焦点**已经移动之后**触发，正好能报出落点坐标：

```js
// 375px 宽、抽屉关闭时，在控制台挂上，然后连续按 Tab
addEventListener('focusin', (e) => {
  const r = e.target.getBoundingClientRect()
  console.log(r.left < 0 ? '⚠ 屏幕外' : 'ok',
    Math.round(r.left), Math.round(r.width),
    (e.target.textContent || '').trim().slice(0, 12))
})
```

修好之前，前十几个 Tab 会连续打印「⚠ 屏幕外」；修好之后第一个落点是 skip link，紧接着直接进正文。

最小修复是纯 CSS：`visibility: hidden` 会把元素从可聚焦树里摘掉（`opacity: 0` 和 `translateX` 都不会）。代价是它会把滑出动画一起掐断，所以要把 `visibility` 也写进 transition，用 0 秒延迟让它「收起时最后消失、展开时立刻可见」：

```css
/* TabLayout.module.css，@media (max-width: 860px) 内 */
.sidebar {
  visibility: hidden;
  transform: translateX(-102%);
  transition: transform 0.28s var(--ease), visibility 0s linear 0.28s;
}
.sidebarOpen {
  visibility: visible;
  transform: none;
  transition: transform 0.28s var(--ease), visibility 0s;
}
```

更彻底的工具是 `inert`：它同时摘掉焦点、指针事件和可访问性树。但它不能无条件用——桌面宽度下侧栏必须可操作，而 CSS 断点与 DOM 可聚焦性是两套系统，`inert={!drawerOpen}` 会在桌面上把导航整个禁用。要上 `inert` 就得先用 `matchMedia('(max-width: 860px)')` 在 JS 里判断视口，并接受首帧与挂载后一帧的差异。本周的判据是：能用 CSS 表达的就别用 JS，`visibility` 够用。

skip link 是五行事，收益很大：

```tsx
// TabLayout.tsx：顶部加跳转，main 加 id 与 tabIndex
<a href="#main" className={styles.skip}>跳到主内容</a>
...
<main id="main" tabIndex={-1} className={styles.content} key={current?.id}>
```
```css
/* TabLayout.module.css */
.skip { position: absolute; left: -9999px; }
.skip:focus {
  left: 1rem; top: 1rem; z-index: 60;
  padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  background: var(--accent); color: #fff;
}
```

`tabIndex={-1}` 不是多余：`<main>` 默认不可聚焦，点了 skip link 浏览器只会滚动、不移动焦点，下一次 Tab 还是从原处继续。`-1` 让它能接收程序化焦点，又不进 Tab 序列。`.skip` 用 `left: -9999px` 而不是 `display: none`（后者不可聚焦，等于没写）；用 `:focus` 而不是 `:focus-visible`——skip link 只在键盘路径上有意义，用 `:focus` 更直白。

:::hint 看不见不等于不能聚焦
`transform`、`opacity`、`z-index` 都不影响可聚焦性。判断一个元素会不会被 Tab 到，只看它是否 `visibility: hidden` / `display: none` / `inert` / `disabled`。
:::

:::solution 验收两条路径
```text
1. 375px + 抽屉关闭 + 连续 Tab：focusin 日志不再出现「⚠ 屏幕外」，
   第一个落点是「跳到主内容」，回车后焦点进正文，再 Tab 不再回侧栏
2. 375px + 打开抽屉：Tab 在抽屉内正常走；Esc 关闭后焦点回到汉堡按钮
```
第 2 条后半句现在还没实现：现有 Esc 监听只 `setDrawerOpen(false)`，焦点留在被卸载的关闭按钮上，浏览器会把它丢回 `body`。补一行 `burgerRef.current?.focus()`——「关闭浮层后焦点还给触发者」是固定动作，别省。
:::

#### 步骤 7.2 sitemap 与 robots

先确认基线：`src/app/` 根目录下没有 `sitemap.ts` / `robots.ts`（只有 `layout.tsx`、`globals.css`、`icon.svg` 和几个路由目录），所以这两个地址今天是 404：

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://haolo.cloud/sitemap.xml   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://haolo.cloud/robots.txt    # 404
```

Next 的约定是「目录即路径」：`src/app/sitemap.ts` 生成 `/sitemap.xml`，`src/app/robots.ts` 生成 `/robots.txt`。`(home)` 这类路由分组不进 URL，放在 `(home)/sitemap.ts` 仍然是 `/sitemap.xml`；但放进 `learn/` 下就变成 `/learn/sitemap.xml`，爬虫不会去看。

三件事必须想清楚再写。

**① 列哪些页**。只列匿名可见且内容稳定的：`/`、`/posts`、`/learn`、`/tools` 与四个分类、`/games`。`/learn/<code>` 不列：语言清单来自 `/api/learning/public`，B 端改完即时生效，构建期枚举会变成一份会过期的副本——`learn/[code]/page.tsx` 的注释已经为同一件事解释过一次。要收录就得接受动态 sitemap（`export const dynamic = "force-dynamic"`），代价是每只爬虫来访都打一次后端。本周的选择是先不收录，把它写进「已知缺口」。

**② `lastModified` 写什么**。默认想写 `new Date()`，但静态生成的 sitemap 会把**构建那一刻**写进去：你改一个错别字部署一次，全站 URL 的时间一起变，爬虫很快学会忽略这个字段。写一个「内容最近一次实质变动」的固定日期更有信息量。

**③ robots 不是访问控制**。`Disallow` 只是「请别抓」，不阻止任何人访问；被外链的页面仍可能进结果（无摘要）。真正的「不进索引」是页面 metadata 里的 `robots: { index: false }`。两件一起用才对：robots 省抓取预算，`noindex` 保结果页干净。

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next"
import { CATEGORIES } from "@home/data/tools"

const BASE = "https://haolo.cloud"
const LAST = new Date("2026-10-01T00:00:00Z")

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ["/", "/posts", "/learn", "/tools", "/games"]
  // 分类从 CATEGORIES 派生：加一个分类，sitemap 自动跟上，不手抄
  const cats = CATEGORIES.filter((c) => c.id !== "all").map((c) => `/tools/${c.id}`)
  return [...fixed, ...cats].map((p) => ({
    url: BASE + p,
    lastModified: LAST,
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1 : 0.7,
  }))
}
```
```ts
// src/app/robots.ts
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /me 与登录页不该出现在结果里；/play/* 要登录，抓到的只是空壳
        disallow: ["/me", "/login", "/register", "/play/"],
      },
    ],
    sitemap: "https://haolo.cloud/sitemap.xml",
  }
}
```

验证不能靠「文件存在」，要靠 HTTP：

```bash
cd notelab-c && npm run dev
curl -s localhost:3000/robots.txt                       # 应看到 Disallow: /me
curl -s localhost:3000/sitemap.xml | grep -o '<url>' | wc -l   # 应等于 5 + 分类数
curl -s localhost:3000/sitemap.xml | grep -E '/me|/login' || echo '干净'
```

`grep -o` 再 `wc -l` 是最省事的计数（`grep -c` 数的是「行」，sitemap 被压成一行时会得到 1）：条数对不上，要么 `CATEGORIES` 里混进了 `all`，要么过滤条件写反了。

:::hint sitemap 是构建产物
改完 `sitemap.ts` 不重新构建就部署，线上还是旧的（甚至 404）。「本地 dev 能看到」不等于「线上有」——验完本地必须走一次第 8 周的发布。
:::

:::solution 本仓的三个判断
```text
1. 放 src/app/ 根，不放 learn/ —— 后者会变成 /learn/sitemap.xml，没人会去抓
2. 不列 /learn/<code>：数据来自接口，构建期枚举必然过期；要列就改成动态 sitemap
3. robots 与 noindex 分工：robots 省抓取预算，noindex 才真的不进结果页
```
:::

#### 步骤 7.3 第三方脚本不阻塞首屏

本仓的埋点是自研的：`packages/shared/ui/TrackPageView.tsx` 挂在根 layout，`initTrack()` / `autoPageView()` 走同域接口，没有外链脚本。所以今天首屏没有被第三方拖住——但统计 SDK、客服窗口、A/B 分流迟早会来，差别只有一行：它怎么加载。

`next/script` 的 `strategy` 是这张表的核心：

| strategy | 什么时候执行 | 适合 |
|---|---|---|
| `beforeInteractive` | 水合之前注入 `<head>` | 必须最先就位的（polyfill、同意管理） |
| `afterInteractive` | 水合之后（默认） | 统计、埋点——**绝大多数第三方脚本该用它** |
| `lazyOnload` | 浏览器空闲时 | 客服挂件、非关键 SDK |
| `worker` | Partytown 里跑（实验性） | 想把第三方彻底挪出主线程 |

React 19 还允许在任意位置写 `<script async src=... />`，React 会把它提升到 `<head>` 并去重；但它不给顺序、不给 `onLoad` 时机，需要「加载完再初始化」时还是用 `next/script`。

怎么证明它真的不阻塞？别用肉眼，用两条标准：脚本开始的时刻是否晚于 FCP，以及浏览器标的 `renderBlockingStatus`（Chrome 107+ 才有；Firefox 没这个字段，就退回比 FCP）。

先做一个最小复现：写一个纯占主线程 300ms 的脚本，放在 `<body>` 第一个子节点——解析器读到这行就会停下来，这就是「同步脚本」的全部含义。

```js
// notelab-c/public/demo-block.js —— 只为量差值，量完删掉
const t0 = performance.now()
while (performance.now() - t0 < 300) {}   // 300ms 纯占主线程
```
```tsx
// src/app/layout.tsx 的 <body> 里，临时试两种写法
<body className="antialiased">
  <script src="/demo-block.js" />                          {/* ① 解析阻塞 */}
  {/* <Script src="/demo-block.js" strategy="afterInteractive" />   ② 水合后 */}
  {children}
```

每次改完刷新，在控制台读 FCP 与脚本的渲染阻塞状态：

```js
const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime
const scripts = performance.getEntriesByType('resource')
  .filter((e) => e.initiatorType === 'script')
  .map((e) => ({
    path: new URL(e.name).pathname,
    start: Math.round(e.startTime),
    blocking: e.renderBlockingStatus ?? 'n/a',
  }))
console.table(scripts)
console.log('FCP', Math.round(fcp), 'ms')
```

读法：① 写法下 `/demo-block.js` 的 `start` 早于 FCP、`blocking` 是 `blocking`；换成 ② 之后 `start` 晚于 FCP、`blocking` 变 `non-blocking`，FCP 向左移动约 300ms。绝对值随机器变，**差值才是证据**（量级示例：900ms → 600ms）。两个数字都记下来，这才叫改前改后对照。

最后一个坑在初始化：第三方 SDK 是异步来的，别在模块顶层假定 `window.xxx` 已经存在。用 `onLoad` 或在 `useEffect` 里等，别写 `const sdk = window.__sdk` 然后祈祷。

:::hint 同步脚本拖的是「开始可用」
用户不关心几时下载完，只关心几时能点。一个 200KB 的同步脚本能把这时间推后半秒以上，而它在瀑布图里排在 FCP 之前——那就是抢首屏的证据。
:::

:::solution 三步收尾
```text
1. 删掉 public/demo-block.js 与 layout 里的临时引用，git status --short 必须干净
2. 以后加真脚本：<Script src=... strategy="afterInteractive" onLoad={init} />
3. 发布后再测一次：console.table 里不该出现 blocking
```
:::

:::error 两个把「修过了」变成「还是坏的」的报错
```text
Warning: Received `false` for a non-boolean attribute `inert`. If you want to write it to the DOM,
pass a string instead: inert="false" or inert={value.toString()}.
```
根因：React 18 及更早把 `inert` 当普通 DOM 属性，`inert={false}` 会渲染成 `inert="false"`——只要属性存在，元素就是 inert，于是抽屉打开也点不动。React 18 里要写成 `inert={cond ? '' : undefined}`；本仓是 React 19.2，布尔直传才对。看到这条警告先 `npm ls react` 确认版本，别急着改成字符串——那是把 bug 藏起来。

```text
RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
```
根因：`lastModified: new Date("2026-13-01")` 这类写错的日期字面量得到 `Invalid Date`，序列化时抛错，`next build` 直接失败；类型检查看不出来，因为 `Invalid Date` 也是 `Date`。写成 `new Date("2026-10-01T00:00:00Z")`，并在 `sitemap()` 里先 `Number.isNaN(d.getTime())` 兜一层。
:::

**自测**（合上文档回答）

1. 关闭的抽屉只是 `translateX(-102%)`，为什么仍能被 Tab 到？除了 `visibility: hidden`，还有哪两种方式能让它退出可聚焦树？
2. `lastModified: new Date()` 为什么反而让 sitemap 贬值？`robots.txt` 与页面 `noindex` 各自解决什么问题？
3. 把 `<script>` 放在 `<body>` 第一行，与 `strategy="afterInteractive"` 相比，用哪两个可观测值能证明差别？

**验收**

- [ ] 375px 下连续 Tab，`focusin` 不再打印「⚠ 屏幕外」，第一个落点是「跳到主内容」，回车后焦点进正文
- [ ] 键盘走完侧栏时 `:focus-visible` 的 outline 在浅色与深色主题下都看得见（`global.css` 的 `--accent`）
- [ ] `curl -s localhost:3000/sitemap.xml | grep -o '<url>' | wc -l` 等于 5 + 分类数，且不含 `/me`、`/login`、`/learn/<code>`
- [ ] `curl -s localhost:3000/robots.txt` 里有 `Sitemap:` 与四条 Disallow
- [ ] 临时同步脚本的 `renderBlockingStatus` 是 `blocking`，换 `afterInteractive` 后变 `non-blocking`，FCP 前移约 300ms
- [ ] `git status --short` 里没有 `demo-block.js` 残留

---

### 第 8 周：交付与毕业项目

**本周目标**：跑一次 `npm run build`，说出 `/`、`/tools/[cat]`、`/learn/[code]` 各是静态还是动态、以及 `/` 的 First Load JS 是多少 kB；把新页 `/roadmap` 发布到 haolo.cloud 并用 `curl` 读到它的 `<title>`；再用一次 `git revert` 把它回滚成 404，两次都留下日志。

**为什么是这些内容**：第 7 周把页面做到能被找到、能被键盘用；这一周把它送上线，并且保证送得出去、退得回来。C 端的交付比 B 端多三层约束：构建产物就是线上产物，重启之后没有灰度和回退按钮，唯一的安全网是「构建失败不重启」和「revert 一次」；首屏 JS 是用户付的流量费，构建输出里那列 First Load JS 是发布前唯一能看到的预算数字；你的改动还要过一道架构门禁才能上线。不学会的后果很具体：首屏 JS 从 200kB 涨到 500kB，你在手机上却觉得「还行」，因为你量的是缓存过的第二次访问；或者线上还是旧版，你怀疑 CDN，实际是构建失败、老进程还在服务。第 9 周要诊断「为什么慢」，前提是这一周先拿到发布前的基线。

#### 步骤 8.1 看懂构建产物

`npm run build` 会打印一张路由表，每个路由前面一个符号：`○` 静态预渲染、`●` 用 `generateStaticParams` 预生成的静态页、`ƒ` 请求时服务端渲染。图例在输出末尾，Next 每个大版本会调符号，**以你终端最后那几行为准**，别背。

读这张表的方法是**先预测再对照**。按本仓的代码，你应该能推出：

- `/`、`/posts`、`/learn`、`/tools`、`/knowledge` 都渲染同一个 `HomeApp`，页面本身不带动态 API → `○`；
- `/tools/[cat]` 有 `generateStaticParams`（分类 + 内嵌工具 slug）→ `●`；
- `/learn/[code]` 没有 `generateStaticParams`，且 `page.tsx` 的注释明确拒绝构建期枚举 → `ƒ`；
- `/me`、`/login` 是 `"use client"` 页面，但整棵树在构建期就能渲染成 HTML → 仍是 `○`。

对照之后符号不对，就是排查线索：父级 layout 调了 `cookies()` / `headers()`，整棵子树都会变 `ƒ`；页面里写了 `export const dynamic = "force-dynamic"`；或者 `useSearchParams` 没包 `<Suspense>`，构建期直接报错。

然后是首屏 JS。那列数字是「进入该路由要下载的 JS 传递闭包」，和磁盘上单个文件不是同一口径，只适合做前后对比，别拿去和 4G 带宽算账。想知道是哪个文件变大了，按体积排一下：

```bash
node -e "const fs=require('fs'),p=require('path');const d='.next/static/chunks';console.table(fs.readdirSync(d).filter(f=>f.endsWith('.js')).map(f=>({f,kb:+(fs.statSync(p.join(d,f)).size/1024).toFixed(1)})).sort((a,b)=>b.kb-a.kb).slice(0,8))"
```

本仓有一个现成的反例值得读三遍：`tools/registry.tsx` 是**静态** import 的，而它被 `App.tsx` 引用，`App.tsx` 又被 `/`、`/posts`、`/tools/*` 共用。所以任何一个工具只要静态 import 了大依赖，那个依赖就会灌进首页 chunk。3D 建模台的 `ModelerTool.tsx` 因此在最外层套了一个 `next/dynamic`（`ssr: false`）薄壳，真正的 `ModelerApp` 才 import three，注释里写着「three 约 600KB」。你要加图表库、编辑器、地图，照这个结构抄；直接写 `import * as echarts` 就是给每个访客多发 300KB。

数字变大时别猜是谁干的：本地 `git log --oneline -5`，再对照你每次发布记下的那一行基线，两次之间通常只有一两个提交，二分成本极低。

动态页不是「更差」，是有成本：它每次请求都要在服务端跑一遍、没有静态产物可以让 nginx 直接吐，首字节时间全部压在进程上。所以判据是「这一页的数据真的因人而异吗」——不是，就别让它变 `ƒ`。

三个回归信号，发布前扫一眼：动态页变多、First Load JS 突增、本该 `○` 的页面变成 `ƒ`。

:::hint 构建输出就是体检报告
数字和符号本身不重要，**变化**才重要。每次发布前把 `/` 的 First Load JS 和三个符号记一行，涨了才去查是哪次提交带进来的。
:::

:::solution 本仓的一次真实读数（示例格式，换成你的）
```text
Route (app)                     Size     First Load JS
○ /                             12 kB    ~190 kB
● /tools/[cat]                  8 kB     ~186 kB
ƒ /learn/[code]                 2 kB     ~178 kB
ƒ /f/[slug]                     ...
→ 动态页只有带 ?参数 或请求期数据的那些；其余都是静态壳
```
:::

#### 步骤 8.2 上线与回滚

发布是三步：本地提交并 push → 服务器同步脚本 → 线上验收。关键不在命令，在**脚本到底做了什么**，因为线上不对时你要能立刻判断卡在哪一步。它依次做五件事：

1. 检查分支是 `main`、工作区干净。服务器上有未提交改动会**直接拒绝**（服务器是只读部署目标）。
2. `git fetch` + `pull --ff-only`。HEAD 没变就打 `已是最新（abc1234），无需构建` 然后退出。
3. 变更全是 `*.md` / `ops/*` / `docs/*` 就跳过构建与重启；本周改的是 `.tsx`，不会命中。
4. 构建失败时 **`die` 发生在 `pm2 restart` 之前**，老进程继续对外服务。
5. 构建成功后先跑架构门禁（扫三个仓的分层与循环依赖，`error` 级违规直接中止），再重启并探活本地端口。

```bash
git status --short                 # 只该有你这次要发的文件；有别的先查清来源
git add -A && git commit -m "feat: 新增学习路线页 /roadmap"
git push origin main

# 在本机仓根执行；它会 ssh 到服务器跑 sync-deploy.sh
# --dry-run 会真的 fetch/pull 做判定，但不构建不重启：发布会前先确认「这次会不会构建」
bash notelab-java/ops/sync-notelab-c.sh

curl -s -o /dev/null -w '%{http_code}\n' https://haolo.cloud/roadmap
curl -s https://haolo.cloud/roadmap | grep -o '<title>[^<]*</title>'
```

回滚是同一套流程，只换提交内容。用 `revert` 而不是 `reset --hard`：`revert` 生成一个新提交、历史不丢、别人已经拉到的代码不会分叉；`reset` 只改本地指针，push 还得 `--force`，在共享仓上是事故。

```bash
git revert --no-edit HEAD
git push origin main
bash notelab-java/ops/sync-notelab-c.sh
curl -s -o /dev/null -w '%{http_code}\n' https://haolo.cloud/roadmap   # 404 才是对的
```

有两个窗口要提前知道。一是重启前后那几秒进程没在监听，探活脚本只判断「有没有 HTTP 应答」（401/302/200 都算活着），所以它通过不等于用户无感——发布挑低峰。二是构建会重写 `.next`，而 chunk 文件名带 hash：重启后已经打开页面的人再点一个软导航，可能去拉一个已经不存在的 JS 文件。这类错误靠第 6 周的错误边界接住（提示 + 回首页），所以别把 `error.tsx` 当装饰。

线上验收固定四件事：状态码、`<title>`、关键交互（手机点一遍）、以及 `/sitemap.xml` 里有没有这个新页。

:::hint 线上还是旧版，先看日志
不要先怀疑 CDN。脚本失败时会把构建日志最后 25 行打到终端；「已是最新」意味着根本没拉到新提交——先 `git log --oneline -3 origin/main`，再看本地 HEAD。
:::

:::solution 一次完整发布的输出长什么样
```text
=== notelab-c ===
更新 3f2a1c9 → 8b7d4e0（6 个文件）
  构建：npm run build （输出 → sync-deploy-notelab-c.log）
  构建完成
  ArchGuard 通过（无 error 级违规）
  pm2 notelab-c 已重启
  探活 http://127.0.0.1:3010/games/ → HTTP 200
=== notelab-c 同步完成 ===
```
看到「已是最新」就是第 2 步；看到「构建失败」就是第 4 步，此时线上仍是旧版。
:::

:::error 两个把「发布」变成「猜谜」的报错
```text
Property 'roadmap' is missing in type '{ projects: ...; posts: ...; }'
but required in type 'Record<HomeTab, TabContent>'.
```
根因：只在 `nav.ts` 的联合类型里加了 `'roadmap'`，没在 `App.tsx` 的 `Record<HomeTab, TabContent>` 里补内容。这是**设计好的报错**——`Record` 就是拿来兜住「加了 tab 忘了写内容」的，别用 `as any` 绕过去。

```text
[12:03:41] 已是最新（3f2a1c9），无需构建
```
根因：服务器拉到的是远端 `main`，而你要发的东西还没 push（或 push 到了别的分支、或提交失败）。修法不是加 `--build`（那只会用旧代码重构建一次），而是 `git log --oneline -1 origin/main` 对一遍本地 HEAD。
:::

#### 步骤 8.3 毕业项目：给 notelab-c 加一个「学习路线」页

需求：新增公开页 `/roadmap`，列出 Java / Go / React 三条路线及各自阶段；匿名可看、有 title 与 description、进 sitemap、键盘可用、375px 不横滚、发布后可回滚。

**动手前先读一处代码**，能省掉一半改动：`parseHomeRoute()` 的末段是 `NAV_TAB_IDS.find((t) => t === segs[0])`，而 `NAV_TAB_IDS` 是从 `NAV_GROUPS` 自动派生的。所以只要在 `nav.ts` 里加一条 `kind: 'tab'`，URL 就通了，**不需要改 `hooks.ts`**。

这里还有一个「忘了会静默失败」的行为：路由壳建好、`nav.ts` 却忘了加，访问 `/roadmap` 不会 404——`parseHomeRoute` 对不认识的末段回落到 `projects`，你看到的是项目页，而 curl 还能拿到你写的 title。所以验收必须看一眼页面内容，不能只验状态码。

命名也要避开 nginx 已占的前缀（`/blog`、`/admin`、`/api`、`/ailab`、`/games`、`/vs`、`/thunder`、`/play`、`/f`）——`App.tsx` 顶部的注释列了这张表；`/roadmap` 不在其中，安全。

四个文件：

```tsx
// ① src/app/(home)/roadmap/page.tsx（新建）
import type { Metadata } from "next"
import HomeApp from "@home/App"

export const metadata: Metadata = {
  title: "学习路线",
  description: "Java / Go / React 三条路线的阶段、课时与顺序，匿名可看，进度只存本机。",
}

export default function RoadmapPage() {
  return <HomeApp />
}
```
```ts
// ② src/features/home/data/nav.ts（改 2 处）
export type HomeTab = 'projects' | 'posts' | 'tools' | 'learn' | 'roadmap' | 'knowledge' | 'dashboard'

// 「学习」组的 entries 里加一条（NAV_TAB_IDS 会自动包含它）
{ kind: 'tab', id: 'roadmap', label: '学习路线', icon: 'layers' },
```
```tsx
// ③ src/features/home/App.tsx（改 2 处）
import { RoadmapTab } from './components/RoadmapTab'

// const base: Record<HomeTab, TabContent> 里补一项
roadmap: {
  title: '学习路线',
  subtitle: '三条语言路线 · 阶段与顺序 · 匿名可看',
  content: <RoadmapTab />,
},
```
```tsx
// ④ src/features/home/components/RoadmapTab.tsx（新建）
"use client"
import Link from "next/link"

const ROUTES = [
  { code: "java", name: "Java", stages: ["语法与集合", "并发与 JVM", "Spring 与上线"] },
  { code: "go", name: "Go", stages: ["语法与 goroutine", "接口与错误处理", "服务与部署"] },
  { code: "react", name: "React", stages: ["渲染与路由", "性能与状态", "交付与诊断"] },
]

export function RoadmapTab() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-zinc-500">三条路线按顺序学，每条三个阶段；进度只存在你自己的浏览器里。</p>
      <ol className="mt-4 space-y-3">
        {ROUTES.map((r) => (
          <li key={r.code} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{r.name}</h2>
              <Link href={`/learn/${r.code}`} className="inline-flex min-h-[44px] items-center text-xs font-medium">
                打开这门课 →
              </Link>
            </div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {r.stages.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  )
}
```

再加两处收尾：把 `/roadmap` 加进第 7 周的 `sitemap.ts`；卡片标题用 `h2` 而不是 `h3`（顶栏已有 `h1`，跳级会让读屏的标题导航出现断档）。数据写死在组件里是有意的：静态数据在构建期就会被预渲染进 HTML，爬虫看得到；换成 `useEffect` 里取数，HTML 里就只剩一个空 `<ol>`——这正是第 2 周那道「正文要不要被索引」的题。

:::hint 加一条 tab 只改两处
`nav.ts` 的联合类型 + `App.tsx` 的内容表。前者让 URL 生效，后者让 tsc 逼你补内容；`hooks.ts`、路由壳、侧栏渲染都不用动。
:::

:::solution 交稿前的六项自检（要能贴进 PR）
```text
1. 匿名（先退出登录）直接打开 /roadmap，三条路线都在
2. curl -s https://haolo.cloud/roadmap | grep -o '<title>[^<]*</title>' → 含「学习路线」
3. curl -s https://haolo.cloud/sitemap.xml | grep roadmap → 有这一行
4. 375px：第 4 周那三层探针都为空；「打开这门课」高度 ≥44px
5. 键盘 Tab 到每个链接，焦点可见（第 7 周的 :focus-visible）
6. git revert 后 404，再 revert 回来 200
```
:::

**自测**（合上文档回答）

1. 构建输出里 `●` 与 `ƒ` 的区别是什么？本仓 `/tools/[cat]` 与 `/learn/[code]` 各是哪种，为什么？
2. 刚改完代码却看到「已是最新（3f2a1c9），无需构建」，最可能是哪一步漏了？为什么加 `--build` 没用？
3. 回滚为什么用 `git revert` 而不是 `git reset --hard`？回滚之后 `/roadmap` 返回 404 是预期行为吗？

**验收**

- [ ] `npm run build` 的路由表里，`/`、`/tools/[cat]`、`/learn/[code]` 的符号与你的预测一致（不一致的写出原因）
- [ ] 记下 `/` 的 First Load JS 数字，与上一次发布相比涨幅可解释；`node -e` 的 chunk 排行里没有意外的大文件
- [ ] `curl -s https://haolo.cloud/roadmap | grep -o '<title>[^<]*</title>'` 输出含「学习路线」
- [ ] `curl -s https://haolo.cloud/sitemap.xml | grep -o 'haolo.cloud/roadmap' | wc -l` 为 1
- [ ] 375px 无横向滚动，Tab 能到「打开这门课 →」且焦点可见
- [ ] `git revert` 后 `/roadmap` 为 404，再 revert 回来为 200，两次都在部署日志里留有 `更新 xxxx → yyyy`

---

## 阶段五 · 深度：渲染机制与状态架构（第 9 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 巩固 |
| 这一阶段解决 | 从「能跑」到「知道它为什么慢、慢在哪一行」 |
| 核心知识 | 并发渲染（Suspense / useTransition）、状态架构选型、Profiler 与包分析 |
| 场景项目 | 场景 #5：个人中心（登录态 + 缓存 + 隐私 + 局部刷新） |
| 离开时应该能 | 用 Profiler 证明一次重渲染的代价，并给出可验证的优化 |

### 第 9 周：并发渲染、状态架构与诊断

**本周目标**：给一个 5000 行的列表加搜索框，用 `PerformanceObserver` 量出输入 5 个字符期间的长任务次数与最长一次，普通 `setState` 与 `useTransition` 各测一遍并给出两个数字；用 React DevTools Profiler 报出一次输入里重渲染的组件数与最贵的那个（毫秒）；最后按 L3 五个维度填完毕业自评表。

**为什么是这些内容**：前八周都在「做对」，这一周开始「知道它为什么慢」。C 端的慢有两种，工具完全不同：**加载慢**看 LCP（第 3 周已经量过），**交互慢**看长任务与 INP。它们会互相伪装——LCP 很好看、打字却卡，你就以为要换框架了。React 19 的并发特性只解决交互慢的一半：`startTransition` 把更新标成可中断的低优先级，但它不会让你的 `filter` 变快，5000 行该跑还是跑。另一半是状态架构：Context 一变全量重渲染、URL 一变整页重渲染，位置选错，memo 也救不回来。这一周同时也是收官——L3 的标准不是「都学过」，而是五个维度里至少四个能拿出数字或命令；拿不出来就是不合格，而不是「差不多会了」。

#### 步骤 9.1 用 useTransition 把「非紧急更新」让出去

先造一个最小复现。临时页放在 `src/app/(home)/lab/page.tsx`，**不发布**：发之前删掉，或者至少给它 `robots: { index: false }`。

```tsx
// src/app/(home)/lab/page.tsx
"use client"
import { useState } from "react"

const ALL = Array.from({ length: 5000 }, (_, i) => `第 ${i + 1} 条：React 19 的并发渲染`)

export default function Lab() {
  const [kw, setKw] = useState("")
  const rows = ALL.filter((t) => t.includes(kw))   // 每次输入都同步过滤 + 渲染 5000 个 li
  return (
    <div className="p-6">
      <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="连续敲 5 个字" />
      <ul>{rows.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  )
}
```

卡不卡不靠感觉，靠长任务：一次超过 50ms 的主线程占用，就是用户能感知到掉帧的那一类。

```js
// 控制台：先执行第一段，然后在输入框里连续敲 5 个字符，再执行第二段
window.__lt = []
const po = new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => Math.round(e.duration))))
po.observe({ type: 'longtask', buffered: true })

po.disconnect()
console.log('长任务', window.__lt.length, '次；最长', Math.max(0, ...window.__lt), 'ms；合计',
  window.__lt.reduce((a, b) => a + b, 0), 'ms')
```

`buffered: true` 会把观察器挂上之前已经发生的条目一起给你；`Math.max(0, ...[])` 是防「一次都没有」时得到 `-Infinity`。这个 API 只有 Chromium 系支持，Firefox / Safari 里 `observe({ type: 'longtask' })` 会直接抛错——那不是代码错，换 Chrome 量。

然后改成双状态：输入框的值和过滤用的值分开，重的那一步放进 transition。

```tsx
const [kw, setKw] = useState("")          // 输入框的即时值（紧急）
const [query, setQuery] = useState("")    // 真正参与过滤的值（非紧急）
const [pending, startTransition] = useTransition()
const rows = ALL.filter((t) => t.includes(query))

<input
  value={kw}
  onChange={(e) => {
    const v = e.target.value
    setKw(v)                              // 必须同步：受控输入滞后会让光标跳、输入法丢字
    startTransition(() => setQuery(v))    // 5000 行的渲染可以被下一次输入打断
  }}
/>
{pending && <span className="text-xs text-zinc-400">筛选中…</span>}
```

四个点要读懂。① **`setKw` 不能放进 transition**。受控输入的值来自 React 状态，你把它标成低优先级，浏览器先显示了新字符、React 随后又渲染回旧值，输一个字回弹一次，看起来像「输入法坏了」。紧急更新（输入、按下、悬停）永远同步。② `pending` 是「正在算」的指示，每敲一下都会闪，别拿它当 loading 用。③ transition **不减少总工作量**，只是把渲染排到可中断的低优先级：长任务次数可能没变，最长一次会明显变短，输入不再丢帧——这正是要量的两个数。④ 要真减少工作量只有三条路：`useDeferredValue`（让列表用滞后的值渲染，输入永远最新；React 19 支持第二个参数 `initialValue`）、虚拟列表（只渲染视口内几十行）、把过滤搬进 Web Worker。

React 19 还给 `startTransition` 加了异步支持：`startTransition(async () => { const d = await fetch(); setX(d) })`，`isPending` 会一直保持到 `await` 结束。19 之前只能用 `useTransition` 的同步回调配 `useOptimistic` 之类的组合。

:::hint transition 不是 debounce
debounce 是「等你不敲了再算」，代价是结果延迟出现；transition 是「先画输入框，把重计算放进可被打断的低优先级」，代价是列表可能短暂落后于输入。它们不在一个层面上，别互相替代——真卡到掉帧时，两个一起用才合理。
:::

:::solution 一轮实测（数字是量级示例，换成你自己的）
```text
改前（setState 同步过滤）  长任务 5 次，最长 260ms，合计 780ms，输入明显掉帧
改后（startTransition）    长任务 3 次，最长  60ms，合计 640ms，输入跟手
说明：合计只降了一点——工作量没变；变的是「有没有一次超过一帧的阻塞」
```
如果最长一次仍在 200ms 以上，说明渲染本身太重（5000 个 DOM 节点），transition 帮不了你，该上虚拟列表。
:::

#### 步骤 9.2 用 Profiler 定位一次重渲染

长任务只告诉你「卡了」，Profiler 告诉你「卡在谁身上」。打开 React DevTools → Profiler → 齿轮里勾上 **Record why each component rendered while profiling**（不勾只有条形图，看不到原因），然后录一次「聚焦输入框 → 敲一个字 → 停」。

一次录制要读三个数：本次提交里重渲染了几个组件、按耗时排序谁最贵、点开它看 `Why did this render?`——答案只有四种：props 变了、自身 state 变了、父组件渲染了、订阅的 context 变了。第四个最常见也最容易被忽略：Context 的值一变，**所有消费者**都重渲染，跟它们读的是哪个字段无关。

本仓的 `/lab` 里，重渲染的是 5000 个 `<li>`，原因是父组件的 `rows` 每次过滤都是新数组。能救的只有「重渲染了但 props 没变」的那一层，所以先把行抽成组件、只收一个字符串：

```tsx
const Row = memo(function Row({ text }: { text: string }) {
  return <li>{text}</li>
})

// 父组件：rows 仍是新数组，但每个元素的 text 是字符串，未变的行会被 memo 跳过
<ul>{rows.map((t) => <Row key={t} text={t} />)}</ul>
```

`memo` 有三个隐形杀手，撞上就等于没写：props 里传了**新对象**（`style={{ color: 'red' }}`）、**新函数**（`onClick={() => pick(t)}`）、或者 `children` 是每次新建的元素。修法是 `useCallback` / 把常量提到模块顶层，而不是给组件再加一层 `useMemo`。

还有两个常见误判：给**整页**加 `memo` 无效——父组件自己的 state 变了，它必然重渲染，`memo` 只拦「父组件渲染但我的 props 没变」这一种；用 `useMemo` 缓存 JSX 也不减少渲染，`useMemo` 缓存的是计算，渲染照样发生。

:::hint 状态放哪，决定谁重渲染
先问两句：**谁需要读它**、**它多久变一次**。组件内 state 只影响自己；Context 适合低频全局值（主题、登录态）；外部 store 适合高频、要按字段订阅的；URL 适合要分享、要回退的。选错位置，后面所有 memo 都是在补墙。
:::

:::solution 三种方案的取舍
```text
方案          适合                        代价
组件内 state  只影响自己                  无法跨组件共享
Context       低频、全局（主题 / 登录态）  一变全量重渲染，按字段订阅做不到
外部 store    高频、局部订阅               多一层订阅与快照缓存的心智负担
URL           要分享 / 要回退              一变整页重渲染（第 5 周）
```
:::

#### 步骤 9.3 状态放对位置，然后做毕业自评

本仓有一个把这道题答对的例子，值得逐行读：`modeler/state/context.tsx` 里 Context **只放一个 `RefObject`**——引擎实例的引用，创建后永不改变，所以它永远不会触发重渲染；真正会变的场景状态（模型列表、选中项、视图）放在 `modeler/state/store.ts` 的极小外部 store 里，React 侧用 `useSyncExternalStore` 订阅。注释里写清了为什么不直接用 `useState`：状态要能被非 React 的异步回调读写（导入完成时组件可能已经重挂）。

它也有代价，而且正是本周要诊断的那种：`useModelerState()` 返回**整个 state**，`commit()` 每次都造新对象，于是任何字段一变，七个消费者（`Viewport`、`ModelList`、`TransformEditor`、`MaterialPanel`…）全部重渲染。三个模型时感觉不到；五十个模型拖变换滑块，就是每帧七次渲染。修法不是加 memo，是让订阅变细：

```ts
// ❌ getSnapshot 每次返回新对象：React 认为快照一直在变，轻则白渲染，重则死循环
const useSnapshot = () => useSyncExternalStore(subscribe, () => ({ id: state.selectedId }))

// ✅ 快照必须是稳定引用：返回原始值，或把对象缓存起来
const useSelectedId = () => useSyncExternalStore(subscribe, () => state.selectedId)
```

判定顺序可以固定成三步：**先看渲染次数**（Profiler：是不是一堆没必要的重渲染）→ **再看单次成本**（一次要建多少 DOM / 算多少行，虚拟列表管这段）→ **最后看主线程是不是被别的活占了**（第三方脚本、大 JSON 解析、同步 XHR——那是第 7 周的战场）。三步的顺序不能颠倒：先怀疑渲染次数的人，最后往往发现是脚本在抢主线程。

这一周的产出不是新功能，而是三组数字加一张表。L3 的通过标准写在路线开头：五个维度里至少四个达到「熟练」，且没有「不合格」。下面这张表就是打分依据，每一项都要能当场复现，不能写「理解了」。

:::error 两个只有跑起来才会遇到的报错
```text
Uncaught Error: A component suspended while responding to synchronous input. This will cause the UI
to be replaced with a loading indicator. To fix, updates that suspend should be wrapped with startTransition.
```
根因：一次**同步**更新里触发了 Suspense（典型是 `use()` 读还没就绪的数据，或 lazy 组件首次加载），React 只能把整棵子树换成 fallback。修法二选一：把这次更新包进 `startTransition`（让它可中断），或在更近的地方加 `<Suspense>` 边界，别让整页闪。

```text
Warning: The result of getSnapshot should be cached to avoid an infinite loop
```
根因：`useSyncExternalStore` 的 `getSnapshot` 每次调用都返回新对象/新数组，React 用 `Object.is` 比较，永远认为「变了」，于是无限重渲染。返回原始值，或把派生对象缓存起来（同一份 state 给同一个引用）；要按选择器订阅就用 `useSyncExternalStoreWithSelector`，别手写。
:::

:::hint 状态放哪一层，先问「谁要读」和「它多久变一次」
只影响自己的放组件内 state；低频全局值（主题 / 登录态）放 Context；高频且要按字段订阅的放外部 store；要分享、要回退的放 URL。选错层的代价，是后面所有 `memo` 都在补墙。
:::

:::solution 参考实现：Context 只放引用，会变的状态进 store

本仓 `modeler/` 的答案就是把两层分开——Context 只放一个创建后不再变的 `RefObject`，会变的场景状态（模型列表、选中项、视图）放极小外部 store，React 侧按字段订阅：

```ts
// modeler/state/context.tsx：Context 只放引擎实例引用，创建后永不变化 → 不触发重渲染
const EngineContext = createContext<RefObject<Engine> | null>(null)

// modeler/state/store.ts：会变的状态放外部 store，订阅细到单个字段
export const useSelectedId = () => useSyncExternalStore(subscribe, () => state.selectedId)
export const useModelIds = () => useSyncExternalStore(subscribe, () => state.modelIds)
```

`getSnapshot` 必须返回**稳定引用**（原始值，或缓存过的对象），否则就是上面 `:::error` 里那条无限重渲染警告。

毕业自评按五维逐项打分，每项都要能当场复现（对应下方「验收」清单，不达标就写清回第几周补什么）：

| 维度 | 达标线（L3） | 本周拿什么证据 |
|---|---|---|
| 性能 | 压进预算并给对照数据 | 5000 行输入 5 个字符：最长长任务 >200ms → <50ms |
| 正确性 | 能想到竞态与降级 | 一次输入的重渲染组件数（改前 / 改后）+ 最贵组件毫秒数 |
| 可访问性 | 全站键盘可达、读屏可读 | 只用键盘从地址栏走到 `/learn/java` |
| SEO | sitemap / robots 正确 | `curl` 见 title；sitemap 含 `/roadmap`、不含 `/me` |
| 交付 | 有回滚与监控 | 一次发布 + 一次回滚的日志；线上无 `/lab` |

五维里 ≥4 项达到 L3、且没有「不合格」，才算 L3 毕业。
:::

**自测**（合上文档回答）

1. `startTransition` 与 debounce 各自解决什么问题、代价分别是什么？为什么说它们不能互相替代？
2. 为什么不能把受控输入框的 `setKw` 也放进 transition？线上表现会是什么样？
3. Profiler 显示 5000 个 Row 全部重渲染，你先改哪一层？为什么给整页加 `memo` 没有用？

**验收**（同时作为毕业自评：每项都要能当场复现）

- [ ] 两个数字：5000 行下输入 5 个字符的「最长长任务」从 >200ms 降到 <50ms，且能解释为什么「合计」降得不多
- [ ] 两个数字：Profiler 里一次输入的重渲染组件数（改前 / 改后），以及最贵组件的毫秒数
- [ ] 能指出项目里一处「一变就全量重渲染」的位置（`useModelerState` 的七个消费者），并说明改不改、代价是什么
- [ ] 性能（第 3 周）：改前/改后对照表还在，LCP < 2.5s、CLS < 0.1，`/` 的 First Load JS 有具体数字（第 8 周）
- [ ] 可访问性（第 7 周）：只用键盘能从地址栏走到 `/learn/java` 并开始学；关闭的抽屉不参与 Tab 序列
- [ ] SEO（第 7、8 周）：`curl` 能看到 title，sitemap 含 `/roadmap` 且不含 `/me`
- [ ] 交付（第 8 周）：一次发布 + 一次回滚都有日志记录；线上没有 `/lab` 这类临时页（`git grep -n "\"/lab\"" -- src/app` 无输出）
- [ ] 综合：五维自评里 ≥4 项达到 L3、无不合格；不达标的写清「回到第几周补什么」

---

## 场景实践库（可迭代的扩展点）

C 端的「熟练」体现在**能在匿名、弱网、手机、搜索引擎这四条约束下把页面做对**。下面的场景按这个方向挑：

| # | 场景 | 业务背景 | 交付物 | 考察点 | 建议阶段 |
|---|---|---|---|---|---|
| 1 | 内容列表与筛选 | 文章/工具列表，要分类、分页、可分享 | 列表页 + URL 状态 + 空态 | URL 即状态、缓存、空态 | 三 |
| 2 | 详情页与分享 | 每篇内容有独立链接，要被搜到 | 详情页 + metadata + OG | SSR、SEO、首屏 | 一 |
| 3 | 评论与互动 | 点赞/评论要立刻有反馈，失败要回滚 | 乐观更新 + 错误回滚 | 乐观更新、降级 | 四 |
| 4 | 活动页 / 落地页 | 一次投放，首屏决定转化 | 静态页 + 图片优化 | LCP、图片、埋点 | 二 |
| 5 | 个人中心 | 登录态、收藏、隐私 | 受保护页面 + 缓存 | 鉴权、缓存、隐私 | 五 |
| 6 | 离线可用 | 弱网/断网仍能看上次内容 | Service Worker + 缓存策略 | 缓存版本、失效 | 五 |
| 7 | 数据看板 | 图表多、数据大 | 按需加载图表 + 骨架 | 拆包、懒加载 | 四 |

**统一交付标准**：375px 可用、LCP 有数据、失败有兜底、`curl` 能看到 title、发布后可回滚。

**相关项目**（点开即可看完整需求与参考实现）：
[内容列表与筛选](/admin/study/projects?p=react/content-list) ·
[详情页与分享](/admin/study/projects?p=react/detail-share) ·
[活动落地页](/admin/study/projects?p=react/campaign-landing) ·
[A/B 实验与埋点](/admin/study/projects?p=react/ab-experiment) ·
[实时评论与在线列表](/admin/study/projects?p=react/realtime-comments) ·
[下单流程前端](/admin/study/projects?p=react/checkout-flow)


每个项目末尾都有**「验收脚本」**折叠块：复制到本地，把 `BASE` 指向你的服务就能跑一遍验收。

## 毕业评估（L3 rubric）

| 维度 | 不合格 | 合格（L2） | 熟练（L3） | 优秀（L4） |
|---|---|---|---|---|
| 性能 | 没量过 | 能测 LCP/CLS | 能压进预算并给对照数据 | 能定性能预算规范 |
| 正确性 | 只测正常路径 | 三态齐全 | 能想到竞态与降级 | 能设计可验证的交互契约 |
| 可访问性 | 只用鼠标 | 有语义标签 | 全站键盘可达、读屏可读 | 能定 a11y 规范 |
| SEO | 没 metadata | 每页有 title/description | sitemap/robots 正确 | 能做结构化数据 |
| 交付 | 本机可跑 | 能构建上线 | 有回滚与监控 | 能定发布流程 |

**通过标准**：5 个维度里至少 4 个达到「熟练」，且没有「不合格」。

## 后续迭代：怎么往里加东西

| 加什么 | 怎么加 | 注意 |
|---|---|---|
| 新场景 | 往「场景实践库」加一行 | 一个场景只考察 1–2 个点 |
| 新深度周 | 在对应阶段后加 `### 第 N 周`，同步更新知识地图 | 每周必须有可验收产出物 |

**三条红线**：每步都要有「思路 + 答案」；场景要能独立上线；不加「以后可能会用」的内容。

---

## 常见坑（C 端专属）

| 现象 | 原因 | 处理 |
|---|---|---|
| 搜索结果是「登录」页 | robots 没排除 `/me` `/login` | 加 Disallow + sitemap 只放公开页 |
| 首屏 3 秒白屏 | 数据全在客户端取、没有骨架 | 服务端给结构，骨架占位 |
| 内容改了线上不变 | `Cache-Control: max-age` 太长 | 公开内容用 `no-cache + ETag` |
| 手机底部按钮被挡住 | 没处理安全区 | `env(safe-area-inset-bottom)` |
| 详情页刷新丢失 | 状态存在组件里 | 用 `?id=` 承载 |
| 分享出去的链接打不开 | 依赖了登录态或 state | 公开页不依赖会话，URL 自包含 |

> **提醒**：C 端的难点从来不是「会不会写组件」，而是**在匿名、弱网、手机、搜索引擎这四条约束下，还能把页面做对**。这四条每一条都能单独毁掉一个功能。
