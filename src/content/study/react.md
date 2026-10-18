# React 路线 · 8 周（面向 notelab-c 的 C 端开发）

> **为什么重写**：B 端页面「登录后自己用」，慢一点、难看一下都能忍；C 端不行 —— 匿名用户第一次打开就在打分，搜索引擎在抓，弱网在丢包，手机上在横竖屏切换。**难度不在 React API，在约束。**
>
> **靶场**：`notelab-c`（`src/app` + `src/features/home` + `apps/play`）。每一周的任务都落在真实文件上，不是造 demo。
>
> **用法**：思路与代码默认收起，先自己判断再对照。

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

### 第 1 周：先把 C 端跑起来，画出它的骨架

**本周目标**：能在本地跑起 `notelab-c`，说清「一个 URL 怎么变成一个页面」。

#### 步骤 1.1 跑起来并找到三层入口

跑 `npm run dev`，打开 `/`、`/learn`、`/learn/java`、`/tools`，然后对照源码找出这三层：

```text
src/app/(home)/learn/page.tsx        ← 路由壳：只给 metadata + 渲染 HomeApp
src/features/home/App.tsx            ← 外壳：按 URL 选 tab、组装侧栏与标题
src/features/home/components/LearnTab.tsx  ← 内容：真正干活的组件
```

:::hint 为什么要先看路由壳
C 端的每个页面都是「路由壳 + 一个共享外壳 + 一个内容组件」。不理解这个分层，你会把 SEO 元数据写进客户端组件（无效），或者把数据请求写进路由壳（重复请求）。
:::

:::solution 验证方法
```bash
cd notelab-c && npm run dev
# 浏览器打开 http://localhost:3000/learn/java
```
然后在三个文件里各搜一次 `learn`：
- `src/app/(home)/learn/page.tsx` —— 只有 `metadata` 和 `<HomeApp />`
- `src/features/home/lib/hooks.ts` 的 `parseHomeRoute` —— 把 pathname 解析成 `{ tab: 'learn', track: 'java' }`
- `src/features/home/components/LearnTab.tsx` —— 用 `track` 决定渲染哪门语言
:::

#### 步骤 1.2 找出 C 端特有的五个约束

打开 `/learn` 页面源码，找出它为了「匿名可访问」做了哪些事，并在文档里写下五条约束。

:::hint 读代码要读「为什么这么写」
`/learn` 的注释里写着「本页不需要登录：内容走 Java 的公开只读出口 `/api/learning/public`」。这句话就是设计决策：**内容对匿名开放，进度只存浏览器**。C 端的很多取舍都能从这类注释里读出来。
:::

:::solution 参考答案
```text
1. 匿名可用：公开接口 + localStorage 存进度，不依赖会话
2. 可被索引：每页有 metadata（title/description），不是纯客户端渲染
3. 弱网可用：有 loading 骨架与错误态，不白屏
4. 手机可用：375px 不横向滚动，触控目标够大
5. 可分享：/learn/<code> 是真实 URL，不是组件内 state
```
:::

#### 步骤 1.3 用「URL → 组件」的方式读一次路由

把 `parseHomeRoute()` 的输入输出抄下来，验证 4 个 URL 的解析结果。

:::hint 路由解析是唯一真源
`parseHomeRoute` 同时被 SSR 和客户端用，所以「刷新」和「点击导航」走的是同一套逻辑。改路由规则只改这里，不要在组件里再判断一次 pathname。
:::

:::solution 预期结果
```ts
parseHomeRoute("/")             // { tab: 'projects', track: null }
parseHomeRoute("/learn")        // { tab: 'learn', track: null }
parseHomeRoute("/learn/java")   // { tab: 'learn', track: 'java' }
parseHomeRoute("/tools/dev")    // { tab: 'tools', cat: 'dev' }
```
:::

**验收**

- [ ] 本地能跑起 notelab-c，四个页面都能打开
- [ ] 能说出「路由壳 / 外壳 / 内容组件」各自负责什么
- [ ] 能背出 C 端五个硬差异

---

### 第 2 周：渲染策略与元数据

**本周目标**：能给一个新页面选对渲染方式，并让它有正确的 SEO 信息。

#### 步骤 2.1 判断一个页面该 SSR、SSG 还是纯客户端

拿三类页面投票：`/learn`（内容公开、更新不频繁）、`/me`（登录后）、`/games`（有交互动画）。

:::hint 判断只看两件事
**内容是否需要被搜索引擎看到**、**数据是否因人而异**。公开且不常变 → 静态/增量；公开且实时 → 服务端渲染；因人而异 → 客户端取数（但要给骨架）。
:::

:::solution 结论
| 页面 | 策略 | 理由 |
|---|---|---|
| `/learn` | 服务端渲染 + 缓存 | 匿名、要被搜到、内容来自公开接口 |
| `/me` | 客户端取数 | 依赖登录态，不索引 |
| `/games` | 客户端 + 静态壳 | 交互重，首屏只需要壳 |
:::

#### 步骤 2.2 给新页面加 metadata

新建一个路由壳，写 `title` / `description` / `openGraph`，用 `curl` 看服务端返回的 HTML 里有没有它们。

:::hint metadata 必须写服务端
`export const metadata` 只在服务端组件生效。写在 `"use client"` 组件里会被静默忽略——这是 C 端最常见的「做了 SEO 但没生效」。
:::

:::solution 代码
```tsx
// src/app/(home)/roadmap/page.tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "学习路线 · ethzzz",
  description: "Java / Go / React 三条路线的阶段与顺序，附每阶段产出物。",
  openGraph: { title: "学习路线", description: "三条路线，按顺序学。" },
}

export default function RoadmapPage() {
  return <div>...</div>
}
```
```bash
curl -s https://haolo.cloud/roadmap | grep -o '<title>[^<]*</title>'
```
:::

#### 步骤 2.3 客户端组件的边界

把一个大组件里「只读数据」的部分下沉成服务端组件，只把交互留给 `"use client"`。

:::hint 边界越低，首屏越轻
`"use client"` 会把整棵子树打进客户端包。判断标准：这个组件有没有 state / 事件 / 浏览器 API。没有，就别加。
:::

:::solution 判断表
| 组件 | client | 理由 |
|---|---|---|
| 页面外壳 / 标题 | 否 | 纯结构 |
| 列表渲染 | 否（若数据服务端给） | 无状态 |
| 筛选器 / 分页按钮 | 是 | 有事件与状态 |
:::

**验收**

- [ ] 能说出一个页面为什么选某种渲染方式
- [ ] `curl` 能看到自己写的 `<title>`
- [ ] 能指出项目里一个「可以下沉却还没下沉」的 client 组件

---

## 阶段二 · 首屏与移动端（第 3–4 周）

### 第 3 周：性能预算

**本周目标**：能量出 LCP/CLS/INP，并把一个指标改好。

#### 步骤 3.1 量出基线

用 Lighthouse（移动端模式）跑 `/learn` 和 `/`，记下 LCP、CLS、INP、总 JS 体积。

:::hint 先量再改
没有基线的优化都是猜。手机模式下 LCP 主要受三件事影响：首屏图片/字体、阻塞渲染的 CSS、以及首屏 JS 的执行时间。
:::

:::solution 记录表
```text
页面      LCP     CLS    INP    首屏JS
/         2.8s    0.02   120ms  420KB
/learn    3.4s    0.11   180ms  510KB
```
把这张表贴在 issue 里，改完再测一次 —— 没有对照的「优化」不算数。
:::

#### 步骤 3.2 图片与字体：两个最常见的 LCP 杀手

给首屏图片加尺寸与懒加载，给字体加 `font-display: swap` 与预加载。

:::hint 没有尺寸的图片就是 CLS
`<img>` 不带 `width/height`，加载完会撑开布局，CLS 直接超标。字体同理：等字体加载完再渲染文本，LCP 会被拖到字体下载完成之后。
:::

:::solution 代码
```tsx
<img src="/cover.webp" width={640} height={360} loading="lazy" decoding="async" alt="封面" />

// app/layout.tsx 里
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
```
```css
@font-face { font-family: Inter; src: url(/fonts/inter.woff2) format("woff2"); font-display: swap; }
```
:::

#### 步骤 3.3 骨架屏与 Streaming

给数据页加 `loading.tsx` 或 `<Suspense>`，先出结构再出数据。

:::hint 骨架屏不是为了好看
它的作用是**让用户相信页面在动**。没有骨架的空屏，0.5 秒就会被当成「打不开」。注意骨架的尺寸要贴近真实内容，否则加载完会跳一下（又变成 CLS）。
:::

:::solution 代码
```tsx
// src/app/(home)/roadmap/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse p-6">
      <div className="h-8 w-48 rounded bg-zinc-200" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-zinc-100" />)}
      </div>
    </div>
  )
}
```
:::

**验收**

- [ ] 有一张改前/改后的指标对照表
- [ ] LCP 至少改善 20%，或能说清为什么到顶了
- [ ] CLS < 0.1

---

### 第 4 周：移动端

**本周目标**：375px 下不横向滚动、触控不误触、弱网不白屏。

#### 步骤 4.1 375px 重排

把页面缩到 375px，找出横向滚动、文字截断、按钮挤在一起的地方。

:::hint 横向滚动是最容易漏的 C 端 bug
固定宽度、`min-width`、长英文单词、`overflow-x: auto` 的表格都会撑破布局。自检办法：`document.documentElement.scrollWidth > window.innerWidth`。
:::

:::solution 排查代码
```js
// 控制台执行，返回 true 就是有横向滚动
document.documentElement.scrollWidth > window.innerWidth

// 找出超宽元素
[...document.querySelectorAll("*")].filter(el => el.getBoundingClientRect().right > window.innerWidth)
```
:::

#### 步骤 4.2 触控目标与安全区

把小于 44×44 的点击区域放大，给底部固定栏加 `env(safe-area-inset-bottom)`。

:::hint 手指不是鼠标
44px 是经验下限；相邻按钮间距小于 8px 会误触。底部固定栏在 iPhone 上会被 Home 指示条压住，必须用 `env()` 让位。
:::

:::solution 代码
```css
.tap { min-height: 44px; min-width: 44px; }
.bottom-bar { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
```
:::

#### 步骤 4.3 弱网与断网

模拟 Slow 3G + 离线，确认页面有超时提示与重试。

:::hint 超时是必须的
没有超时的请求，在弱网下会挂 30 秒以上，用户只看到一直转圈。给请求 10–15 秒超时，失败给「重试」，比无限等待好得多。
:::

:::solution 代码
```ts
const ac = new AbortController()
const timer = setTimeout(() => ac.abort(), 12000)
try {
  const res = await fetch(url, { signal: ac.signal })
  ...
} catch (e) {
  if (e.name === "AbortError") return { error: "网络超时，请重试" }
  return { error: "网络异常，请检查连接" }
} finally {
  clearTimeout(timer)
}
```
:::

**验收**

- [ ] 375px 无横向滚动
- [ ] 所有可点元素 ≥ 44px
- [ ] Slow 3G 下 12 秒内有明确错误提示

---

## 阶段三 · 状态与数据（第 5–6 周）

### 第 5 周：URL 就是状态

**本周目标**：筛选、分页、详情都能被分享、被刷新、被后退。

#### 步骤 5.1 把筛选条件写进 URL

把组件内的 `useState` 筛选改成查询参数，刷新后保持。

:::hint 为什么 URL 是状态
用户会复制链接发给人、会按后退、会收藏。写在 state 里的筛选，一刷新就没了 —— 这在 C 端是「功能缺失」，不是小毛病。
:::

:::solution 代码
```tsx
const sp = useSearchParams()
const cat = sp.get("cat") ?? "all"

function setCat(next: string) {
  const q = new URLSearchParams(sp.toString())
  if (next === "all") q.delete("cat"); else q.set("cat", next)
  router.replace(`/tools?${q.toString()}`, { scroll: false })
}
```
:::

#### 步骤 5.2 深链与刷新不丢

给详情页用 `?id=` 承载状态，刷新、分享、后退都不丢；**不要**用组件内 state 打开详情。

:::hint 精确匹配的副作用
本项目 B 端守卫是精确匹配，所以二级页统一用查询参数。C 端没有守卫，但同样建议 `?id=`：它不会让路由树爆炸，也不需要为每个详情写一个 page.tsx。
:::

:::solution 对比
```text
✅ /posts?id=42       刷新还在、可分享
❌ 组件内 setOpen(true)  刷新就没了、链接分享出去是空页
```
:::

#### 步骤 5.3 useSearchParams 的正确姿势

在静态页里用 `useSearchParams` 会要求 Suspense，把用法和坑记下来。

:::hint 静态页 + 查询参数 = 必须 Suspense
预渲染时读不到查询参数，Next 会要求边界；不加就会在 `next build` 时报错，或者整页退化成动态渲染。
:::

:::solution 代码
```tsx
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  )
}
```
:::

:::error 构建期与运行期的两个典型报错
```text
Error: useSearchParams() should be wrapped in a suspense boundary at page "/xxx".
```
↓ 加 `<Suspense>` 包住使用它的子树。

```text
Error: Hydration failed because the server rendered HTML didn't match the client.
```
↓ 首帧不一致：`Date.now()` / `Math.random()` / `localStorage` 直接写在渲染里。
:::

**验收**

- [ ] 任意筛选状态刷新后保持
- [ ] 详情链接能被复制、被新标签页打开
- [ ] 后退一次回到上一个筛选组合

---

### 第 6 周：公开数据与缓存

**本周目标**：让公开数据「快且不脏」。

#### 步骤 6.1 读懂公开接口的缓存语义

`/api/learning/public` 用 `ETag + Cache-Control: no-cache` 实现「每次回源确认、没变就 304」。

:::hint no-cache 不是 no-store
`no-cache` = 可以存，但用之前必须问服务端；`no-store` = 完全不存。前者能让内容「改完立刻生效」又不重复下载全量 —— 这是 C 端公开内容最合适的策略。
:::

:::solution 结论
```text
Cache-Control: no-cache + ETag
→ 浏览器存一份，下次带 If-None-Match
→ 内容没变：304，无响应体（省流量）
→ 内容变了：200 + 新内容（立即生效）
```
:::

#### 步骤 6.2 客户端缓存与失效

给列表页加 30 秒内存缓存，并明确「新增之后怎么让它变新」。

:::hint 缓存先答三个问题
多久算旧？谁负责失效？失效失败会怎样？答不上就别加。
:::

:::solution 代码
```ts
const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 30_000

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T
  const data = await load()
  cache.set(key, { at: Date.now(), data })
  return data
}
```
:::

#### 步骤 6.3 错误边界与降级

给路由加 `error.tsx` / `not-found.tsx`，让 500 和 404 都有像样的页面。

:::hint 错误边界是 C 端的面子
匿名用户撞上 500，看到的是 Next 的默认报错页 —— 直接关掉。一个「出错了，回首页」的页面，能把人留下来。
:::

:::solution 代码
```tsx
// src/app/error.tsx
"use client"
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-10 text-center">
      <h1 className="text-lg font-semibold">页面出错了</h1>
      <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
      <button className="mt-4 rounded-lg bg-black px-4 py-2 text-white" onClick={reset}>重试</button>
    </div>
  )
}
```
:::

**验收**

- [ ] 能解释 `no-cache` 与 `no-store` 的区别
- [ ] 每个缓存都能说出失效时机
- [ ] 故意抛错时看到的是自己的错误页

---

## 阶段四 · 可访问性、SEO 与交付（第 7–8 周）

### 第 7 周：可访问性与 SEO

#### 步骤 7.1 语义化与键盘

把「div 当按钮」改成 `button`，Tab 能聚焦、Enter 能触发、读屏能读出名字。

:::hint 语义标签自带行为
`<button>` 自带键盘、焦点、role；`<div onClick>` 什么都没有。用对的标签，成本最低。
:::

:::solution 代码
```tsx
// ❌
<div onClick={save} className="btn">保存</div>

// ✅
<button type="button" onClick={save} className="btn">保存</button>

// 图标按钮必须有可读名字
<button type="button" aria-label="删除" onClick={del}><TrashIcon /></button>
```
:::

#### 步骤 7.2 sitemap 与 robots

给公开页面生成 `sitemap.xml`，并在 `robots.txt` 里排除后台与个人页。

:::hint 别让爬虫进 `/me`
`sitemap` 只列**匿名可见**的页面；`robots` 里 Disallow 掉 `/me`、`/login`。否则搜索结果里会出现登录页，既难看又浪费索引。
:::

:::solution 代码
```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://haolo.cloud"
  return ["/", "/learn", "/posts", "/tools", "/roadmap"].map((p) => ({
    url: base + p,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.7,
  }))
}
```
```ts
// src/app/robots.ts
export default function robots() {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/me", "/login", "/register"] }],
           sitemap: "https://haolo.cloud/sitemap.xml" }
}
```
:::

#### 步骤 7.3 第三方脚本不阻塞首屏

统计脚本用 `next/script` 的 `afterInteractive`，别放在 `<head>` 里同步加载。

:::hint 同步脚本会直接拖垮 LCP
一个 200KB 的统计脚本同步加载，能把 LCP 推迟半秒以上。`strategy="afterInteractive"` 让它在首屏渲染之后执行。
:::

:::solution 代码
```tsx
import Script from "next/script"

<Script src="/analytics.js" strategy="afterInteractive" />
```
:::

**验收**

- [ ] Tab 一遍全站，焦点可见、Enter 能触发
- [ ] `/sitemap.xml` 只含公开页
- [ ] 首屏没有阻塞型第三方脚本

---

### 第 8 周：交付与毕业项目

#### 步骤 8.1 看懂构建产物

`npm run build` 后看：哪些页面静态、哪些动态、首屏 JS 有没有膨胀。

:::hint 构建输出就是体检报告
`○` 静态、`●` SSG、`ƒ` 动态。首屏 JS 突然变大，通常是某个 `"use client"` 往上提了，或引入了大依赖。
:::

:::solution 关注点
```text
1. 页面是 ○ / ● / ƒ？动态页多不多
2. 首屏 JS 有没有突然 +100KB
3. 有没有把 three / 图表打进非游戏页面
```
:::

#### 步骤 8.2 上线与回滚

走一遍发布：`npm run build` → push → `sync-deploy.sh notelab-c` → 线上验收。

:::hint 构建失败不会重启
同步脚本先构建、成功才 `pm2 restart`；失败时老进程继续服务。线上还是旧版？先看部署日志，不要怀疑缓存。
:::

:::solution 命令
```bash
npm run build
git push origin main
ssh myapp "/root/Notelab/notelab-java/ops/sync-deploy.sh notelab-c"
# 回滚：git revert <sha> && push && 再部署一次
```
:::

#### 步骤 8.3 毕业项目：给 notelab-c 加一个「学习路线」页

在 C 端新增一个公开页面 `/roadmap`，列出三条路线的阶段与顺序，匿名可看、可被搜到。

:::hint 为什么选这个页面
它同时踩到 C 端的四件事：匿名可见、要被索引、要能分享、要能上线。做完这一页，你就把 8 周的东西全用了一遍。
:::

:::solution 改动清单（4 处，缺一处就不生效）
```text
1. src/app/(home)/roadmap/page.tsx    路由壳：metadata + 渲染 HomeApp
2. src/features/home/data/nav.ts      HomeTab 增加 'roadmap' + NAV_GROUPS 加条目
3. src/features/home/lib/hooks.ts     parseHomeRoute 里加 "/roadmap" 的映射
4. src/features/home/App.tsx          Record<HomeTab, TabContent> 补 roadmap 的内容
   + 新组件 components/RoadmapTab.tsx（列表、阶段、进度条）
```
```text
⚠️ 三处必须同时改：nav.ts 的类型是 Record 的键来源，hooks 决定 URL 能不能进，
   App.tsx 的 Record<HomeTab, TabContent> 会强制你补内容 —— 漏了 tsc 直接报错，不会静默。
⚠️ URL 段要避开 nginx 已占前缀：/blog /admin /api /ailab /games /vs /thunder /play /f
```
```text
验收：
□ 匿名打开 /roadmap 能看到内容（先退出登录）
□ 手机 375px 不横向滚动、触控 ≥44px
□ curl 能看到 <title>学习路线…</title>
□ 分享链接给另一个设备，打开一致
□ npm run build 通过，线上 F5 不 404
```
:::

**验收**

- [ ] 新页面能被匿名访问、被搜索到、被分享
- [ ] 手机与桌面都不错位
- [ ] 走完一次发布并知道怎么回滚

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
