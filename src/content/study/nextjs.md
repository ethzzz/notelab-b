# Next.js 熟练路线 · 12 周（高级 → 资深前端）

> **给谁**：写过 React 页面、用过 Next 的路由和 `fetch`，但说不清「这一页到底在服务端还是客户端渲染、缓存什么时候失效」的前端。
> **终点**：L3 高级（部分触及 L4 资深）—— 能设计渲染与缓存策略、能划 RSC 边界、能做鉴权与多租户、能定性能预算与发布流程。
> **节奏**：每周 8–10 小时。每阶段有产出物与验收，没过不进下一阶段。

## 这条路线要把你带到哪

| 级别 | 叫法 | 能做什么 | 怎么算达到 |
|---|---|---|---|
| L1 | 会用 | 会建路由、会写页面、会调接口 | 独立加一个页面 |
| L2 | 能独立 | 会选渲染方式、会做三态与错误边界 | 交付一个可上线的多页应用 |
| **L3** | **高级（本路线终点）** | 设计缓存与失效策略、划 RSC 边界、做鉴权与多租户、定性能预算 | 通过文末 rubric |
| L4 | 资深 | 设计多应用架构/发布体系、解决框架级问题 | 本路线覆盖边界，需长期实战 |

**L3 的具体标志**：

- 给你一个页面，能说出它是静态、ISR 还是动态，以及为什么；
- 一次「改了内容但线上没变」，能在 5 分钟内定位到是哪一层缓存；
- 能判断一段逻辑该放服务端还是客户端，并说清代价；
- 能给出首屏预算，并用数据证明达标。

## 知识地图：五个域

| 域 | 高级要求 | 对应周 |
|---|---|---|
| 框架内核 | 文件约定、嵌套布局、RSC 与 Client 的边界 | 1–2 |
| 渲染与缓存 | 四层缓存、ISR、流式渲染、按需失效 | 3–4 |
| 数据与变更 | Route Handler、Server Action、乐观更新、幂等 | 5–6 |
| 鉴权与路由 | middleware、会话、多租户隔离、边缘限制 | 7–8 |
| 性能与交付 | Core Web Vitals、包分析、standalone 部署、灰度回滚 | 9–12 |

---

## 阶段一 · 框架内核（第 1–2 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L1 → L2 |
| 这一阶段解决 | 从「按文档拼页面」到「知道每个文件在什么时候执行」 |
| 核心知识 | `app/` 文件约定、嵌套布局、`"use client"` 边界、Server/Client 分工 |
| 场景项目 | 场景 #1：一个带嵌套布局的后台骨架（列表 + 详情 + 设置） |
| 离开时应该能 | 画出一次请求从 `layout` 到 `page` 的执行顺序，并指出哪些代码在服务端跑 |

### 第 1 周：文件约定与执行模型

**本周目标**：能不看文档画出一次请求里 `root layout → 段 layout → page` 的渲染与复用顺序，并把一个「整页都是客户端组件」的页面拆成服务端取数 + 叶子交互，用构建输出证明首屏 JS 变小。

**为什么是这些内容**

这一周是整条路线的地基。后面十一周要判断的每一件事——这一页该静态还是动态、数据该在哪取、这段代码会不会进浏览器包、缓存卡在哪一层——前提都是你能回答一个问题：**这段代码在构建期跑、在请求期跑，还是在浏览器里跑**。`app/` 目录的文件约定就是这套执行模型的入口：`layout` 决定谁常驻，`page` 决定谁随 URL 换，`"use client"` 决定哪棵子树被打包发到浏览器。

不学会的代价很具体。把 `"use client"` 贴在页面顶层，整页依赖进客户端包，服务端才有的模块被迫打桩，首屏 JS 直接翻倍；在布局里读 `pathname` 或查询参数，客户端导航时布局不重新渲染，面包屑和筛选条件永远停在第一次进入时的值；以为布局会随导航重跑，把「当前页」的状态塞进去，就会出现「点第二页还显示第一页」的诡异 bug。更隐蔽的是第三周要用的判断：如果不知道一个路由在 `next build` 时就已经渲染成静态 HTML，你会把「改了数据库页面没变」误判成缓存没失效，然后在错误的地方加 `revalidate`。

所以这周只做三件事：用三层嵌套路由把执行顺序打出来；把 RSC 与 Client 的边界收缩到叶子并量化收益；把 `params` / `searchParams` 在 15 之后的 Promise 语义和布局的能力边界钉死。做完你手上应该有一个「列表 / 详情 / 设置」的后台骨架，它也是阶段一场景项目的起点。

#### 步骤 1.1 用最小应用验证嵌套布局的执行顺序

建最小结构：根布局、`dashboard` 段布局、两个页面，每个组件体顶部写一行 `console.log`。**关键现象**：这些日志出现在跑 `next dev` 的终端里，不在浏览器控制台——因为布局和页面默认是服务端组件，`console.log` 在 Node 进程里执行。这是验证「代码在哪跑」最便宜的手段。

首次访问 `/dashboard/orders`，终端依次打印 root、dashboard、orders。从订单页点 `<Link>` 切到设置页，只多打印一行 settings：布局在客户端导航时**保持挂载**，React 只把 `children` 换成新的 page，布局的组件实例、状态、DOM 都不重建。硬刷新才会从根重来。

反过来也成立：如果每次点链接都打印三层，说明这几下是硬导航（用了原生 `<a>`、跨多个根布局，或者地址栏直接回车）。「为什么整页闪一下」这类问题，用这行日志就能分清是导航方式错了还是会话被重置了。

由此得到两条硬约束。第一，布局不能依赖「当前 URL」：它不重渲染，读到的路径名和查询参数会过期；要高亮菜单就放进客户端组件用 `usePathname()`，要读查询参数就放到 page 的 `searchParams` 或客户端的 `useSearchParams()`。第二，布局不能给 `children` 传数据（`children` 是已经构造好的元素），布局和页面都要用的数据只能在两边各取一次，靠 `fetch` 自动去重或 React 的 `cache()` 合并。

`template.tsx` 是这条规则的对照物：它和布局写法一样，但每次导航都重建实例。需要「进入页面就重置状态」时才用它，比如埋点、入场动画。

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log("[layout] root")
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}

// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  console.log("[layout] dashboard")
  return <section className="flex gap-6">{children}</section>
}

// app/dashboard/orders/page.tsx
export default function OrdersPage() {
  console.log("[page] orders")
  return <h1>订单列表</h1>
}

// app/dashboard/settings/page.tsx
export default function SettingsPage() {
  console.log("[page] settings")
  return <h1>设置</h1>
}
```

逐行看：根布局必须返回 `<html>` 和 `<body>`，这是硬性要求，缺了会在构建时报错；段布局只包一层 `<section>`，它会被复用到该段下所有页面；两个页面都是同步函数，因为它们不取数据，Next 会把它们预渲染成静态 HTML。`console.log` 一定要放在组件函数体里而不是 `useEffect` 里，否则只能在浏览器看到，而且客户端导航时反而重复打印，容易得出相反结论。

再补一个客户端导航条观察复用：

```tsx
// app/dashboard/nav.tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Nav() {
  const pathname = usePathname()   // 只在客户端组件里可用，导航后会更新
  return (
    <nav>
      <Link href="/dashboard/orders" data-active={pathname === "/dashboard/orders"}>订单</Link>
      <Link href="/dashboard/settings" data-active={pathname === "/dashboard/settings"}>设置</Link>
    </nav>
  )
}
```

把 `<Nav />` 放进 `dashboard/layout.tsx`：布局本身是服务端组件，但它可以渲染客户端组件；`usePathname` 读的是浏览器地址，所以高亮能跟着导航变——这正是「布局不重渲染」时仍然能感知 URL 的正确做法。

:::hint 布局只跑一次，日志看终端不看浏览器
`layout` 在客户端导航时保持挂载，只有 `page` 被替换；服务端组件的 `console.log` 打在跑 dev server 的终端里，浏览器控制台看不到。
:::

:::solution 参考目录
```text
app/
├── layout.tsx                    根布局：html / body
├── dashboard/
│   ├── layout.tsx                段布局：侧边栏 + children
│   ├── nav.tsx                   "use client"：usePathname 高亮
│   ├── orders/page.tsx
│   └── settings/page.tsx
```
:::

#### 步骤 1.2 划清 RSC 与 Client 的边界

现象：一个带搜索框的订单页，为了用 `useState`，在文件第一行写了 `"use client"`。功能正常，但 `next build` 的路由表里这条路由的 First Load JS 明显高于隔壁纯静态页，而且 `db` / ORM 的 import 也被拖进浏览器包——服务端模块在浏览器里没有 `fs`、没有数据库连接，轻则报错，重则把连接串打进产物。

原理：`"use client"` 不是「只在浏览器跑」，而是**声明一条边界**：该文件以及它 import 的所有模块都进入客户端包，并在浏览器 hydrate。它仍然会在服务端预渲染出 HTML（所以首屏不是空白），因此 `useState` 的初始值必须两侧一致，`window`、`localStorage` 只能在 `useEffect` 里碰。

正确做法是把交互收缩成叶子：页面保持服务端组件，直接 `await` 数据；只有需要状态的那一小块标 `"use client"`，通过 props 拿它需要的字符串或 id，而不是整张表的数据。

```tsx
// ❌ 整页进客户端包：db、表格、搜索框全被打包
"use client"
export default function Page() {
  const [q, setQ] = useState("")
  return <><SearchBar value={q} onChange={setQ} /><BigTable /></>
}
```

```tsx
// ✅ 页面留在服务端取数，只有输入框是客户端组件
// app/orders/page.tsx
import { db } from "@/lib/db"
import { SearchBox } from "./search-box"
import { BigTable } from "./big-table"

export default async function Page() {
  const rows = await db.order.findMany()   // 只在服务端执行，不进浏览器包
  return (
    <>
      <SearchBox />                         {/* 客户端叶子 */}
      <BigTable rows={rows} />              {/* 服务端组件，rows 作为 props 序列化过去 */}
    </>
  )
}
```

```tsx
// app/orders/search-box.tsx
"use client"
import { useState } from "react"

export function SearchBox() {
  const [q, setQ] = useState("")
  return <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索订单号" />
}
```

跨边界的 props 必须可序列化：普通对象、数组、字符串、数字、`Date`、`Map`、`Set` 可以，类实例和普通函数不行（Server Action 除外）。所以 `BigTable` 拿到的 `rows` 要是纯数据对象；如果 ORM 返回带方法的实体，先在服务端 `map` 成普通对象再传。

反方向还有个容易忽略的坑：一旦某个文件标了 `"use client"`，它 import 进来的组件（哪怕没写指令）也会被当成客户端组件打包，服务端执行的机会就没了。所以边界要画在「叶子」，不要画在「容器」；判断标准很简单——这个文件里有没有 `useState`、事件处理、浏览器 API，没有就别加指令。

量化方法：拆分前后各跑一次 `next build`，比较该路由的 First Load JS；或在浏览器 Network 面板看首次加载的 JS 总量。数字记下来，第 9 周做性能预算时它就是基线。

:::hint 边界越低，包越小
`"use client"` 会让整棵子树进客户端包。把交互收缩到叶子，数据留在服务端取，交互组件只拿它真正需要的那点数据。
:::

:::solution 边界画在哪一层
```text
app/orders/
├── page.tsx        无指令 = 服务端组件：await db，把纯数据作为 props 传下去
├── search-box.tsx  "use client"：只有 useState + onChange
└── big-table.tsx   无指令 = 服务端组件：只接收可序列化的 rows
```
```bash
# 量化：拆分前后各跑一次，比同一个路由的 First Load JS
npx next build 2>&1 | grep -E '/orders'
# 再在浏览器 Network 里按 JS 过滤看首次加载总量；两个数字都记下，第 9 周当基线
```
:::

:::error 把函数或类实例传给客户端组件
```text
Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
Only plain objects can be passed to Client Components from Server Components. Classes or other objects with methods are not supported.
```
根因：服务端到客户端的 props 走序列化，函数和类实例过不去。修法有三种：在服务端把数据转成普通对象；把回调改成 Server Action（文件顶部 `"use server"`）；或者把需要交互的部分整体挪进客户端组件，让它在客户端自己取数。
:::

#### 步骤 1.3 params 与 searchParams 的 Promise 语义

15 之前，页面签名是 `{ params }: { params: { slug: string } }`，直接 `params.slug`。从 15 起这两个 prop 都变成 `Promise`，因为它们可能要在流式渲染中延迟解析。照旧写 `params.slug` 不会报编译错误：Promise 上没有 `slug` 这个属性，页面就渲染成 `undefined`；如果这段代码在客户端组件里，控制台还会提示 `params` 必须先 unwrap。

正确写法是页面函数声明成 `async`，先 `await params`。`generateMetadata` 同样收到 Promise。`searchParams` 也是 Promise，且它的值可能是 `string | string[] | undefined`——同名参数出现两次就是数组，直接当字符串用会拿到数组。

第三个坑是能力边界：**布局收得到 `params`，收不到 `searchParams`，也拿不到路径名**。原因还是 1.1 那条——布局不随导航重渲染，给它这些值只会变成过期数据。查询参数要放在 page 里读，或者放进客户端组件用 `useSearchParams()`。

不过 `useSearchParams()` 也有代价：在没有动态段的静态路由上，它会让这段 UI 推迟到客户端渲染，通常要用 `<Suspense>` 包一层才不会让整页退出预渲染。所以顺序是：能放 page 的 `searchParams` 就不要往组件深处塞 Hook。

```tsx
// app/posts/[slug]/page.tsx
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

export default async function PostPage({ params, searchParams }: Props) {
  const { slug } = await params              // 必须 await
  const { tab } = await searchParams         // 可能是 string[]
  console.log("[page] post", slug, tab)
  return <article data-slug={slug}>当前文章：{slug}</article>
}
```

访问 `/posts/hello?tab=a&tab=b`，终端打印 `[page] post hello [ 'a', 'b' ]`，页面显示 hello；访问 `/posts` 命中 404，因为没有对应的动态段。如果这时你在 `app/posts/[slug]/layout.tsx` 里写 `useSearchParams()`，会直接编译失败，因为那是客户端 Hook，服务端组件不能 import——这条报错本身就是「边界放错」的最好提示。

:::hint 先 await，再取值
`params` / `searchParams` 在 15 之后都是 Promise，`await` 一次拿到普通对象再用。布局只拿 `params`，查询参数和路径名留给 page 或客户端组件。
:::

:::solution 三个 prop 的正确取法
```tsx
// app/posts/[slug]/layout.tsx —— 布局只收 params，收不到 searchParams，也拿不到路径名
export default async function PostLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <>
      <aside data-slug={slug}>目录</aside>
      {children}
    </>
  )
}
```
```tsx
// generateMetadata 同样收到 Promise，别写成 params.slug
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `文章 ${slug}` }
}
```
```bash
# 数组型 searchParams 与 404 各验一次
curl -s "localhost:3000/posts/hello?tab=a&tab=b" | grep -o 'data-slug="hello"'   # 应命中
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/posts                     # 404
```
要在布局之外跟着导航高亮当前路径，正确做法是放进客户端组件用 `usePathname()`。
:::

**自测**（合上文档回答）

1. 从 `/dashboard/orders` 点 `<Link>` 到 `/dashboard/settings`，终端会新增哪几行日志？为什么 dashboard 布局那行不再出现？
2. 在 `app/orders/page.tsx` 顶部加 `"use client"` 后，`db.order.findMany()` 会在哪里执行？首屏 JS 会怎么变？
3. 为什么 `app/posts/[slug]/layout.tsx` 里不能读 `searchParams`？要在布局里高亮当前路径，正确做法是什么？

**验收**

- [ ] `next dev` 访问 `/dashboard/orders`，终端顺序为 root → dashboard → orders；点导航到设置页只新增 settings 一行
- [ ] `next build` 输出里，拆分后的订单页 First Load JS 小于拆分前，两个数字都记录下来
- [ ] `/posts/hello?tab=a&tab=b` 页面显示 hello，终端打印 slug 与数组形式的 tab；`/posts` 返回 404
- [ ] 在布局里 import `useSearchParams` 会编译失败（保留报错原文）

---

### 第 2 周：边界与并行路由

**本周目标**：给同一组页面加上「慢 / 错 / 不存在」三种边界，并做出「点击是弹窗、刷新是整页」的详情路由；每条行为都能用 `curl` 的状态码或页面动作自己验证。

**为什么是这些内容**

第 1 周解决了「谁在什么时候跑」，这一周解决「跑失败、跑得慢、目标不存在时，界面归谁管」。App Router 把这三件事各给了一个文件约定：`loading.tsx` 管慢、`error.tsx` 管错、`not-found.tsx` 管不存在。它们不是三个可选组件，而是画在**路由段**上的三条边界，位置放错就会失效——把 `error.tsx` 放进错误的层级，子页面的错误会一路冒到根；把 `loading.tsx` 放到有慢布局的同级，骨架永远不会出现。

不学会的代价很直接。一个接口超时，用户看到整页白屏而不是局部骨架；`error.tsx` 忘了写 `"use client"`，构建直接失败；`notFound()` 触发的 404 在流式响应里变成 200，被搜索引擎当成正常页收录（soft 404）；弹窗用 `useState` 实现，刷新就丢、链接发不出去、后退关不掉。更大的问题是后面几周都建在这层结构上：局部加载、按需失效后的重渲染、拦截式登录弹窗、性能优化里的首屏外壳，全都要求你能准确说出「这条边界覆盖到哪一层」。

并行路由是这周的另一半。它让你在同一个 URL 上同时渲染两份 UI，配合 `(.)` 拦截就能做出「站内点击弹窗、直接访问整页」的效果——这是 Next 里少数同时满足体验和可分享性的方案，也是后面做登录弹窗、详情侧栏的标准手法。它的坑集中在刷新：缺少 `default.tsx` 时，硬导航直接 404。

产出是一个 posts 列表 + 详情页，加三个边界文件和一个 `@modal` 插槽；再补一个可用 URL 切换状态的探针页，把「状态码什么时候被固定」这件事亲手测一遍。

#### 步骤 2.1 loading / error / not-found 三件套

三个文件放在**同一个路由段**里，各管一种失败。先把管辖范围记准，再写代码。

`loading.tsx` 会被自动包成一个 `<Suspense>`，覆盖同段的 `page`、`not-found` 和更下层的布局，但**不覆盖同段的 `layout`、`template`、`error`**。它默认是服务端组件，骨架本身会被预取，所以导航时能立刻出现。要点是：布局里如果有 `await cookies()` 或未缓存的取数，导航会一直卡到布局渲染完，骨架根本不出现；正确做法是把慢取数下沉到 page，或在布局里自己包 `<Suspense>`。

`error.tsx` 必须是客户端组件，它包住同段的 `loading`、`not-found`、`page` 和下层布局，但**包不住与它同段的 `layout`**（布局在它外层）——根布局出错要靠 `app/global-error.tsx`，那个文件得自己输出 `<html>` 和 `<body>`。它只接渲染期抛出的错误，按钮 `onClick` 里的异常接不住。生产环境里服务端错误的 `message` 会被替换成通用文案，真正能对上日志的是 `error.digest`。

`not-found.tsx` 不接受任何 props，由 `notFound()` 触发；根目录那份还负责兜住所有未匹配的 URL。状态码取决于是不是已经开始流式输出，这一点 2.3 会实测。

根布局自己的异常只能交给 `app/global-error.tsx`：它替换掉根布局，所以必须自带 `<html>`、`<body>` 和样式；也因为它必须是客户端组件，`metadata` 导出在里面不生效，标题只能靠 React 的 `<title>` 元素。这个文件不常写，但线上「整站白屏」时它是最后一道能显示东西的兜底。

```tsx
// app/probe/loading.tsx
export default function Loading() {
  return <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
}

// app/probe/error.tsx
"use client"
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <p>出错了：{error.message}</p>
      <p>排障编号：{error.digest ?? "无"}</p>
      <button onClick={() => reset()}>重试</button>
    </div>
  )
}

// app/probe/not-found.tsx
export default function NotFound() {
  return <p>没有这个页面</p>
}
```

逐行看：`error.tsx` 顶部的 `"use client"` 是硬性要求，缺了会在构建时报 “Error components must be Client Components”；`reset()` 会清掉错误状态并重新渲染这段子树，但不会重新取数——16.3 起还提供了 `retry()`，语义是重新取数再渲染，想真的恢复数据就用它。`error.digest` 在开发环境可能为空，生产环境才有值，所以展示时要兜底。

:::hint 三个文件解决三种失败
`loading` 管慢、`error` 管错、`not-found` 管不存在；三者都只覆盖**本段及其下层**，同段上方的布局不在管辖内。
:::

:::solution 三个文件各自的位置与覆盖面
```text
app/
├── global-error.tsx   "use client" + 自带 <html>/<body>：根布局自己抛错时的兜底
└── probe/
    ├── layout.tsx
    ├── loading.tsx    盖 page / not-found / 下层布局；不盖同段 layout / error
    ├── error.tsx      "use client"：盖 loading / not-found / page；不盖同段 layout
    ├── not-found.tsx  由 notFound() 触发，不接 props
    └── page.tsx
```
```tsx
// app/global-error.tsx —— 唯一必须自己输出 <html>/<body> 的错误边界
"use client"
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh">
      <body>
        <h1>整站出错</h1>
        <p>排障编号：{error.digest ?? "无"}</p>
        <button onClick={() => reset()}>重试</button>
      </body>
    </html>
  )
}
```
:::

#### 步骤 2.2 并行路由做弹窗

目标：`/posts` 列表点进 `/posts/1` 时详情以弹窗出现，地址栏同步变化；直接刷新 `/posts/1` 或把链接发给别人，打开的是整页详情。

结构上需要一个插槽 `@modal` 和一个被拦截的路由。插槽用 `@文件夹` 声明，它**不是路由段**，不影响 URL；父布局会多收到一个同名 prop。`(.)` 表示拦截「同一层」的路由段，因为 `@modal` 不算段，所以 `app/@modal/(.)posts/[id]/page.tsx` 拦的正是根级的 `posts/[id]`。

硬导航时，Next 无法知道这个插槽原本该显示什么，会去找 `@modal/default.tsx`；没有这个文件，刷新就直接 404。默认导出返回 `null` 即可。关闭弹窗用 `router.back()`，或者点遮罩后跳到别的路由——但客户端导航到不匹配插槽的地址时，插槽内容会**保留**，所以还要一个 catch-all 插槽页返回 `null` 把它收掉。

```text
app/
├── layout.tsx                    接收 children 与 modal 两个插槽
├── @modal/
│   ├── default.tsx               硬导航时渲染 null，缺了会 404
│   ├── (.)posts/[id]/page.tsx    站内跳转时的弹窗
│   └── [...catchAll]/page.tsx    跳到其它路由时把弹窗收掉
├── posts/page.tsx                列表
└── posts/[id]/page.tsx           直接访问时的整页
```

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}

// app/@modal/(.)posts/[id]/page.tsx
import { Modal } from "@/components/modal"
import PostDetail from "@/app/posts/[id]/page"

export default async function InterceptedPost({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Modal>
      <PostDetail params={params} />   {/* 弹窗里复用整页的渲染逻辑 */}
    </Modal>
  )
}
```

关键点是弹窗页和整页共享同一份渲染逻辑：`InterceptedPost` 把 `params` 透传给详情组件，外面只多包一层 `<Modal>`。如果两边各写一份，迟早会出现「弹窗里有作者信息、整页没有」这种漂移。注意 `params` 是 Promise（第 1 周），这里原样透传、由详情组件自己 `await`，不要在两处各解一次。

关闭要利用浏览器历史，而不是自己维护一个 `open` 状态。`router.back()` 回到列表，浏览器的后退键也自然变成「关闭弹窗」——因为弹窗本来就是历史里的一步。自己用状态控制的弹窗做不到这一点：后退会直接离开列表页，用户莫名其妙丢掉上下文。

还有一个安全提醒：布局里做条件渲染并不能阻止插槽执行。两个插槽都会在服务端渲染，`layout` 里写 `role === "admin" ? admin : user` 只决定用户**看到**哪个，`@admin` 里的取数照跑，结果也会进响应。权限必须写进每个插槽自己的页面或数据访问层。

:::hint `(.)` 按路由段算，`@slot` 不算段
`app/@modal/(.)posts/[id]` 拦的是根级 `posts/[id]`；`@modal` 只是插槽，不进 URL。硬导航缺 `default.tsx` 就是 404。
:::

:::solution 两个必补文件与验收口径
```tsx
// app/@modal/default.tsx —— 硬导航时渲染 null，缺了它刷新就是 404
export default function Default() {
  return null
}

// app/@modal/[...catchAll]/page.tsx —— 导航到不匹配插槽的地址时把弹窗收掉
export default function CatchAll() {
  return null
}
```
```bash
# 硬导航应是整页详情（200），既不是弹窗也不是 404
curl -s -o /dev/null -w 'hard   %{http_code}\n' localhost:3000/posts/1
# 临时移走 default.tsx 再 build，同一 URL 应变成 404（验完记得移回）
mv app/@modal/default.tsx /tmp/ && npx next build
curl -s -o /dev/null -w 'no-def %{http_code}\n' localhost:3000/posts/1
mv /tmp/default.tsx app/@modal/
```
:::

:::error 刷新详情页变成 404
```text
404 | This page could not be found.
```
根因：`@modal` 插槽在硬导航时找不到匹配的子页，又没有 `default.tsx` 兜底。补一个 `export default function Default() { return null }` 即可。另外要记住同一层插槽的渲染模式必须一致：某个插槽用了动态 API，同层其它插槽也得动态渲染，否则构建会报错。
:::

#### 步骤 2.3 用探针页实测：状态码是什么时候被固定的

这一节把前两步的现象变成可复现的实验。建一个 `/probe` 页，用查询参数切三种状态；关键是每个分支都先等一会儿再抛，这样「外壳是否已经流出去」才是可控变量。

```tsx
// app/probe/page.tsx
import { Suspense } from "react"
import { notFound } from "next/navigation"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function ProbePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  if (mode === "boom") {
    await sleep(1500)          // 先让外壳有机会流出去
    throw new Error("probe boom")
  }
  if (mode === "missing") {
    await sleep(1000)
    notFound()
  }
  return (
    <main>
      <h1>探针</h1>
      {mode === "slow" ? (
        <Suspense fallback={<p>加载中…</p>}>
          <Slow />
        </Suspense>
      ) : (
        <p>mode: {mode ?? "ok"}</p>
      )}
    </main>
  )
}

async function Slow() {
  await sleep(3000)
  return <p>慢数据到了</p>
}
```

观察方法用 `curl`，别用浏览器：浏览器会等页面稳定，看不出首字节。`curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}\n" "http://localhost:3000/probe?mode=slow"` 会告诉你状态码和首字节时间。`slow` 分支的 TTFB 应该在几百毫秒内，因为它只等外壳；3 秒是 Suspense 里那个组件的事。

`boom` 和 `missing` 各跑两次：一次带 `app/probe/loading.tsx`，一次临时删掉它。带 loading 时，外壳（含骨架）先发出，响应头已经写成 200，之后抛错或 404 只能改渲染内容——所以状态码仍是 200，页面里出现 `error.tsx` 的文案或 `not-found.tsx` 的文案，Next 会给 404 的流式响应补一个 `noindex`。删掉 loading 后，异常发生在任何字节发出之前，状态码才是真正的 500 或 404。

这就是「软 404」的由来：页面内容是对的，状态码是 200。对爬虫和监控来说这是两种不同的失败。同一个机制也会骗过探活脚本——只看状态码的检查会把这类页面算成正常，所以验收必须同时看状态码和页面里到底渲染了什么。

:::hint 状态码在流开始时就被定死
一旦骨架或任何 Suspense fallback 开始输出，响应头就发出去了；之后再 `notFound()` 或抛错，只能换内容，改不了状态码。
:::

:::solution 把四组对照一次跑完
```bash
# 先 next build && next start；在 Git Bash / WSL 里跑，dev 模式会干扰流式时序
B=http://localhost:3000/probe

# 1) 慢但外壳先出：TTFB 应远小于 3s
curl -s -o /dev/null -w "slow  %{http_code} %{time_starttransfer}\n" "$B?mode=slow"

# 2) 带 loading.tsx：异常发生在流开始之后 → 200
curl -s -o /dev/null -w "boom+loading  %{http_code}\n" "$B?mode=boom"
# 错误 UI 由客户端在流结束后渲染，curl 拿到的 HTML 里可能只有骨架；
# 用浏览器打开同一 URL，把页面上的 digest 和终端日志里的 digest 对上

# 3) 删掉 app/probe/loading.tsx 并重新 build 后：500 / 404
curl -s -o /dev/null -w "boom-no-loading  %{http_code}\n" "$B?mode=boom"
curl -s -o /dev/null -w "missing-no-loading  %{http_code}\n" "$B?mode=missing"

# 4) 恢复 loading.tsx 后：404 变 200，且带 noindex
curl -s "$B?mode=missing" | grep -c 'content="noindex"'
```
:::

**自测**（合上文档回答）

1. `error.tsx` 接不住哪两类错误？根布局自己抛错时该由哪个文件接？
2. 点列表进入 `/posts/1` 是弹窗，刷新同一 URL 却是整页，这是哪两个约定在起作用？删掉 `@modal/default.tsx` 会怎样？
3. 同一个 `notFound()`，什么时候返回 404，什么时候返回 200？`noindex` 是谁加的？

**验收**

- [ ] `/probe?mode=slow` 的 `time_starttransfer` 小于 500ms，页面先出现「加载中…」，约 3 秒后变成「慢数据到了」
- [ ] `/probe?mode=boom`（带 loading）`curl` 得到 200，页面显示自定义错误文案与 digest，终端日志能搜到同一串 digest
- [ ] 临时删掉 `app/probe/loading.tsx` 后，同一个 `boom` URL 变成 500，`missing` 变成 404；恢复文件后回到 200
- [ ] 带 loading 的 `missing` 响应里能搜到 `name="robots"` 与 `noindex`
- [ ] 点列表进入 `/posts/1` 出现弹窗且地址栏变化；刷新同一 URL 显示整页；删掉 `@modal/default.tsx` 后刷新 `/posts` 得到 404

---

## 阶段二 · 渲染与缓存（第 3–4 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从「默认就好」到「每一层缓存都心里有数」 |
| 核心知识 | 四层缓存、ISR、`revalidateTag`、流式渲染、动态化的触发条件 |
| 场景项目 | 场景 #2：内容站的按需失效（CMS 改了立刻可见） |
| 离开时应该能 | 定位「内容没更新」是哪一层缓存，并说出为什么 |

### 第 3 周：缓存四层与流式渲染

**本周目标**：面对一个「改了内容、页面没变」的页面，能按请求记忆化、数据缓存、全路由缓存、客户端路由缓存逐层排除并说出每层的开关；同时把慢接口移出首字节的关键路径，用 `curl` 的前后数字证明。

**为什么是这些内容**

前两周解决「代码在哪跑」，这一周解决「跑出来的结果被谁记住了」。Next 的缓存不是一层，而是四层叠在一起：同一次渲染里的重复请求、`fetch` 的数据缓存、整条路由预渲染出来的 HTML、浏览器里已访问页面的 RSC payload。它们各有各的失效条件，所以「改完不生效」几乎永远不是「Next 有 bug」，而是某层的开关没动。

不学会的后果是排障全靠重启。改一条数据库记录，刷新页面没变，于是重新构建、重新部署——其实页面是构建期就渲染好的静态 HTML，重启当然没用；反过来，以为 `fetch` 默认会缓存，给不该缓存的接口加了 `force-cache`，用户看到的库存永远是昨天的。更常见的是把 `revalidate` 加在错误的层级：写在布局上，以为能绕过子页面 `fetch` 自己的缓存；或者反过来，只给 `fetch` 配了寿命，以为整条路由会跟着变。还有人只在 `next dev` 里观察缓存——开发模式每次都按需渲染、不写缓存，你永远看不到真实行为，必须 `next build && next start`。

第四层最容易被忽略：它在你自己的浏览器里。点了链接再点回来，页面没有重新请求，因为客户端路由缓存直接复用了之前的 RSC payload。不会区分软导航和硬刷新，就会把「浏览器缓存」当成「服务端缓存」，在服务端改半天没有效果。

这周建立的模型直接服务第 4 周的按需失效和第 9 周的性能预算：前者要决定失效哪一层，后者要知道首屏省下来的是哪一段。产出是一份四层实验记录（谁在挡、怎么放开）和一组 TTFB 前后对比。

#### 步骤 3.1 把四层缓存画出来

按「离请求由近到远」排：① 请求记忆化——同一次渲染里对同一 URL 的重复 `fetch` 只发一次；不用 `fetch` 而直接查 ORM 时，用 React 的 `cache()` 包住取数函数才有同样效果。② 数据缓存——`fetch` 的结果按 URL 与选项存起来，`{ cache: "force-cache" }` 或 `{ next: { revalidate: 60, tags: ["posts"] } }` 才会进；注意 15 起 `fetch` **默认不缓存**，不写选项的请求在请求期每次都发。③ 全路由缓存——没有动态 API、数据又都能在构建期拿到的路由，会在 `next build` 时渲染成静态 HTML 与 RSC payload，请求期不再执行你的组件。④ 客户端路由缓存——`<Link>` 预取和已访问页面存在浏览器里，`experimental.staleTimes` 的 `dynamic` 默认 0 秒、`static` 默认 300 秒。

最容易混的是 ② 和 ③ 的关系：路由是静态的时候，请求根本到不了 `fetch`，所以「`fetch` 默认不缓存」并不等于「页面每次都是新的」。要观察到 ②，得先让 ③ 过期。

16 还多了一种写法：开 `cacheComponents` 后，用 `"use cache"` 标记函数或组件，再用 `cacheLife("hours")` 给寿命、`cacheTag("posts")` 打标签；它仍属于 ② 这一层，只是把「缓存什么」从 `fetch` 选项挪到了代码里的指令。

实验：给页面加 `revalidate = 10`，再让 `fetch` 缓存 60 秒。改数据库后观察两次刷新。

```tsx
// app/posts/page.tsx
export const revalidate = 10          // ③：整条路由最多复用 10 秒

export default async function PostsPage() {
  console.log("[render] /posts", new Date().toISOString())   // 真正渲染才打印

  const res = await fetch(`${process.env.API_BASE}/posts`, {
    next: { revalidate: 60, tags: ["posts"] },               // ②：数据最多复用 60 秒
  })
  const posts = await res.json()
  return <ul>{posts.map((p: { id: string; title: string }) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

预期日志与现象：

```text
改完 DB 立刻刷新：终端没有 [render]，页面是旧值        → 卡在 ③
等 10 秒再刷新：终端打印 [render]，页面还是旧值        → ③ 已过期，卡在 ②
把 fetch 的 revalidate 改成 10（或调按需失效接口）：打印且变新
```

`console.log` 的位置决定了它的诊断价值：放在组件体里，它只在服务端真正渲染这条路由时打印，所以「没打印」等于「这次请求没进你的代码」，可以直接判定为 ③。放在 `useEffect` 里就完全失去这个作用。

构建输出是第二把尺子：`next build` 的路由表会给每条路由标符号，`○` 是静态、`ƒ` 是动态、`◐` 是部分预渲染（以你那次构建打印的图例为准）。符号是 `○` 又没配 `revalidate`，就默认它会在请求期复用构建产物。

:::hint 先看构建输出，再谈缓存
`○` 的路由在请求期不执行你的组件；先确认这一点，再去调 `fetch` 的选项，否则永远在错的层上改。
:::

:::solution 四层对照表
```text
层  是什么                                 开关 / 失效方式                          怎么观察
①   请求记忆化：同一次渲染同 URL 只发一次    React cache()（不用 fetch 取数时）        同一渲染里两次调用只打一行日志
②   数据缓存：fetch 结果按 URL + 选项存     next.revalidate / next.tags / no-store   终端打印 [render] 但数据是旧的
③   全路由缓存：构建期产出的 HTML + RSC     段级 revalidate / 动态 API / force-dynamic 终端没有 [render]
④   客户端路由缓存：浏览器里的 RSC payload  experimental.staleTimes / 硬刷新       curl 拿到新内容、浏览器还是旧的
```
```bash
# 先分清 ③：○ 静态 / ƒ 动态 / ◐ 部分预渲染
npx next build 2>&1 | grep -E '(○|ƒ|◐) /'
```
:::

#### 步骤 3.2 流式渲染：先出骨架，再出数据

流式的目标不是「让数据变快」，而是「让用户更早看到东西」。App Router 把一次渲染拆成外壳和若干 Suspense 段：外壳先作为响应体发出去，慢组件的 RSC payload 到了再补进同一个响应。所以 TTFB 只等于外壳的时间，跟慢接口无关。

前提有两个。第一，慢数据必须下沉到 `<Suspense>` 里面的子组件；页面顶层 `await` 会把这个响应拖住，包多少层 Suspense 都没用。第二，路由本身要是动态的——静态路由在构建期就把所有数据取完、直接产出完整 HTML，根本没有「先发外壳」这回事。做实验时加 `export const dynamic = "force-dynamic"`，或在页面里读一次 `cookies()`。

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react"

export const dynamic = "force-dynamic"   // 让请求期真的走流式，而不是构建期一次性渲染

export default function Dashboard() {
  return (
    <main>
      <h1>仪表盘</h1>
      <Suspense fallback={<p>统计加载中…</p>}>
        <SlowStats />          {/* 内部 await 一个 3 秒的接口 */}
      </Suspense>
      <Suspense fallback={<p>列表加载中…</p>}>
        <SlowList />
      </Suspense>
    </main>
  )
}

async function SlowStats() {
  const stats = await fetchStats()   // 慢
  return <Stats data={stats} />
}
```

对照写法只有一个区别：把 `await fetchStats()` 提到 `Dashboard` 函数体里。这时外壳里已经包含了「等数据」这件事，响应要等 3 秒才开始发，Suspense 的 fallback 也不会出现——因为父组件都没渲染完，根本没有 fallback 可发。

`loading.tsx` 其实就是「整个段自动包一层 Suspense」，区别是它的 fallback 会在导航开始时立刻显示；而手写的 `<Suspense>` 可以一个页面里放好几个，让快区块先亮、慢区块各自补。两者可以叠加，但要注意第 2 周那条规则：它们都盖不住同段布局里的慢取数。

测量用两条命令：`curl -s -o /dev/null -w "%{time_starttransfer}\n"` 看首字节，再在浏览器 Network 面板看文档请求的响应曲线——流式响应会显示「内容逐步到达」，而不是等 3 秒一次性出现。注意 TTFB 变小不等于页面变快：完整内容仍然要等 3 秒，变快的是「用户看到骨架」和「浏览器可以开始加载资源」的时间点。

:::hint 流式的前提是「外壳先返回」
页面顶层 `await` 慢数据，外壳就要等；必须把慢的部分下沉到 Suspense 内的子组件，流式才有东西可流。
:::

:::solution 用 TTFB 证明「骨架先到」
```bash
# 1) force-dynamic + 慢数据下沉到 Suspense 子组件：TTFB 只等外壳
curl -s -o /dev/null -w 'ttfb %{time_starttransfer}\n' localhost:3000/dashboard

# 2) 把 await fetchStats() 提到 Dashboard 函数体，同一命令再跑：TTFB 涨到 3s 量级

# 3) 加 -N 关掉缓冲，能看到外壳与补充块分批到达
curl -sN localhost:3000/dashboard | head -c 400
```
对照结论：TTFB 从 3s 量级掉到几百毫秒，但「完整内容」的时间不变——Suspense 换的是用户看到东西的时间，不是接口变快。
:::

#### 步骤 3.3 改了不生效：按四层顺序排查

排查顺序比记住 API 更有用。

第一步，硬刷新（Ctrl+Shift+R）或用 `curl` 直接打页面，排除 ④。如果 `curl` 拿到新内容而浏览器没有，问题在客户端路由缓存或浏览器缓存，不在服务端。

第二步，看服务端日志有没有 `[render]`。没有打印，说明请求没进组件，卡在 ③：路由被预渲染了，检查构建符号、`revalidate` 和有没有动态 API。

第三步，日志打印了但数据旧，卡在 ②：看 `fetch` 的 `cache` / `next.revalidate` / `next.tags`，以及有没有 `unstable_cache` 或 `"use cache"` 把结果兜住。临时改成 `{ cache: "no-store" }`，立刻变新就确认是这一层。

第四步，同一页面里两处取数结果不一致，才是 ① 的问题：用 React `cache()` 去重，或确认两次调用参数完全一致。

修复手段分两类。时间驱动：`export const revalidate = 60`（整条路由）或 `fetch` 的 `next.revalidate`（单次数据）。事件驱动：在 Server Action 或 Route Handler 里调 `revalidatePath` / `revalidateTag`。16 起 `revalidateTag` 的类型要求第二个参数：`"max"` 表示先给旧内容、后台再换；`{ expire: 0 }` 表示下一次请求阻塞等新值，适合 webhook 这种「必须立刻可见」的场景。Server Action 里想让提交者马上看到自己的写入，用 `updateTag(tag)` 更直接。

```ts
// app/api/flush/route.ts
import { revalidatePath, revalidateTag } from "next/cache"

export async function POST(req: Request) {
  const { path, tag } = await req.json()
  if (tag) revalidateTag(tag, "max")     // 先旧后新；要立刻可见改成 { expire: 0 }
  if (path) revalidatePath(path)         // 按路径失效，适合列表/详情一起刷
  return Response.json({ ok: true })
}
```

```ts
// next.config.ts —— 调客户端路由缓存（第 ④ 层）
const nextConfig = {
  experimental: { staleTimes: { dynamic: 0, static: 300 } },
}
export default nextConfig
```

要看清每一步到底命中了哪层，用 `NEXT_PRIVATE_DEBUG_CACHE=1 npm run start` 启动，缓存读写会打进日志；它同时覆盖 ISR 与数据缓存。

:::hint 四层由外向内排，先排掉最外层
先硬刷新或用 `curl` 排掉 ④，再看终端有没有 `[render]` 排掉 ③，然后才查 ② 的 `fetch` 选项，最后才是 ① 的重复取数。顺序反了就会在错的层上改半天。
:::

:::solution 一条命令链复现「谁在挡」
```bash
# 1) 生产模式复现（另开一个终端；dev 每次都渲染，看不出缓存）
npm run build && npm run start

# 2) 连续请求两次，数终端里的 [render]：只有一行 → ③ 命中
curl -s -o /dev/null localhost:3000/posts
curl -s -o /dev/null localhost:3000/posts

# 3) 按 tag 失效；"max" 是先旧后新，所以连打两次
curl -s -X POST localhost:3000/api/flush \
  -H 'content-type: application/json' -d '{"tag":"posts"}'
curl -s -o /dev/null localhost:3000/posts
curl -s localhost:3000/posts | grep -c '新标题'   # 第二次应为 1
```
把这三段固化成脚本，每次改缓存逻辑先跑一遍，比在浏览器里反复刷新可靠。
:::

:::error revalidateTag 只传了一个参数
```text
Expected 2 arguments, but got 1.
```
根因：16 起 `revalidateTag` 的签名是 `(tag, profile)`，第二个参数决定旧内容还能被发多久；单参形式已废弃，用 `@ts-expect-error` 压掉也只是暂时能用。修法：普通失效写 `revalidateTag(tag, "max")`，要立刻可见写 `revalidateTag(tag, { expire: 0 })`；Server Action 里想让提交者马上看到写入，改用 `updateTag(tag)`。
:::

**自测**（合上文档回答）

1. 15 之后 `fetch` 默认缓存吗？什么写法才会真的进入数据缓存？静态路由下为什么观察不到这一层？
2. 页面组件里的 `console.log` 在请求时没有打印，说明卡在哪一层？下一步该查什么？
3. 页面顶层 `await` 慢接口时，为什么在外面包 `<Suspense>` 也降不下 TTFB？

**验收**

- [ ] 记录 `next build` 输出里 `/posts` 与 `/dashboard` 的符号（`○` / `ƒ` / `◐`），并说明各自原因
- [ ] 改一条 DB 记录后：10 秒内刷新终端无 `[render]`；10 秒后刷新有 `[render]` 但数据仍旧；把 `fetch` 的 `revalidate` 改小后数据更新（三条记录）
- [ ] `/dashboard` 的 `time_starttransfer` 小于 500ms，且 Network 面板能看到骨架先出现、3 秒后内容补上
- [ ] `POST /api/flush` 传 `{"tag":"posts"}` 后连续请求两次，第二次返回新内容，不需要重新部署
- [ ] 把 `flush` 里的 `"max"` 换成 `{ expire: 0 }` 后，失效后的第一次请求就是新内容（对比两次结果）
- [ ] 给 `/posts` 临时加 `export const dynamic = "force-dynamic"` 后，每次请求都打印 `[render]`（反证之前卡在 ③）

---

### 第 4 周：按需失效

**本周目标**：CMS 改一篇文章，调一次 webhook 后刷新页面 1 秒内看到新正文，并且能说清这次失效落在四层缓存的哪一层。

**为什么是这些内容**：第 3 周把四层缓存画了出来——请求记忆化、数据缓存、全路由缓存、客户端路由缓存。那一周解决「为什么会看到旧内容」，这一周解决「怎么让新内容立刻出现」。两件事必须连着学：只会诊断不会失效，线上就只剩两条笨办法，要么把 `revalidate` 调到 0（等于关缓存，首屏从 CDN 退化成每次回源），要么每次发文都重新构建部署（一天发二十篇就构建二十次）。反过来，只会失效不会诊断，就会出现「我明明调了 `revalidateTag` 怎么没变」——卡住的那一层根本不是数据缓存，而是全路由缓存或浏览器里的客户端路由缓存。按需失效是场景 #2 内容站的核心能力，也是第 5 周的前置：Server Action 写完库之后要做的那一步，就是本周这两个函数。学不会的代价很具体——页面要么永远慢，要么永远旧，没有中间态。还有一个容易被跳过的前提：失效只对「走数据缓存」的取数有意义，如果页面在构建时就被完全静态化，你调一百次 `revalidateTag` 也不会变，这也是本周第二个步骤要花一整节讲动态化的原因。

#### 步骤 4.1 CMS webhook → revalidateTag

原理：服务端组件里的 `fetch` 默认进 Next 的数据缓存，缓存键是 URL 加请求选项。给这次 `fetch` 挂 `next.tags`，等于给这条缓存记录贴标签；之后调 `revalidateTag("post:hello")`，Next 把所有带该标签的记录标为过期，**下一次请求**重新取源并在后台写回缓存。注意「下一次请求」，不是「立刻推送」：已经打开的页面不会被远程刷新，能保证的只是「刷新一下就新」。

具体现象：CMS 点了发布，刷新 `/posts/hello` 还是旧正文，服务端日志里也看不到新的取数请求。说明路由本身可能是静态的，页面在构建时就固化了，此时 `revalidateTag` 对它无效。

怎么做：先给取数函数打 tag，tag 用「实体:主键」格式；再写一个 Route Handler 接 webhook，验签后按 tag 失效，最后回 200。以下在 Next 15/16 验证（`next build` 里该路由标 `ƒ`）。

```ts
// lib/content.ts
const CMS = process.env.CMS_BASE!
export async function getPost(slug: string) {
  const res = await fetch(`${CMS}/posts/${slug}`, {
    next: { tags: [`post:${slug}`, "posts:list"] },
  })
  if (!res.ok) throw new Error(`CMS ${res.status}`)
  return res.json() as Promise<{ title: string; body: string }>
}
```

逐行：`next.tags` 只在服务端 `fetch` 生效；数组里给两个 tag，是为了让详情失效时列表也一起失效；不写 `cache` 就是默认策略（生产环境走缓存）；`if (!res.ok)` 必须自己判——`fetch` 不会因 4xx 抛错，否则你会把错误页缓存起来。

tag 的粒度值得先想清楚：`post:<slug>` 细到单篇，`posts:list` 粗到整个列表。发布一篇文章时两个都要失效；删一篇文章时还得多想一步——列表页、首页、rss 这些共用 `posts:list` 的地方会一起刷新，这正是 tag 相对 path 的价值。命名统一用「域:标识」，别用中文、空格或随机串，否则半年后没人敢改。另一个常被混用的是 `revalidatePath`：`revalidatePath("/posts/[slug]", "page")` 里要写**路由模板**而不是真实 slug，第二个参数写 `page` 只失效这一页，写 `layout` 会连带失效整棵子树——用错会让一次发布把整个段落的缓存清空，流量小的站直接回源打满数据库。

还有两个坑要提前知道：在 `generateStaticParams` 或模块顶层调 `revalidateTag` 是无效的，那时还没有可失效的缓存记录，只在请求期调用才有效；多实例部署时每个实例各持一份缓存，标签失效只打到处理这次请求的那个实例，要全实例一致就得配共享缓存处理器，这也是「本地测着好、线上偶发旧内容」的根源之一。

:::hint tag 比 path 好
`revalidatePath` 只能按路径失效，一个 tag 却能覆盖多个页面；关键是打 tag 和失效 tag 两处的字面量必须完全一致，所以抽成 `postTag(slug)` 函数，别手写字面量。
:::

:::solution 服务端完整实现
```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache"
import { createHmac, timingSafeEqual } from "node:crypto"

export const runtime = "nodejs" // 要 node:crypto，别放 edge

function verify(raw: string, sig: string) {
  const want = createHmac("sha256", process.env.REVALIDATE_SECRET!).update(raw).digest("hex")
  const a = Buffer.from(want)
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verify(raw, req.headers.get("x-signature") ?? "")) {
    return new Response("bad signature", { status: 401 })
  }
  const { slug } = JSON.parse(raw) as { slug: string }
  revalidateTag(`post:${slug}`)
  revalidateTag("posts:list")
  return Response.json({ ok: true, revalidated: [`post:${slug}`, "posts:list"] })
}
```
先 `req.text()` 拿原文再验签，因为签名算的是原始字节；`timingSafeEqual` 防时序侧信道，两边长度不等会直接抛错，所以先比长度；`runtime` 固定 nodejs，edge 上得改用 `crypto.subtle` 并变成异步。
:::

#### 步骤 4.2 哪些写法会让路由变动态

原理：构建时 Next 尝试把路由预渲染成静态 HTML。一旦页面里出现「只能运行期才知道」的输入，预渲染不成立，该路由被标成动态（`ƒ`）。触发面比想象中宽：`cookies()`、`headers()`、`connection()`、页面 props 里的 `searchParams`、`fetch` 带 `cache: "no-store"`、`unstable_noStore()`。`params` 不算——动态段在构建时能枚举，除非你漏了 `generateStaticParams` 又想要静态。

具体现象：加了一行「读主题 cookie」之后，首页 TTFB 从 20ms 变 180ms，构建输出那行从 `○ /` 变成 `ƒ /`。它不是报错，所以极容易被忽略，等你发现时 CDN 已经白配了。

怎么做：先 build 一次把输出抄下来当基线；每加一个请求相关 API 就再 build 对比。如果只是想读一点运行期信息，把这段下沉到 `<Suspense>` 包住的子组件里，让外壳保持静态。

读构建输出的符号要认全：`○` 是纯静态（构建时生成、所有人都一样），`●` 是静态但带数据、有 `revalidate` 周期，`ƒ` 是动态（每次请求都渲染）。同一个页面从 `●` 掉到 `ƒ`，往往只是因为有人在里面加了一次 `cookies()` 读主题，而非业务需要——这类「顺手加的动态」是性能回归里最常见的一类。

```tsx
// app/page.tsx —— 外壳保持静态
import { Suspense } from "react"
export default function Home() {
  return (
    <main>
      <h1>内容站</h1>
      <Suspense fallback={<span>…</span>}>
        <UserNav />
      </Suspense>
    </main>
  )
}

// app/_components/user-nav.tsx —— 只有这一小块是动态的
import { cookies } from "next/headers"
export async function UserNav() {
  const name = (await cookies()).get("u")?.value
  return <span>{name ?? "未登录"}</span>
}
```

注意 `cookies()` 在 Next 15 起是异步的，必须 `await`；漏了会拿到一个 Promise 并在渲染时抛错。另外别用 `export const dynamic = "force-static"` 去「压」动态路由——它不会让 cookie 变得可用，只会在运行期报错。

顺带纠正一个常见误解：Route Handler 的 `GET` 在 Next 15 起**默认不缓存**，别再照抄旧文章里的 `export const dynamic = "force-dynamic"` 去「关缓存」。反过来，`revalidate = 0` 和 `cache: "no-store"` 都会让路由动态化，但前者是路由级、后者是请求级，混用会出现「页面整体静态、某个 fetch 每次都回源」的怪异组合——这种路由 CDN 不能整页复用，TTFB 依然高。判断方法只有一个：build 输出加实测，别凭印象。

:::hint 动态化是隐式的
用了请求相关 API，整条路由就变成动态渲染。这不是报错，只是构建产物从静态变动态——**首屏成本从 CDN 变成了每次回源**，要心里有数。
:::

:::solution 对照实验
```text
纯静态：              ○ /posts
用了 cookies()：      ƒ /posts
用了 searchParams：   ƒ /posts
cache: "no-store"：   ƒ /posts
connection()：        ƒ /posts
export const dynamic = "force-dynamic"：ƒ（显式，别当默认手段）
```
```bash
# Windows PowerShell 里只看相关几行
npx next build 2>&1 | Select-String -Pattern "posts|○|ƒ"
```
把每种写法各 build 一次，记下标记变化，这张表就是你以后 5 分钟内定位「为什么这页不缓存」的依据。
:::

#### 步骤 4.3 用脚本把「发布 → 可见」验一遍

原理：webhook 的验收不能靠手点浏览器——验签失败要 401、重放要幂等、失效要真的生效，这三件事都能用三个 HTTP 请求证明。

具体现象：手动测试时你只发了「正确签名」那一次，上线后才发现没签名的请求也能通过，因为验签函数在 `catch` 里被吞了。

怎么做：写一个脚本，按「无签名 / 错签名 / 正确签名」三种情况各发一次，再立刻抓页面正文比对。

```js
// scripts/revalidate.mjs
// 运行：node --env-file=.env.local scripts/revalidate.mjs hello
import { createHmac } from "node:crypto"

const slug = process.argv[2] ?? "hello"
const body = JSON.stringify({ slug })
const sig = createHmac("sha256", process.env.REVALIDATE_SECRET!).update(body).digest("hex")
const base = process.env.BASE ?? "http://localhost:3000"

for (const headers of [{}, { "x-signature": "deadbeef" }, { "x-signature": sig }]) {
  const res = await fetch(`${base}/api/revalidate`, { method: "POST", body, headers })
  console.log(JSON.stringify(headers), res.status, await res.text())
}
const html = await (await fetch(`${base}/posts/${slug}`)).text()
console.log("页面含新标题：", html.includes(process.env.EXPECT_TITLE ?? "新标题"))
```

三次请求共用同一个 `body` 字符串——验签算的就是这份原始字节，脚本里绝不能先 `JSON.parse` 再 `JSON.stringify`，字段顺序和空格会变，签名必然对不上。

比对正文时要用 CMS 里一个**每次都不同**的字符串（比如带时间戳的标题），否则你分不清「命中缓存」和「内容恰好一样」。脚本每一步都打印状态码而不是只打一句「通过」，出问题时才能看出是验签挂了还是失效没生效。`--env-file` 需要 Node 20.6 以上；在 PowerShell 里没有 `openssl` 也能跑，因为签名是在 Node 里算的。放进 CI 时把 `BASE` 指向预发环境，并在调用前后各打一次时间戳——「发布后多久可见」是这条链路唯一的硬指标，超过 1 秒就说明还有别的缓存层没被覆盖。

再补一条验收口径：正确签名连发两次都应返回 200，第二次不额外报错。失效本身是幂等的，别在 handler 里加「已经失效过就返回 409」这类判断，那会让对方的正常重试变成失败，进而触发更密集的重试。

:::hint 验签顺序
先取原文、再算摘要、最后才解析 JSON；顺序反了既验不过签，也会因为 body 只能读一次而报错。
:::

:::solution 三种签名各自的预期
```text
请求                 期望状态码   期望响应
无签名               401         {"code":"unauthorized",...}
x-signature: 假值    401         {"code":"unauthorized",...}
正确签名             200         {"ok":true,"tags":[...]}
正确签名再发一次      200        同上，幂等，不额外报错
```
```bash
# 把期望写成退出码，CI 才认
node --env-file=.env.local scripts/revalidate.mjs hello | tee /tmp/reval.log
grep -q '页面含新标题： true' /tmp/reval.log || { echo '发布后 1 秒内不可见'; exit 1; }
```
:::

:::error 把 revalidateTag 写进客户端组件
报错原文（`next build`，Next 15/16 验证）：`Error: You're importing a component that needs "next/cache". That only works in a Server Component but one of its parents is marked with "use client", so it's treated as a Client Component.`
根因：`revalidateTag` / `revalidatePath` 依赖服务端请求上下文，浏览器里没有那层存储。
修复：把失效调用搬进 `actions.ts`（顶部 `"use server"`）或 Route Handler，客户端只负责 `await` 那个函数。
:::

**自测**（合上文档回答）

1. 调完 `revalidateTag` 后，用户已经打开着的列表页会立刻变吗？为什么？
2. 一个 `fetch` 没写 `next.tags`，你对它调 `revalidateTag` 有效吗？
3. 构建输出里某路由从 `○` 变成 `ƒ`，首屏成本具体发生了什么变化？

**验收**

- [ ] 不带签名 `POST /api/revalidate` 返回 401，带错签名也返回 401
- [ ] 带正确签名返回 `{"ok":true,...}`，响应体里列出两个 tag
- [ ] 改 CMS 正文 → 跑脚本 → 刷新 `/posts/<slug>` 1 秒内看到新正文，服务端日志多一次取数
- [ ] `next build` 输出里 `/posts/[slug]` 是 `ƒ`，`/about` 仍是 `○`
- [ ] 在页面里临时加一行 `await cookies()` 再 build，该行标记变 `ƒ`；撤掉后恢复 `○`

---

## 阶段三 · 数据与变更（第 5–6 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从「只会 GET」到「能安全地写数据」 |
| 核心知识 | Route Handler、Server Action、表单校验、`useOptimistic`、幂等 |
| 场景项目 | 场景 #3：评论/工单的提交与回显 |
| 离开时应该能 | 设计一条「提交 → 校验 → 落库 → 刷新」的完整链路 |

### 第 5 周：写入的两条路

**本周目标**：同一个「提交评论」需求，用 Route Handler 和 Server Action 各实现一遍；两道都能拒绝伪造请求（前者 401、后者返回未登录错误），并且重复提交只落一条记录。

**为什么是这些内容**：前四周全是读——怎么渲染、怎么缓存、怎么失效。本周第一次写。Next 给了两条写入路径，很多人在这里选错：Route Handler 是「HTTP 端点」，适合给外部系统调（支付回调、第三方集成、移动端），你能完全控制状态码、响应头、重试语义；Server Action 是「把服务端函数交给客户端调」，适合自家表单，省掉手写 fetch、pending 状态和失效调用，代价是它**仍然是公开端点**，参数可以被任意构造。选错的后果不是跑不起来，而是安全与运维上的：把 webhook 写成 Action，对方没法带签名头；把自家表单写成 Route Handler，你得手写序列化、错误码、loading 三套样板，加第二个表单就开始复制。本周按场景 #3 的链路走：先接支付回调（外部、必须验签与幂等），再做评论表单（内部、要 pending 与就地校验），最后把两条路的错误形状统一，让 UI 不必关心底层是哪种。学不会的代价很实在——写出来的接口能跑但能被打，或者能跑但每加一个表单就要再抄一遍那三套样板。还有一层衔接：本周两条路最后都要收敛到同一套校验与错误形状，不然第 6 周讲幂等时你会有两个互不相同的入口要改。

#### 步骤 5.1 Route Handler 接第三方 webhook

原理：webhook 是「别人主动 POST 给你」。它有三条硬约束：必须验签（证明是对方发的）、必须幂等（对方失败会重试，同一事件可能来三次）、必须快速返回 2xx（超时会让对方更密集地重试，形成雪崩）。Route Handler 就是 `app/api/**/route.ts` 里导出的 `POST`，参数是标准 `Request`，返回标准 `Response`；`POST` 永远动态，不会被缓存。

具体现象：签名永远验不过，日志里对不上；第二次重试时直接抛 `TypeError: Body is unusable`，因为 body 已经被读过一次。

怎么做：`req.text()` 拿原始字符串 → 用同一份字节算 HMAC → `timingSafeEqual` 比较 → 解析 JSON → 用事件 id 做去重（靠数据库唯一索引，不是靠先查后插）→ 把重活丢队列 → 立刻返回。

```ts
// app/api/pay/webhook/route.ts
import { createHmac, timingSafeEqual } from "node:crypto"
import { after } from "next/server"

export const runtime = "nodejs"

function verify(raw: string, sig: string, secret: string) {
  const want = createHmac("sha256", secret).update(raw).digest("hex")
  const a = Buffer.from(want)
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verify(raw, req.headers.get("x-signature") ?? "", process.env.PAY_SECRET!)) {
    return new Response("bad signature", { status: 401 })
  }
  const event = JSON.parse(raw) as { id: string; type: string; data: unknown }
  const first = await db.webhookEvent
    .create({ data: { id: event.id, type: event.type } }) // id 是唯一索引
    .then(() => true)
    .catch((e) => (isUniqueViolation(e) ? false : Promise.reject(e)))
  if (!first) return Response.json({ ok: true, duplicated: true })
  after(() => handleEvent(event)) // 响应发出后再干重活
  return Response.json({ ok: true })
}
```

逐行：`runtime = "nodejs"` 是因为用了 `node:crypto`，edge 上得换 `crypto.subtle` 并改成异步；`req.text()` 只能读一次，后面要对象就 `JSON.parse(raw)`，别再 `req.json()`；唯一索引冲突说明这条事件处理过，直接返回成功（对方要的是 2xx，不是「请你再发一次」）；`after()` 是 Next 15 起的 API，保证响应发出后执行，前提是运行环境不会在响应结束就冻住进程——容器里跑长任务更稳的还是队列。

「快速返回」要算一下时间预算：支付方一般给 5–10 秒，handler 里每多一次同步数据库写就多几十毫秒，赶上对方抖动重试三次，压力立刻三倍。所以幂等写入只做一条 insert，重活（发券、通知、对账）交给队列或 `after()`。反过来，验签失败与参数错误必须**快速失败**：返回 4xx 是告诉对方「别重试了」，返回 5xx 等于说「请再来」，你会收到一百次同样的坏请求。`WebhookEvent` 表也要有清理策略，按月归档或加 TTL，否则一年后去重查询会变成慢查询。

密钥管理同样算在这里：验签密钥不要和登录会话密钥复用；轮换时要能新旧并存（新密钥签、旧密钥仍可验），否则一换密钥对方所有在途回调全变 401，而对方只会看到「你这边挂了」。

:::hint webhook 的三条铁律
① 必须验签（否则任何人都能伪造）；② 必须幂等（对方会重试）；③ 必须快速返回 2xx（超时会触发更多重试）。三条缺一条，线上就会以「重复扣款」或「回调丢失」的形式暴露。
:::

:::solution 幂等表与三连发验证
```prisma
model WebhookEvent {
  id        String   @id // 直接用对方的事件 id
  type      String
  createdAt DateTime @default(now())
}
```
```js
// scripts/webhook-storm.mjs
// node --env-file=.env.local scripts/webhook-storm.mjs
import { createHmac } from "node:crypto"
const body = JSON.stringify({ id: "evt_1001", type: "pay.succeeded", data: {} })
const sig = createHmac("sha256", process.env.PAY_SECRET!).update(body).digest("hex")
for (const headers of [{}, { "x-signature": "deadbeef" }, { "x-signature": sig }, { "x-signature": sig }, { "x-signature": sig }]) {
  const res = await fetch("http://localhost:3000/api/pay/webhook", { method: "POST", body, headers })
  console.log(res.status, await res.text())
}
// 期望 401 401 200 200(duplicated) 200(duplicated)
```
没有唯一索引时，并发重试会双写，因为两次 `create` 都能成功；`first` 这个布尔值是唯一能区分「首次处理」和「重放」的地方。
:::

#### 步骤 5.2 Server Action + useOptimistic

原理：`"use server"` 标记的函数在构建时被编译成一个可被客户端引用的标识，组件里 `action={fn}` 或事件里 `await fn()` 都会发一个 POST 到当前路由并回传渲染结果。它替你省掉 fetch、pending 与重新取数；换来的是三件必须自己做的事：鉴权、校验、错误形状——因为这个端点同样暴露在公网。

具体现象：表单校验失败时整页跳到 `error.tsx`，用户输入全丢；或者把 `"use server"` 文件里的常量也 `export` 出去，构建直接报 `Only async functions are allowed to be exported in a "use server" file`。

怎么做：Action 里 `requireUser()` → 校验（zod 或手写）→ 写库 → `revalidateTag` → **返回**结果对象；只有真正的意外才 `throw`。客户端用 `useActionState` 拿 pending 和错误，用 `bind` 把路由参数绑进去。

```ts
// app/posts/[id]/actions.ts
"use server"
import { revalidateTag } from "next/cache"
import { z } from "zod"

const Schema = z.object({ content: z.string().trim().min(1).max(500) })
export type CommentState = { error?: string }

export async function addComment(postId: string, _prev: CommentState, fd: FormData): Promise<CommentState> {
  const user = await requireUser() // Action 是公开端点，必须自己鉴权
  const parsed = Schema.safeParse({ content: fd.get("content") })
  if (!parsed.success) return { error: "内容需 1–500 字" }
  await db.comment.create({ data: { postId, userId: user.id, content: parsed.data.content } })
  revalidateTag(`post:${postId}`)
  return {}
}
```

逐行：签名里 `prev` 在前，是 `useActionState` 的约定；校验失败 `return` 一个对象而不是抛错，用户输入才保得住；成功后 `revalidateTag` 让详情页下一次请求重新取数——这一步漏了，页面会一直显示旧评论，你在第 4 周学的两个函数就是在这里用的。

有个点常被忽略：Action 由浏览器发出，Next 会校验来源与 `Origin` 一致来挡跨站请求，但那挡的是「别的站点」，不是「别的用户」。真正的授权永远在 `requireUser()` 里，而且要按资源校验——`postId` 是不是这个用户能评论的，而不是只判断「登录了没」。另外 `<form action={action}>` 天然支持渐进增强：JS 还没加载完也能提交，服务端照样处理并返回整页，这是自己写 `fetch` 换不来的好处。

标题里的 `useOptimistic` 这周只需知道它站的位置：接在 Action 前面，负责「提交中就先把这条显示出来」。回滚、乱序、连点这些细节留到第 6 周，因为它们必须先有幂等键才有意义——没有去重键的乐观更新，只是把重复数据提前显示了半秒。

:::hint Action 不是接口
Server Action 是「从客户端调服务端函数」，参数会被序列化。它仍然是公开端点，**必须自己做鉴权与校验**；`useOptimistic` 负责「先显示再确认」。
:::

:::solution 表单接线
```tsx
// app/posts/[id]/comment-form.tsx
"use client"
import { useActionState } from "react"
import { addComment, type CommentState } from "./actions"

export function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(
    addComment.bind(null, postId),
    {},
  )
  return (
    <form action={action}>
      <textarea name="content" maxLength={500} required />
      <button disabled={pending}>{pending ? "提交中…" : "发布"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```
`bind` 之后 `useActionState` 只需要 `(prev, formData)` 两个参数，路由参数不会再被表单数据挤掉；`pending` 由 React 维护，别自己再写一个 `isSubmitting`。
:::

#### 步骤 5.3 让两条写入路返回同一种错误形状

原理：上层 UI 不该关心端点类型。定义一个 `Result`，成功带数据、失败带 `code` 与 `message`；Route Handler 把它映射成 HTTP 状态码，Action 直接返回这个对象。状态码只在 HTTP 边界决定一次，业务代码只认 `code`。

具体现象：同一个错误提示组件，在 Action 上拿不到 `res.ok`（它根本不是 `Response`），在 Handler 上又拿不到 `state.error`——最后每个表单各写一套，文案和重试策略各不相同，用户在不同页面看到同一件事的两种说法。

怎么做：把 `Result` 与状态码映射放进 `lib/result.ts`；所有业务函数返回 `Result`，边界层各转一次。

```ts
// lib/result.ts
export type ErrorCode = "validation" | "unauthorized" | "conflict" | "internal"
export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string }
const STATUS: Record<ErrorCode, number> = { validation: 400, unauthorized: 401, conflict: 409, internal: 500 }

export const fail = (code: ErrorCode, message: string): Result<never> => ({ ok: false, code, message })

export function http<T>(r: Result<T>) {
  return r.ok
    ? Response.json(r.data)
    : Response.json({ code: r.code, message: r.message }, { status: STATUS[r.code] })
}
```

逐行：`fail` 返回 `Result<never>`，`never` 是任何类型的子类型，所以它能出现在任何期望 `Result<T>` 的位置，调用处不用写泛型；`http` 是唯一知道状态码的地方，改协议只改这一个函数；业务函数里不要再 `throw new Error("unauthorized")`——那会变成 500，还会把堆栈泄露给客户端。

错误码要有节制：一上来列二十个 code，前端永远写不完映射。从四个开始，真出现第五类再加，加的时候同步改 `STATUS` 表和提示文案表，别让两处漂移。判断某个错误该归哪类也很简单：用户能改的算 `validation`，需要重新登录的算 `unauthorized`，重复提交或版本冲突算 `conflict`，其余一律 `internal`。

值得专门写一条断言：把同一个业务函数分别从 Action 和 Handler 调一次，比较两边拿到的 `code` 是否完全一致。这是唯一能阻止「两套错误处理慢慢分叉」的自动化手段，比 code review 可靠。

:::hint 两条路，一个出口
判断标准很简单：调用方是「别人家的服务器」就用 Route Handler，是「你自己的 React 组件」就用 Action；但两者最终都要落到同一个 `Result` 上，否则每加一个入口就多一套错误处理。
:::

:::solution 同一个业务函数，两个边界各转一次
```ts
// app/actions/create-comment.ts
"use server"
import { fail, type Result } from "@/lib/result"
import { db } from "@/lib/db"

export async function createComment(postId: string, content: string): Promise<Result<{ id: string }>> {
  const len = content.trim().length
  if (len < 1 || len > 500) return fail("validation", "内容需 1–500 字")
  const user = await getSession()
  if (!user) return fail("unauthorized", "请先登录")
  try {
    const row = await db.comment.create({ data: { postId, content, userId: user.id } })
    return { ok: true, data: { id: row.id } }
  } catch {
    return fail("internal", "写入失败，请重试")
  }
}
```
```ts
// app/api/comments/route.ts —— 唯一决定状态码的地方
import { http } from "@/lib/result"
import { createComment } from "@/app/actions/create-comment"

export async function POST(req: Request) {
  const { postId, content } = await req.json()
  return http(await createComment(postId, content))
}
```
判据：业务层只认 `code`，`STATUS` 表只被 `http()` 读一次；同一个校验失败，Action 返回 `code: "validation"`、Handler 返回 400，前端提示文案必须是同一句。
:::

:::error 先 req.json() 再验签
报错原文（Node 20 / Next 15 验证）：`TypeError: Body is unusable: Body has already been read`
根因：`Request` 的 body 是一次性流，`req.json()` 已经消费掉它，再 `req.text()` 就抛这个错。即便只读一次，`JSON.stringify(JSON.parse(raw))` 也会改变字段顺序与空格，签名照样对不上。
修复：验签只吃原始字节——`const raw = await req.text()`，用 `raw` 算 HMAC，需要对象时再 `JSON.parse(raw)`。
:::

**自测**（合上文档回答）

1. webhook 里为什么不能 `await handleEvent(event)` 完成之后才返回 200？
2. `"use server"` 文件里可以 export 一个普通常量或同步函数吗？为什么？
3. 表单校验失败时，Action 该 `throw` 还是 `return`？两种做法分别会把用户带到哪里？

**验收**

- [ ] 缺签名、错签名的 `POST /api/pay/webhook` 都返回 401（`curl -i` 看第一行）
- [ ] 同一 `event.id` 连发三次：第一次 200，第二三次响应体含 `"duplicated": true`
- [ ] 提交 600 字内容：页面不跳错误页，表单下方出现「内容需 1–500 字」，原输入还在
- [ ] 提交成功后不手动刷新，新评论出现在列表里（证明 `revalidateTag` 生效）
- [ ] 触发一次 `conflict`：Handler 返回 409，Action 返回 `code: "conflict"`，前端提示文案完全一致

---

### 第 6 周：并发与一致性

**本周目标**：一个页面里两个组件都取用户信息，终端只打印一行查询；连点 5 次提交只落一条评论；提交失败时乐观项 1 秒内消失并出现错误提示。

**为什么是这些内容**：第 5 周把写入链路打通了，但只考虑了「一次请求」。真实用户会连点、会在弱网下重试、会同时开两个标签页；服务端会并行处理、会超时、会重复投递。本周处理「同一件事被做了两遍」的所有形态，看起来是三个问题，其实是同一个问题的三张面孔：**你有没有一个稳定的去重键，以及一次可回滚的乐观状态**。步骤 6.1 浪费的是数据库连接与首屏时间，6.2 浪费的是数据正确性，6.3 浪费的是用户信任——列表闪一下又变回去，比直接转圈更让人怀疑系统。不学这三件事的后果在压测和线上都会出现：首屏多打三倍查询、用户双击产生两条订单、失败提示一闪而过被当成成功。它们也是毕业评估里「能设计一致性方案」的最小闭环：去重键决定系统能不能承受重放，乐观更新决定用户感知的快慢与真假。另外第 7–8 周写鉴权时会反复用到 6.1——`cache()` 包住的会话校验，能让布局与页面共享同一次 token 验证，而不是每个组件都验一遍。

#### 步骤 6.1 用 cache() 去重同一次渲染里的重复请求

原理：React 的 `cache()` 在**一次服务端渲染请求**内做记忆化：同样的函数引用 + 同样的参数 → 复用同一个 Promise。它不跨请求、不跨用户、不落盘。这跟 Next 的数据缓存（`fetch` + tag）是两层：前者省「一次渲染内的重复」，后者省「跨请求的重复」。因为它缓存的是 Promise，失败也会被缓存——同一次渲染里第二个调用拿到的还是那个 rejection，这个行为恰恰是你想要的，别让一次失败触发两次重试。

具体现象：一个页面里 `layout` 取了一次当前用户、`page` 又取一次，终端打出两行 `query user u1`，首屏就把连接池占掉两根；接口一慢，两倍的并发立刻把它压垮。

怎么做：把取数函数用 `cache()` 包起来并**单一导出**，所有组件都调它，不要各自 `db.user.findUnique`。参数必须是原始值——对象字面量每次都是新引用，永远不命中。

```ts
// lib/user.ts
import { cache } from "react"

export const getUser = cache(async (id: string) => {
  console.log("query user", id) // 命中缓存时不会打印
  return db.user.findUnique({ where: { id } })
})
```

```tsx
// app/debug/user/page.tsx —— 一个页面里三处调用
import { getUser } from "@/lib/user"

export default async function Page() {
  const [a, b] = await Promise.all([getUser("u1"), getUser("u1")])
  const c = await getUser("u1")
  return <pre>{JSON.stringify({ a: !!a, b: !!b, c: !!c })}</pre>
}
```

逐行：`cache` 的键是「函数引用 + 参数序列化值」，所以把 `getUser({ id })` 这样传对象的写法会每次都 miss；并发调用 `Promise.all` 也只会查一次，因为缓存的是 Promise 而不是结果；在 Route Handler 里没有 React 渲染上下文，`cache()` 不生效，那里的去重要另想办法。

它的边界也要记清：`generateMetadata` 与 `page` 在同一次渲染里，所以它们之间同样能共享；但想在**多次请求之间**复用（比如全站配置），得用 `unstable_cache` 或数据缓存，不是 `cache()`。混了两者最典型的表现就是「我明明包了 cache，怎么每次刷新还查库」——因为它本来就不跨请求。

:::hint React 的 cache 是「单次请求内」的
它不跨请求、不跨用户，所以放心用来去重；跨请求缓存要用 Next 的数据缓存（`fetch` + tag）。
:::

:::solution 两个组件共用一个取数函数
```tsx
// app/(dash)/layout.tsx
import { getUser } from "@/lib/user"
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getUser("u1")
  return <section data-user={user?.name}>{children}</section>
}

// app/(dash)/page.tsx
import { getUser } from "@/lib/user"
export default async function Page() {
  const user = await getUser("u1")
  return <h1>{user?.name} 的仪表盘</h1>
}
```
```text
期望终端：query user u1      ← 只有一行
反例对照：
getUser("u1") ×2（同参数）        → 1 行
getUser({ id: "u1" }) ×2（对象）  → 2 行（引用不同）
getUser("u1") 与 getUser("u2")    → 2 行
```
这一行日志就是验收证据，别用「感觉快了」代替。
:::

#### 步骤 6.2 并发写入的幂等键

原理：幂等 = 同一个请求重放 N 次，结果与一次相同。正确做法不是「先查有没有、没有就插入」——两个并发请求会同时查到「不存在」，然后各插一条，这是典型的 TOCTOU 竞态。做法是让数据库裁决：建唯一索引，插入冲突就说明已经处理过，捕获后返回已有记录。

具体现象：用户双击，产生两条一模一样的评论；或者重试时直接 500，报 `Unique constraint failed on the fields: (requestId)`——因为冲突没被捕获，被当成服务器错误返回，对方的监控里全是红点。

怎么做：前端在**进入提交态之前**生成一个 `requestId`（`crypto.randomUUID()`），随表单一起提交；服务端建 `@@unique([userId, requestId])`，冲突时按唯一键查出已有记录返回。requestId 必须按用户隔离，否则两个用户碰巧同 id 会互相顶掉。

```prisma
model Comment {
  id        String   @id @default(cuid())
  userId    String
  content   String
  requestId String
  createdAt DateTime @default(now())
  @@unique([userId, requestId])
}
```

```ts
// lib/comment.ts
export async function createComment(userId: string, content: string, requestId: string) {
  try {
    const row = await db.comment.create({ data: { userId, content, requestId } })
    return { ok: true as const, data: row, duplicated: false }
  } catch (e) {
    if (!isUniqueViolation(e)) throw e // 只吞唯一键冲突
    const row = await db.comment.findUniqueOrThrow({
      where: { userId_requestId: { userId, requestId } },
    })
    return { ok: true as const, data: row, duplicated: true }
  }
}
```

逐行：`isUniqueViolation` 只认数据库的冲突码（Prisma 的 `P2002`、Postgres 的 `23505`），绝不能 `catch` 一切异常当重复——网络失败、约束名写错都会被吞成「成功」，那是最难查的 bug；返回已有记录而不是空，重试的客户端才能拿到同一个 id 并继续渲染；`requestId` 要有保留期，比如清理 30 天前的，否则这张表只增不减。

两处细节决定这条链路能不能扛住真实重试：一是冲突判定要精确到具体约束，`isUniqueViolation` 里最好连约束字段一起校验，别把别的唯一键冲突也当成幂等命中；二是幂等键和业务写入必须原子。本例里两者就是同一行，天然成立；如果你把幂等键单独存进事件表，就必须和业务行在同一个事务里提交，否则并发窗口里两个请求都过了检查，唯一索引只保护了键、没保护数据。

:::hint 幂等要从请求带到库
前端生成 `requestId`（`crypto.randomUUID()`），随表单提交；服务端建唯一索引，重复插入捕获冲突后返回已有记录。
:::

:::solution 前端一个 id 用到底
```tsx
"use client"
import { useRef } from "react"

export function CommentForm({ postId }: { postId: string }) {
  const idRef = useRef(crypto.randomUUID()) // 渲染时生成一次，双击也是同一个 id

  async function submit(fd: FormData) {
    const res = await createComment(postId, String(fd.get("content")), idRef.current)
    if (!res.duplicated) idRef.current = crypto.randomUUID() // 成功后才换新 id
  }

  return (
    <form action={submit}>
      <textarea name="content" required />
      <button>发布</button>
    </form>
  )
}
```
```sql
-- 验收：任何 requestId 都不该出现两行
SELECT request_id, count(*) AS n FROM "Comment" GROUP BY request_id HAVING count(*) > 1;
-- 期望 0 行
```
在 `submit` 里生成 id 是错的：双击会生成两个不同的 id，唯一索引拦不住，你还是会得到两条记录。
:::

#### 步骤 6.3 乐观更新的回滚与竞态

原理：`useOptimistic` 不是「往 state 里塞一条假数据」，而是「transition 未结束时叠加的预测值」。你在 action 或 `startTransition` 里调它的更新函数，React 先渲染叠加后的列表；等这个 transition 结束，叠加值自动丢弃，回到真实 props。所以**回滚不需要你手动删**——只要服务端状态没变，乐观项自己就消失了。反过来说，如果你在普通 `onClick` 里直接调它，React 会在控制台报错并且行为不可预期。

具体现象：双击提交后列表出现两条几乎一样的评论，其中一条永远停在「发送中」；或者后到的旧响应把新内容覆盖掉；或者用自增下标当 `key`，React 复用了错误的节点，出现内容串行。

怎么做：用 `startTransition` 包住整个提交；临时 id 直接用 `requestId`；列表按 id 匹配而不是按位置；失败时只是让 transition 结束并显示错误，不手动删项。

```tsx
"use client"
import { useOptimistic, useRef, useState, startTransition } from "react"

type Row = Comment & { pending?: boolean }

export function CommentList({ postId, comments }: { postId: string; comments: Comment[] }) {
  const [optimistic, addOptimistic] = useOptimistic<Row[], Row>(comments, (list, next) => [...list, next])
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(crypto.randomUUID())

  function submit(fd: FormData) {
    const requestId = idRef.current
    startTransition(async () => {
      addOptimistic({ id: requestId, content: String(fd.get("content")), pending: true } as Row)
      try {
        await createComment(postId, String(fd.get("content")), requestId)
        idRef.current = crypto.randomUUID() // 只有成功才换新 id
      } catch {
        setError("发送失败，请重试") // transition 结束，乐观项自动消失
      }
    })
  }

  return (
    <>
      <ul>
        {optimistic.map((c) => (
          <li key={c.id} data-pending={c.pending ? "1" : undefined}>{c.content}</li>
        ))}
      </ul>
      <form action={submit}><input name="content" /><button>发布</button></form>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
```

逐行：`key` 用 `c.id`（服务端 id 或 requestId），绝不能用数组下标；`pending` 标记只用来显示「发送中」，不要靠它判断是否成功；`idRef` 在渲染期初始化一次，成功后才换新的——这样连点五次发出去的是同一个 `requestId`，服务端只落一条，前四次都会拿到 `duplicated: true`；`setError` 放在 transition 里，UI 会在同一帧更新。

失败时**不要**换 id：用户点重试应该复用同一个 `requestId`，这样即便上一次其实写成功了、只是响应在半路丢了，重试也只会拿到 `duplicated`，不会变成第二条。还有一个常被漏掉的场景是双标签页——A 页提交成功后 B 页列表不会自己变，靠的是提交后 `revalidateTag`、B 页下次请求拿到新数据；想做到即时只能订阅变更，别用 localStorage 广播去伪造一致性。

响应乱序也要单独想一遍：先后发两次提交，先发的那条可能后到。判断依据不能是「谁最后返回」，而只能是 `requestId`——按 id 找到对应行再替换，找不到就忽略这条响应。用「以后到为准」去覆盖整个列表，弱网下一定会出现「新内容被旧内容顶掉」。

:::hint 乐观项不是数据，是一次预测
它活在 transition 里，transition 结束就没了。你要做的是保证「结束时服务端状态是对的」，而不是去清理那份预测。
:::

:::solution 四个断言与配套的服务端去重
```text
场景                  期望
连点 5 次「发布」      只落 1 条评论，第 2–5 次响应 duplicated: true
服务端返回 500        乐观项在 transition 结束后消失，页面出现 role="alert" 文案
失败后点重试          复用同一个 requestId，不产生第二条
弱网下响应乱序        按 requestId 匹配替换，不按「谁最后返回」覆盖整个列表
```
```ts
// app/actions/create-comment.ts —— requestId 建唯一索引，重复提交只会命中已有行
export async function createComment(postId: string, content: string, requestId: string) {
  const seen = await db.comment.findUnique({ where: { requestId } })
  if (seen) return { ok: true as const, duplicated: true, id: seen.id }
  const row = await db.comment.create({ data: { postId, content, requestId } })
  return { ok: true as const, duplicated: false, id: row.id }
}
```
:::

:::error 在 onClick 里直接调 addOptimistic
控制台报错原文（React 19 验证）：`An optimistic state update occurred outside a transition or action. To fix, move the update to a transition or startTransition function.`
根因：`useOptimistic` 的更新必须发生在一个 pending 的 transition 中，否则 React 无法判断这批预测值何时该被真实结果替换。
修复：用 `startTransition(async () => { addOptimistic(...); await action(...) })`，或者把整个函数交给 `<form action={...}>`——表单 action 本身就是一个 transition。
:::

**自测**（合上文档回答）

1. `cache()` 包住的函数，两个不同用户的两个请求会复用结果吗？为什么？
2. 幂等为什么不能写成「先查有没有，没有就插入」？
3. `useOptimistic` 的乐观项是怎么回滚的——你需要手动把它从列表里删掉吗？

**验收**

- [ ] 仪表盘终端只有一行 `query user u1`，而 `layout` 与 `page` 都调了 `getUser`
- [ ] 把参数改成对象字面量 `getUser({ id: "u1" })` 再跑，终端变成两行（证明键按引用）
- [ ] 双击提交按钮 5 次，`SELECT count(*) FROM "Comment"` 结果是 1
- [ ] 临时让 `createComment` 抛错：乐观项 1 秒内消失，页面出现「发送失败，请重试」
- [ ] 唯一索引确实存在：Postgres 查 `pg_indexes`、MySQL 查 `SHOW INDEX FROM comment`，能看到 `(userId, requestId)`

---

## 阶段四 · 鉴权与多租户（第 7–8 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 |
| 这一阶段解决 | 从「单用户」到「多租户、可授权」 |
| 核心知识 | middleware、会话读取、路由级守卫、多租户路径/子域、边缘限制 |
| 场景项目 | 场景 #4：多租户 SaaS 后台（组织切换 + 角色） |
| 离开时应该能 | 设计一套「登录 → 选组织 → 授权」的路由与数据隔离 |

### 第 7 周：middleware 与路由守卫

**本周目标**：写出一段只拦 `/dashboard` 的 middleware，并用「手写一个假 cookie」的实验证明它只是体验层、不是安全边界。

**为什么是这些内容**

前六周把「页面怎么渲染、数据怎么缓存、写操作怎么落地」都过了一遍，但它们都默认了一件事：访问者是谁。这一周补上它。鉴权 bug 在真实项目里几乎长成同一个样子——middleware 里写着「没有 token 就跳登录」，看上去很严实，可 token 只是一个普通 cookie，用户在控制台敲一行 `document.cookie = "session=x"` 就进去了；或者页面都守住了，某个 `GET /api/orders` 却谁都能调。共同根因是把「体验层的拦截」误当成「安全边界」。

这一周要建立的直觉是分层：middleware 负责「没登录就别渲染、跳转时把来路带上」，页面负责「登录了但角色不对就拒绝」，数据层负责「这条记录是不是你这个组织的」。三层各司其职，任何一层被绕过，下一层还在。学完这周，你指着一个 bug 应该能说出「它漏的是第几层」，而不是笼统地说「鉴权没做」。

如果跳过这一周，第 8 周的多租户隔离会无从下手——没有可靠的「当前用户」读取方式，租户条件就只能在 URL 里传来传去，而这正是越权的起点；第 12 周的灰度发布也会因为不敢上线而停摆。

#### 步骤 7.1 用 middleware 做登录重定向

先看现象。未登录时直接访问 `/dashboard/orders?status=paid`，如果页面里写的是 `const user = await currentUser(); return <p>{user.name}</p>`，你会拿到 `TypeError: Cannot read properties of null`，错误边界弹出一个红块——用户看到的是一次崩溃，不是登录页。更糟的是页面用 `?.` 兜住了，用户看到一屏空表格，以为系统坏了。

正确行为是请求在渲染之前就被拦下，307 到 `/login?next=/dashboard/orders%3Fstatus%3Dpaid`，登录成功后回到原地址，筛选条件还在。

时间点要分清：middleware 在「路由匹配之后、RSC 渲染之前」执行，跑在轻量的边缘运行时里，能读 cookie 与 header、改写当前 URL、返回重定向或改响应头，但**没有** `fs`、`net` 和数据库驱动，所以只能做无状态判断，不能 `await db.user.findUnique()`。

三个细节容易写错。第一，用 `req.nextUrl.clone()` 复制再改 `pathname`，不要字符串拼 `new URL("/login", req.url)`：clone 保留 origin、端口、basePath 和已有 query，拼字符串在部署到子路径时会跳错。第二，`next` 要带 `pathname + search`，只带 pathname 会让用户登录后丢掉筛选条件。第三，`matcher` 只匹配受保护前缀，写成 `/:path*` 等于让每个图片、每个 `_next/static` 请求都过一次 middleware，白白加延迟。

```ts
// middleware.ts（项目根目录；Next 16 起该文件改名为 proxy.ts、导出名改 proxy，动手前先跑 next build 看迁移提示）
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value
  if (!token) {
    const url = req.nextUrl.clone()                 // 保留 origin / 端口 / basePath
    const next = req.nextUrl.pathname + req.nextUrl.search
    url.pathname = "/login"
    url.search = ""                                 // 先清空，别把原 query 原样带过去
    url.searchParams.set("next", next)              // 自动做 URL 编码
    return NextResponse.redirect(url)               // 默认 307，保留方法与 body
  }
  return NextResponse.next()
}

export const config = { matcher: ["/dashboard/:path*"] }
```

逐行看：`cookies.get` 读的是请求头里的 `Cookie`，取不到返回 `undefined`，所以要 `?.value`；`clone()` 得到的是 `NextURL` 实例，改完 `pathname` 与 `searchParams` 后由 `redirect` 序列化成 `Location`；`matcher` 是静态字符串，`/dashboard/:path*` 同时覆盖 `/dashboard` 本身与全部子路径。

还有一个常被忽略的选择：为什么是 307 而不是 302。307 与 308 明确要求保留原方法与请求体，而 302 在历史实现里常被浏览器改成 GET。登录跳转本身是 GET，看不出差别；但同一个 middleware 以后若要拦表单的 POST，302 会把 POST 降级成 GET，用户刚填的内容直接丢光。

最后记住执行顺序：middleware 跑在缓存之前。即便页面是静态预渲染的 `○`，middleware 仍会对每个请求跑一次——所以它必须足够便宜，只做字符串判断与签名校验，绝不发起网络请求。

matcher 也支持负数前瞻（`"/((?!api|_next|favicon.ico).*)"`），但能用前缀就别用正则：写在 config 里不参与类型检查，写错只会表现为「某类请求莫名不走 middleware」。

:::hint 只判「有没有 cookie」等于没判
攻击者不需要登录，手写一个同名 cookie 就能让这段代码放行。middleware 的价值是「别让用户看到崩溃页」，真正的判定必须在页面与数据层再做一次。
:::

:::solution 参考实现（登录页的回跳）
```tsx
// app/login/page.tsx
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams          // Next 15 起 searchParams 是 Promise
  return <LoginForm redirectTo={safeNext(next)} />
}

function safeNext(next?: string) {
  // 只接受站内绝对路径，挡掉 //evil.com 这类开放重定向
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
}

// LoginForm 登录成功后：router.replace(redirectTo)
```
:::

#### 步骤 7.2 多租户路由：路径还是子域

进入多租户后第一个绕不开的选择是租户标识放哪：`/org/acme/orders` 还是 `acme.example.com/orders`。这不是审美问题，它决定 cookie 作用域、证书形态和「一个部署还是 N 个部署」。

路径方案：一个域名、一份证书、cookie 天然同域；代价在「每个链接」——每页都带 `[orgId]` 段，`Link` 与 `redirect` 必须记得拼前缀，漏一个就会跳到当前组织的相对路径下，看起来像数据串了。子域方案：cookie 可按子域隔离、品牌感强；代价在「每个环境」——通配证书、DNS、跨子域跳转都要单独处理，本地开发还得配 hosts。

工程上更常见的是折中：对外用子域、对内用路径。middleware 读 `Host` 头，把 `acme.example.com/orders` 在服务端 rewrite 成 `/org/acme/orders`，页面代码只认路径。这样只有一个部署、一份 cookie 策略，子域只是入口。

```ts
// middleware.ts 追加：子域 → 路径的内部重写
const host = (req.headers.get("host") ?? "").split(":")[0]
const sub = host.split(".")[0]
const RESERVED = new Set(["www", "app", "localhost", "127"])

if (!RESERVED.has(sub) && !req.nextUrl.pathname.startsWith("/org/")) {
  const url = req.nextUrl.clone()
  url.pathname = `/org/${sub}${req.nextUrl.pathname}`
  return NextResponse.rewrite(url)      // 地址栏不变，服务端渲染 /org/acme/*
}
```

rewrite 与 redirect 的区别要记牢：redirect 让浏览器再发一次请求、地址栏会变；rewrite 在服务端替换目标、地址栏不动。做子域映射只能用 rewrite，否则用户会看到 URL 里突然多出一段 `/org/acme`，分享出去就变成内部路径。

这里还有一个坑：`sub` 直接拼进路径，等于把用户可控的 Host 头当成了路径片段。生产上要先按白名单或 `^[a-z0-9-]{3,30}$` 校验，否则构造一个奇怪的 Host 就能把请求 rewrite 到不该去的地方。同理，路径里的租户标识只是**定位**，不是**授权**——它来自 URL，任何人都能改，所以下一页必须校验「当前用户属于这个组织」，这条线在第 8 周展开。

也别把 slug 与主键混用：URL 里放 `acme` 便于阅读，数据库里仍用不可变的 `org_id` 做外键，两者用一张 `orgs(slug, id)` 表映射。组织改名时只动 slug，历史数据一行都不用改。

本地验子域不用改 hosts：浏览器把 `*.localhost` 都解析到 127.0.0.1，直接访问 `acme.localhost:3000` 就能跑通上面这段 rewrite。先在本地把映射逻辑确认对，再去服务器配通配证书，能省掉一半「到底是 DNS 还是代码」的排查。

:::hint 路径方案的成本在「每个链接」，子域方案的成本在「每个环境」
早期产品、内部系统选路径：一天能改完。对外 SaaS、要卖给企业客户时再上子域，那时通配证书与 cookie 隔离的投入才有回报。
:::

:::solution 取舍表
| 维度 | 路径 `/org/[id]` | 子域 `org.example.com` |
|---|---|---|
| 实现成本 | 低，改路由即可 | 高：DNS、通配证书、cookie 域 |
| 数据隔离 | 靠代码自觉，易漏 | 天然按域分隔 |
| 品牌感 | 一般 | 强，可自定义登录页 |
| 本地开发 | 直接跑 | 要配 hosts 或通配本地域 |
| 适合 | 内部系统、早期产品 | 对外 SaaS、企业客户 |
:::

#### 步骤 7.3 cookie 在，不等于会话有效

放行之后还有更隐蔽的洞：cookie 有值，但值是伪造的、或者三天前就过期了。步骤 7.1 对这两种情况都放行，因为它只判断「有没有」。

middleware 不能查库，但**能验签**。把会话做成无状态 token：`base64url(payload) + "." + base64url(HMAC-SHA256)`，middleware 用 Web Crypto 验签名与 `exp`，页面再查一次「这个账号是否被禁用、是否被踢下线」。前者挡伪造，后者挡「签名合法但已失效」。边缘运行时没有 `Buffer`，也没有 `crypto.createHmac`，只能用 `crypto.subtle`。

```ts
// lib/session-edge.ts —— 只依赖 Web 标准 API，middleware 与 Node 都能跑
const enc = new TextEncoder()

function b64urlToBytes(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function verifySessionEdge(token: string, secret: string) {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  )
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), enc.encode(payload))
  if (!ok) return null
  const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as { sub: string; exp: number }
  return data.exp * 1000 > Date.now() ? data : null    // exp 用秒，比较时换成毫秒
}
```

关键点：`importKey` 第四个参数 `false` 表示密钥不可导出；`verify` 的签名参数必须是 `Uint8Array`、原文是 `ArrayBuffer` 视图；签名比较只能走 `verify`，自己写 `===` 比字符串既有计时侧信道，也容易在 base64 补位上出错。

密钥还要能轮换：payload 里带一个 `kid` 字段，验证时按 `kid` 选密钥，新旧密钥并存一个发布周期，用户就不用集体重新登录一次。真实系统里这事迟早会发生，先留字段比事后改 token 格式便宜得多。签名用的 secret 只能来自服务端环境变量，绝不能是 `NEXT_PUBLIC_` 开头——那个前缀会被打进浏览器包，等于把印章交给用户。

落地上拆成两个函数最省事：`getSession()` 只做验签与过期判断，返回 payload 或 `null`，middleware 与页面都能调用；`requireUser()` 在 `getSession()` 之后再去数据库确认账号状态，只在服务端组件与 Route Handler 里用。为什么不在 middleware 里查库？因为边缘运行时没有数据库驱动、也建不了连接池，就算用 HTTP 数据层硬查，每个静态资源请求都多一次外网往返，延迟立刻体现出来。

:::hint 有 cookie 只证明浏览器带了东西
伪造、过期、被踢下线这三种情况，验签能挡第一种，后两种必须再查一次账号状态。middleware 只做验签（无状态、能跑在边缘），「账号是否仍有效」留给服务端组件和 Route Handler。
:::

:::solution 签发端与服务端复核
```ts
// lib/session.ts —— 只在 Node 侧跑：签发与复核成对出现
import { createHmac, timingSafeEqual } from "node:crypto"

const b64 = (b: Buffer) => b.toString("base64url")

export function signSession(payload: { sub: string; exp: number; kid?: string }) {
  const body = b64(Buffer.from(JSON.stringify(payload)))
  return `${body}.${b64(createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest())}`
}

export function verifySession(token: string) {
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  const want = createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest()
  const got = Buffer.from(sig, "base64url")
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub: string; exp: number }
  return data.exp * 1000 > Date.now() ? data : null
}
```
```bash
# 四种 cookie 打同一个受保护页面：期望 307 / 307 / 307 / 200
for c in "" "session=abc.def" "session=$EXPIRED" "session=$VALID"; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" ${c:+-b "$c"} localhost:3000/dashboard
done
```
注意 `Buffer` 的 `base64url` 编码在边缘运行时不存在，middleware 那边只能用上面的 `verifySessionEdge`；两边共享同一份 payload 结构，签发集中在一处。
:::

:::error 无限重定向：ERR_TOO_MANY_REDIRECTS
现象：打开 `/login` 浏览器报 `ERR_TOO_MANY_REDIRECTS`，Network 面板里 `/login` 连续 307 指向自己。
根因：matcher 或判断条件把登录页也算进了受保护范围——未登录请求 `/login` 被跳到 `/login?next=/login`，又被拦，循环。
修复：matcher 只写受保护前缀（`/dashboard/:path*`）；并在重定向前加一句 `if (req.nextUrl.pathname === "/login") return NextResponse.next()`；最后确认 `/api` 与静态资源不在 matcher 里。
:::

**自测**（合上文档回答）

1. middleware 跑在什么运行时？为什么它里面不能 `await db.user.findUnique()`？
2. 跳转前为什么要用 `req.nextUrl.clone()`，而不是 `new URL("/login", req.url)`？
3. 只在 middleware 里判断「cookie 存在」时，攻击者用哪两种方式绕过？

**验收**

- [ ] `curl -i http://localhost:3000/dashboard/orders` 返回 307，`Location` 含 `/login?next=` 且 `next` 已编码
- [ ] 登录后回到 `/dashboard/orders?status=paid`（query 没丢）
- [ ] 控制台执行 `document.cookie="session=fake"` 后，页面与接口仍拒绝访问（说明边界在数据层，`verifySessionEdge` 返回 `null`）
- [ ] 直接访问 `/login` 不再产生重定向（Network 里只有一次 200）

---

### 第 8 周：会话与权限

**本周目标**：让「把 URL 里的组织 id 换成别家」的请求返回 404，并把租户条件写进每一条查询。

**为什么是这些内容**

第 7 周解决「没登录别进来」，这一周解决「登录了也别看别人的」。多租户系统里最昂贵的一类事故叫越权读取：把 `/org/acme/orders/123` 里的 `acme` 或 `123` 改一下，就看到别家公司的订单。它特别难发现，因为产品逻辑完全正常——测试同事用自己的账号怎么点都没问题，直到某个客户发来一张截图。

这一周要建立的是「租户身份的唯一来源」这个观念。如果组织 id 从 URL 读，那它就是用户输入，必须校验；如果它从会话读，那它就是服务端签发的事实。中间任何一处混用，都会在某个页面裂开一个口子。三层守卫（页面、接口、数据）不是流程洁癖，而是三层独立的失败面：页面守卫挡误入、接口守卫挡绕过界面、数据守卫挡越权 id，前两层被绕过时，第三层还在。

学不会的后果很直接：第 9 周的性能优化、第 12 周的灰度发布，都建立在一个不敢给第二个客户开账号的系统上；面试里被问「你怎么保证 A 公司看不到 B 公司的数据」，也只能答「我加了权限判断」，说不出判在哪一层。

#### 步骤 8.1 在 RSC 里读会话

先看一个典型现象：首屏闪一下「请登录」，随后变成用户名；打开 Network 面板，`/api/me` 被三个组件各请求了一次。原因是会话在客户端拿——组件 `useEffect` 里 `fetch`，挂载前它不知道用户是谁。

服务端组件里直接读就没有这一跳。`cookies()` 读的是本次请求携带的 Cookie 头，于是首屏 HTML 里已经带着用户名，水合前后一致，也不会多出请求。代价是：调用 `cookies()` 会把所在路由标记为动态渲染，构建输出里从 `○` 变成 `ƒ`，这一页失去整页静态缓存，每次访问都要回源。

三个坑要避。第一，Next 15 起 `cookies()` 返回 Promise，必须 `await`，忘了会拿到一个对象而不是值，报 `cookies().get is not a function`。第二，用 React 的 `cache()` 包一层——同一棵渲染树里五个组件都调 `getSession()`，签名验五次、查库五次，第 6 周学过的去重在这里正好用上。第三，只在服务端文件里 import，客户端组件里一 import 就会在打包期报 `You're importing a component that needs "next/headers"`。

```ts
// lib/session.ts
import { cache } from "react"
import { cookies } from "next/headers"

export const getSession = cache(async () => {
  const token = (await cookies()).get("session")?.value
  if (!token) return null
  return verifySessionEdge(token, process.env.SESSION_SECRET!)   // 只验签，不查库
})

export const currentUser = cache(async () => {
  const s = await getSession()
  if (!s) return null
  return db.user.findFirst({ where: { id: s.sub, disabledAt: null } })
})
```

逐行看：`cache()` 的键是参数（这里无参，等价于「本次请求内只算一次」），作用域随请求结束销毁，不会跨用户串数据；`verifySessionEdge` 来自第 7 周，负责签名与 `exp`；`currentUser` 才去数据库确认账号没被禁用，这一步是 middleware 做不到的。注意查询里带了 `disabledAt: null`——用户被停用后，旧 token 在过期前依然签名有效，这一句是唯一的拦截点。

会话 payload 里该放什么？只放 `sub`、`orgId`、`exp`、`kid` 这类短小且不常变的事实。别把角色塞进去：角色一小时前被降级，会话里的 `role` 还写着 `owner`，你就多了一个不会自动收敛的洞。角色在 `currentUser` 里查，读一次库换一次正确。

还有一条容易吃亏：`currentUser()` 的结果传给客户端组件时会被序列化进 HTML。整个 `user` 对象往下传，等于把 `passwordHash`、`email`、`phone` 一起送进浏览器。传之前显式挑字段，只给 `id` 与 `name` 这类展示必需的。

:::hint cookies() 的代价是「这一页不再静态」
凡是调了 `cookies()` / `headers()` / `searchParams` 的路由都会变动态。营销页、博客首页不要放会话读取，需要「登录了就显示头像」时，把那一小块做成客户端组件或用 Suspense 包起来。
:::

:::solution 参考实现（未登录时重定向）
```ts
// lib/auth.ts
import { redirect, notFound } from "next/navigation"
import { currentUser } from "./session"

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect("/login")        // 服务端组件里用 redirect，不要自己拼 Location
  return user
}

export async function requireOrgMember(orgId: string) {
  const user = await requireUser()
  const m = await db.member.findFirst({ where: { userId: user.id, orgId } })
  if (!m) notFound()                   // 不是成员 = 当作不存在
  return { user, role: m.role }
}
```
:::

#### 步骤 8.2 权限判定的三层

页面守卫做完之后，最常见的两个洞这样出现。其一，同事用 `curl` 直接打 Route Handler 或 Server Action——界面上的按钮藏了，端点还在，`POST /api/orders` 照样成功。其二，守卫放行之后，请求里换一个 `orderId`：页面判断的是「你能不能进这个组织」，查询判断的是「这条 id 存不存在」，没人判断「这条 id 属不属于这个组织」。

所以三层各写一次，缺一层就漏：

- 页面层：`layout.tsx` 里 `requireOrgMember(orgId)`，角色不够就 `notFound()`。挡误入，是体验。
- 接口层：Route Handler 与 Server Action 的第一行再判一次。必须假定前端可以被完全绕过——它本来就可以。
- 数据层：每条查询都带租户条件。这一层是唯一真正的安全边界。

数据层最容易写错的是「先查出来再判断」：`const o = await db.order.findUnique({ where: { id } }); if (o.orgId !== orgId) return null`。逻辑没错，但每个新接口都要记得补这一句，漏一个就是洞。把条件压进 `where` 就没有「忘了判断」这个可能。

Server Action 也是公开端点。它的地址会被写进客户端包，任何人拿到都能直接 POST；浏览器那层同源检查只挡跨站脚本发起的调用，挡不住一个 `curl`。所以「界面上没这个按钮」不算权限，Action 的第一行必须自己判一次。

```ts
// 数据层：租户条件进 where，不是查出来再比
export async function getOrder(orgId: string, id: string) {
  return db.order.findFirst({ where: { id, orgId } })
}

// 接口层：Route Handler 自己再判一次，不信前端
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { orgId, id } = await params
  const { user } = await requireOrgMember(orgId)
  if (!can(user.role, "order:read")) return new Response("forbidden", { status: 403 })
  const order = await getOrder(orgId, id)
  if (!order) return new Response("not found", { status: 404 })
  return Response.json(order)
}
```

这里的 `can()` 是一张纯函数权限表（角色 → 允许的动作），不碰数据库，好测也好改。`requireOrgMember` 负责「是不是这个组织的人」，`can` 负责「这个角色能不能做这件事」，两件事分开，读代码时不会互相干扰。

三层不是三次重复判断，而是三份不同的失败责任：页面层出 bug 的表现是「用户看到 500」，接口层出 bug 的表现是「绕过界面直接调成功」，数据层出 bug 的表现是「换个 id 就能读」。上线前给每层各写一条对抗用例，比再通读一遍代码有用。

:::hint 越权时返回 404，不要返回 403
403 等于告诉对方「这个 id 存在，只是你没权限」，这本身就是信息泄露：攻击者可以靠 403/404 的差异枚举出别家有多少订单。判断的顺序也要配合——先确认成员身份，再查带租户条件的记录，查不到一律 404。
:::

:::solution 参考实现（权限表 + Server Action）
```ts
// lib/perm.ts
const RULES = {
  owner:  ["order:read", "order:write", "member:invite"],
  admin:  ["order:read", "order:write"],
  member: ["order:read"],
} as const

export type Action = (typeof RULES)[keyof typeof RULES][number]
export function can(role: keyof typeof RULES, action: Action) {
  return (RULES[role] as readonly string[]).includes(action)
}

// app/org/[orgId]/orders/actions.ts
"use server"
export async function updateOrder(orgId: string, id: string, formData: FormData) {
  const { user } = await requireOrgMember(orgId)          // ① 成员身份
  if (!can(user.role, "order:write")) throw new Error("forbidden")   // ② 角色
  const r = await db.order.updateMany({ where: { id, orgId }, data: { note: String(formData.get("note")) } })
  if (r.count === 0) throw new Error("not found")         // ③ 租户条件写进 where
  revalidatePath(`/org/${orgId}/orders`)
}
```
:::

#### 步骤 8.3 把租户固定进会话：组织切换

走到这里，`orgId` 仍然来自 URL。它被三层校验护着，但每次新增一个页面、一个接口，都要重新记得校验一遍——这是「靠自觉」的安全。

更稳的做法：登录时把用户所属的组织写进会话，之后所有页面从会话取 `activeOrgId`，URL 里的那段只用于展示与路由。切换组织不是「改一下 URL」，而是一次需要重新签发的动作：Server Action 校验目标组织的成员身份 → 重写签名 cookie → 让缓存失效。

```ts
// app/actions/switch-org.ts
"use server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
// requireUser / signSession / nowSec / db 来自 lib 层，此处省略 import

export async function switchOrg(formData: FormData) {
  const user = await requireUser()
  const orgId = String(formData.get("orgId"))
  const m = await db.member.findFirst({ where: { userId: user.id, orgId } })   // 必须先校验
  if (!m) throw new Error("not a member")

  const token = signSession({ sub: user.id, orgId, exp: nowSec() + 60 * 60 * 8 }, process.env.SESSION_SECRET!)
  ;(await cookies()).set("session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
  })
  revalidatePath("/", "layout")     // 布局级缓存里可能还留着上个组织的数据
  redirect(`/org/${orgId}/dashboard`)
}
```

关键点：`httpOnly` 让浏览器脚本读不到 token，`secure` 要求 HTTPS，`sameSite: "lax"` 挡掉大部分跨站表单提交；`maxAge` 要与 token 的 `exp` 一致，否则浏览器还留着 cookie 而服务端已经判过期，用户会看到「莫名其妙被踢」。`revalidatePath("/", "layout")` 不能省：同一个布局里缓存的分区数据是按组织变化的。

两个边界情况要一起处理。第一，多标签页：用户在标签一里切到 B 组织，标签二还停在 A 组织的页面上，这时提交的表单带着 A 的 `orgId`——在 Action 里比对「表单里的 orgId」与「会话里的 activeOrgId」，不一致就拒绝并让前端刷新，比默默写进错误的组织安全得多。第二，会话固定：登录成功的瞬间要重新签发 token，不要复用登录前那个匿名会话的标识，否则攻击者可以先塞给你一个他知道的 token，等你登录后顺着它读数据。

还有一处容易漏的缓存维度：列表页用 `revalidateTag("orders")` 时，tag 必须带组织，否则 A 公司改一单会把 B 公司的列表缓存一起打掉——不串数据，但多租户下等于给所有人做了一次免费的缓存抖动。写成 `orders:${orgId}` 更稳，这也是第 4 周 tag 设计在这里的直接延续。

切完组织，旧标签页还能不能读旧组织的数据？不能：查询里的 `orgId` 来自会话，下一次请求就会被判成「不在该组织」，返回 404。这正是「从会话取租户」比「从 URL 取」值钱的地方——URL 能被改，签名的 cookie 不能。

:::hint 切换组织是一次「重新签发」，不是改 URL
租户要从会话里取，URL 那段只负责路由与展示。校验成员身份、重写签名 cookie、失效布局缓存这三件事必须一起做完，漏一件就会读到别的组织的数据。
:::

:::solution 读租户的出口只留一个
```ts
// lib/tenant.ts —— 页面与接口都从这里取租户，不要再从 params 取
import { cache } from "react"
import { requireUser } from "./session"

export const getActiveOrg = cache(async () => {
  const user = await requireUser()        // 已含验签 + 账号状态复核
  if (!user.orgId) throw new Error("no active org")
  return user.orgId
})

// 写入前再比对一次：多标签页下表单里的 orgId 可能已经过期
export async function assertSameOrg(formOrgId: string) {
  const active = await getActiveOrg()
  if (formOrgId !== active) throw new Error("org changed in another tab")
  return active
}
```
```ts
// tag 也要带组织，否则 A 公司改一单会把 B 公司的列表缓存一起打掉
revalidateTag(`orders:${orgId}`, "max")
```
验收口径：切到 B 组织后回到旧标签页刷新 → 404。因为查询里的 `orgId` 来自会话，改 URL 改不动它。
:::

:::error cookies 报 outside a request scope
现象：运行时报 `Error: cookies was called outside a request scope`，或构建期报 `Route /xxx couldn't be rendered statically because it used cookies`。
根因：在模块顶层、`generateStaticParams`、或客户端组件里调了 `cookies()`。前者没有请求上下文，后者根本没有请求头。
修复：把调用挪进服务端组件函数体或 Route Handler 内部；需要跨模块共享时用 `cache()` 包装后在函数里调用，不要 export 一个已经执行过的常量。
:::

**自测**（合上文档回答）

1. 为什么 `cookies()` 会让路由从 `○` 变成 `ƒ`？这个代价换来了什么？
2. 三层守卫里，哪一层能挡住「把 orderId 换成别人的」？另外两层为什么挡不住？
3. 越权访问为什么返回 404 而不是 403？判断顺序应该怎样？

**验收**

- [ ] 用账号 A 登录，访问属于 B 的订单 id：返回 404，服务端日志有一条 deny 记录
- [ ] 删掉 `session` cookie 后访问 `/org/acme/dashboard`：307 到 `/login`
- [ ] `next build` 输出里，带会话的页面标记为 `ƒ`，纯静态页仍是 `○`
- [ ] 切换组织后 cookie 中的 `orgId` 改变、页面数据随之变化；直接用旧组织的 id 访问被拒

---

## 阶段五 · 性能与可观测（第 9–10 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 |
| 这一阶段解决 | 从「感觉快」到「有预算、有数据、有回归」 |
| 核心知识 | Core Web Vitals、图片与字体、包分析、RUM、错误上报 |
| 场景项目 | 场景 #5：给现有应用做一次性能专项（出报告） |
| 离开时应该能 | 拿出改前/改后的 LCP、JS 体积、错误率 |

### 第 9 周：性能预算

**本周目标**：给首页写下三条可执行的预算（LCP、首屏 JS、错误率），并用一个脚本跑出改前与改后的数字。

**为什么是这些内容**

前八周把功能做对了，但「能上线」还包括「够快」。Core Web Vitals 是三个直接影响体验与搜索排名的指标：LCP 衡量最大那块内容多久画出来，INP 衡量从点击到界面有反应的延迟，CLS 衡量内容有没有乱跳。它们不是可选的优化项，而是发布门槛——一个 LCP 四秒的后台，用户会在加载动画里失去耐心，然后去点第二遍提交。

性能工作的分水岭是「有没有基线」。没有基线时，讨论会退化成「感觉有点慢」，改动也验证不了；有基线之后一句话就能说清：「这版把首屏 JS 从 310KB 降到 180KB，LCP 从 3.4 秒到 2.1 秒」。比基线更重要的是预算：它把「尽量快」变成「超过 200KB 就失败」，让性能在需求评审里也能投一票。

跳过这一周，第 10 周的包分析没有对比对象，第 12 周的灰度也失去观察指标——你只能等投诉，而投诉永远是「网站好卡」，说不清是哪一页、卡在哪一段。

还有一个很现实的理由：性能问题一旦上线，修复成本是发布前的十倍。你要面对已经预热过的 CDN、已经装了旧版本的客户端、和不敢随便回滚的数据迁移。把预算卡在本地，等于把这类修复提前到一次提交之内——改一个 `priority` 比发一次热修便宜太多。

#### 步骤 9.1 建立基线并定预算

先看一个常见错位：本地 Lighthouse 打 95 分，线上真实用户的 LCP 却是 4.1 秒。这不是工具在骗人，是两种环境差得太远——跑分机器的 CPU 更快、网络是内网、CDN 缓存是热的；而用户可能在地铁里用 4G，并且是当天第一次访问。

所以要分两种数据看。lab 数据（Lighthouse、PageSpeed Insights）可复现、能定位到具体是哪张图哪个脚本，但偏乐观；field 数据（CrUX 或自建 RUM）来自真实用户，但滞后几天，而且只有分位数。**定预算用 field 的 P75**：75% 的用户达标才算达标，平均值会被少数极快的用户拉得好看。

阈值按现行口径记：LCP 良好 ≤2.5 秒、差 >4 秒；INP 良好 ≤200 毫秒、差 >500 毫秒；CLS 良好 ≤0.1、差 >0.25。首屏 JS 不在 CWV 里，但它是你唯一能在本地硬卡住的一条，直接用 `next build` 输出的 First Load JS。

CLS 的来源常被猜错：多数时候不是图片，而是「页面加载后才插进来的元素」——cookie 同意横幅、顶部促销条、异步拉回来的推荐位。它们插进文档流的那一刻把下面的内容整体推下去，一次就能贡献 0.2 以上。给这类元素预留固定高度，或者让它脱离文档流，比事后调图片尺寸有效得多。

```bash
# 1) 必须测生产构建，dev server 带 HMR 与 source map，分数没有参考意义
npm run build && npm run start &

# 2) 采一次 lab 数据，输出 JSON 方便脚本读取
npx --yes lighthouse http://localhost:3000/ \
  --only-categories=performance \
  --output=json --output-path=./lh.json \
  --chrome-flags="--headless=new --no-sandbox"

# 3) 只看关心的三个数
node -e "const a=require('./lh.json').audits;console.log('LCP',a['largest-contentful-paint'].displayValue,'CLS',a['cumulative-layout-shift'].displayValue,'TBT',a['total-blocking-time'].displayValue)"
```

逐行看：第一步测的是 `next start` 的产物，不是 `next dev`；`--only-categories=performance` 跳过无障碍与 SEO 采集，省一半时间；`--no-sandbox` 在容器与 CI 里是必需的，否则 Chrome 根本起不来；最后一行打印的是 `displayValue`，而步骤 9.3 的门禁会改用同一份 JSON 里的 `numericValue`。

顺带一个习惯：进预算表的永远用 `numericValue`（毫秒），不要用 `displayValue`（给人看的字符串），更不要用性能总分——它是几个指标加权合成的，Lighthouse 换版本权重就变，拿它当门禁会在某次升级后突然全红。

预算写成表，每行必须有「当前值 / 预算 / 超标先看什么」，否则数字只是数字：

```text
页面         LCP(移动)  首屏JS    CLS     超标先看
/            2.1s       180KB     0.02    首屏大图与字体
/dashboard   3.4s       310KB     0.11    图表库是否全量引入
```

:::hint 预算必须带单位和判定方式
「LCP 要快」不是预算。「LCP ≤ 2.5s、首屏 JS ≤ 200KB、错误率 ≤ 0.1%，P75 口径，超了就 exit 1」才是。写不出判定方式的指标，两周后一定会被忘掉。
:::

:::solution 参考实现（用 RUM 收 field 数据）
```tsx
// app/_components/vitals.tsx
"use client"
import { useReportWebVitals } from "next/web-vitals"

export function Vitals() {
  useReportWebVitals((m) => {
    const body = JSON.stringify({ name: m.name, value: m.value, id: m.id, path: location.pathname })
    navigator.sendBeacon("/api/vitals", body)   // beacon 不阻塞卸载，比 fetch 更适合埋点
  })
  return null
}
```
上报接口里按 `name` 分别聚合 P75，一周后你就有自己的 field 基线，不必等 CrUX 的月度数据。
:::

#### 步骤 9.2 图片、字体、第三方脚本

这三样按对 LCP 的影响排，基本覆盖了大多数「首屏慢」的现场。

首屏大图往往就是 LCP 元素本身。`next/image` 会自动生成 `srcset` 与现代格式，但它默认 `loading="lazy"`——首屏图被懒加载，浏览器要等布局算完、进入视口才开始下载，LCP 硬生生推迟一个网络往返。给 `priority` 才会预加载并带上 `fetchpriority="high"`。同时必须给 `width`/`height`（或 `fill` 配一个有尺寸的父容器），否则图片解码完成后把内容撑开，CLS 当场超标。

图片这一项还有两个常被跳过的开关：`next/image` 默认已经在协商 AVIF 与 WebP，但前提是你没有用 `unoptimized`；以及 `src` 指向本地 `public/` 还是远程域名——远程图必须在 `next.config.ts` 的 `images.remotePatterns` 里登记，否则运行时报 `hostname is not configured`，这条报错常常在开发环境被 `unoptimized` 掩盖，上线才炸。

字体是第二个坑。自定义字体默认会阻塞文本渲染，用户盯着空白等到字体下载完。`next/font` 把字体自托管到你的域名（省掉第三方 DNS 与 TLS 握手），`display: "swap"` 让文本先用系统字体显示、字体到了再替换；`adjustFontFallback` 会按真实字体的度量调整 fallback，把换字体那一下的跳动压下去。

第三个是第三方脚本：统计、客服、A/B 测试最容易被写成同步 `<script>`，直接把主线程堵住。`next/script` 的 `afterInteractive`（默认）在水合后加载，`lazyOnload` 更晚；只有必须在水合前执行的（比如同意管理）才用 `beforeInteractive`，统计类脚本一律不要。

```tsx
import Image from "next/image"
import Script from "next/script"
import localFont from "next/font/local"

const inter = localFont({ src: "./inter.woff2", display: "swap", adjustFontFallback: "Arial" })

export default function Hero() {
  return (
    <section className={inter.className}>
      {/* priority 只给首屏这一张；下面内容的图保持默认懒加载 */}
      <Image src="/hero.avif" alt="产品截图" width={1200} height={600} priority sizes="100vw" />
      <Script src="/analytics.js" strategy="afterInteractive" />
    </section>
  )
}
```

关键点：`sizes="100vw"` 告诉浏览器这张图会铺满视口，它才会选对 `srcset` 里的那一档，否则移动端会下载桌面尺寸；`priority` 是全局排他的，给两张等于没给——预加载互相挤占带宽，LCP 反而更差；`adjustFontFallback` 只在本地字体（`localFont`）上可用，`next/font/google` 是自动算的。

:::hint 先找 LCP 元素，再谈优化
打开 Lighthouse 的「Largest Contentful Paint element」，它会直接告诉你是哪张图或哪段标题。只优化那一个元素，比把所有图片都加 `priority` 有效十倍。
:::

顺带两个几乎零成本的收益：图片走同一域名的 CDN 并带上 `Cache-Control: public, max-age=31536000, immutable`（文件名里有 hash 才能这么激进）；第三方脚本能自托管就自托管，省一次 DNS 与 TLS，也顺手绕开对方的可用性事故——统计脚本挂掉不该让你的首屏跟着一起等。

:::solution 首屏三件套的最小验证
```bash
# 1) 先让 Lighthouse 点名 LCP 元素，别把整页图片都加 priority
npx --yes lighthouse localhost:3000/ --only-categories=performance --output=json --output-path=./lh.json
node -e 'const a=require("./lh.json").audits;console.log(a["largest-contentful-paint-element"].details.items[0])'

# 2) 首屏图必须预加载：HTML 里应能搜到 fetchpriority="high"
curl -s localhost:3000/ | grep -o 'fetchpriority="high"'
```
```ts
// next.config.ts —— 远程图没登记会在运行时报 hostname is not configured
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "cdn.example.com" }] },
}
export default nextConfig
```
口径：`priority` 只给 LCP 那一张；字体用 `next/font` 自托管 + `display: "swap"`；统计类脚本一律 `afterInteractive` / `lazyOnload`，`beforeInteractive` 只留给同意管理。
:::

:::error CI 里 Lighthouse 报 NO_FCP / Chrome launch failed
现象：本地跑得好好的，CI 上直接失败，报 `Runtime error encountered: Chrome launch failed` 或 `The page did not paint any content (NO_FCP)`。
根因：容器里没有 Chrome，或有 Chrome 但没加 `--no-sandbox`；NO_FCP 多半是测到了 `next dev` 首次编译——页面十秒内还是空白。
修复：CI 里装 `chrome-headless-shell` 或显式设 `CHROME_PATH`，参数加 `--no-sandbox --disable-dev-shm-usage`；先 `next build && next start` 再跑测试；把 `--max-wait-for-load` 调到 45000 毫秒排除慢机器。
:::

#### 步骤 9.3 把预算变成门禁

预算写在文档里，两周后 LCP 从 2.1 悄悄涨到 4.3，没人发现——因为没人跑。让它自动跑，超了就红，才叫预算。

一个几十行的脚本就够：读 `lh.json` 拿 LCP，读 `.next/app-build-manifest.json` 拿首页用到的 chunk 并累加体积，与阈值比较，超标 `process.exit(1)`。

```js
// scripts/check-budget.mjs
import fs from "node:fs"

const BUDGET = { lcpMs: 2500, jsKb: 200 }
const a = JSON.parse(fs.readFileSync("lh.json", "utf8")).audits
const lcpMs = a["largest-contentful-paint"].numericValue

const app = JSON.parse(fs.readFileSync(".next/app-build-manifest.json", "utf8"))
const jsKb = (app.pages["/page"] ?? [])
  .reduce((n, f) => n + fs.statSync(`.next/${f}`).size, 0) / 1024

const fails = []
if (lcpMs > BUDGET.lcpMs) fails.push(`LCP ${Math.round(lcpMs)}ms > ${BUDGET.lcpMs}ms`)
if (jsKb > BUDGET.jsKb) fails.push(`首屏 JS ${jsKb.toFixed(0)}KB > ${BUDGET.jsKb}KB`)

if (fails.length) {
  console.error("预算超标：\n- " + fails.join("\n- "))
  process.exit(1)
}
console.log(`✓ LCP ${Math.round(lcpMs)}ms / 首屏 JS ${jsKb.toFixed(0)}KB`)
```

这里的 `process.exit(1)` 是关键：CI 只认退出码，打印一行警告等于没写。`app.pages["/page"]` 对应 `app/page.tsx` 的路由键，换成 `/dashboard/page` 就是看另一个页面；chunk 列表已经包含框架与共享包，所以它比 Lighthouse 的「未使用 JS」更接近用户真正要下载的量。想同时守住几个页面，把这段包成函数、循环一张 `{路由: 预算}` 表即可。小心一个坑：路由键写错时 `?? []` 会让体积算成 0，预算永远通过——所以先 `console.log` 一下拿到的文件数，确认不是空数组。

第三条预算「错误率」不来自 Lighthouse，而来自前端上报：`window` 的 `error` 事件与 `unhandledrejection` 各打一个点，按「出过错的会话数 / 总会话数」算，超过 0.1% 就去查最近的发布。同一类错误要按「消息 + 文件」聚合，否则一个循环里的报错会把分母冲垮。

INP 也不适合塞进这个脚本：它必须在真实交互里才产生数据，headless 跑不出来。守 INP 的办法是从 RUM 取 P75、按周看趋势，超过 200 毫秒再去定位是哪个交互——通常是某次点击触发了同步渲染一个长列表，改法是分页或 `startTransition`。

挂到 CI 上，顺序不能反：先构建、再起服务、再跑 Lighthouse、最后跑预算脚本。少了「起服务并等到 200」这一步，Lighthouse 会稳定地死在连接被拒绝，而这类失败最容易被当成环境问题顺手跳过。

```yaml
# CI 里的关键三步（安装依赖略）
- run: npm run build && (npm run start &) && npx wait-on http://localhost:3000
- run: npx --yes lighthouse http://localhost:3000/ --only-categories=performance \
    --output=json --output-path=./lh.json --chrome-flags="--headless=new --no-sandbox"
- run: node scripts/check-budget.mjs
```

这一段里的 `wait-on` 不能省，也不能用 `sleep 10` 代替——冷启动时间在不同机器上能差一倍，睡短了连接被拒，睡长了每次 CI 白等。等到服务真的应答 200，再让 Lighthouse 进去。

:::hint 门禁要先能红，再谈守护
没红过的检查等于没有检查：先把阈值压到不可能通过的值跑一次，确认退出码是 1，再改回来。
:::

:::solution 先证明它会失败
```bash
# 1) 把 BUDGET.lcpMs 临时改成 1，跑一次：期望 exit=1 且列出超了哪一项
node scripts/check-budget.mjs; echo "exit=$?"

# 2) 改回真实阈值，同一份 lh.json 再跑：期望 exit=0 并打印 ✓
node scripts/check-budget.mjs; echo "exit=$?"

# 3) 确认 CI 里没有 `|| true` 把退出码吞掉
grep -n 'check-budget' .github/workflows/*.yml
```
三条预算分三档落地：首屏 JS 与 LCP 进 CI（前者构建后即可算，后者要先起服务），错误率进线上告警，INP 只看周趋势。混在一个脚本里，任何一项环境抖动都会把整条流水线拖红。
:::

**自测**（合上文档回答）

1. 为什么定预算要看 field 的 P75，而不是 lab 分数或平均值？
2. 首屏图不给 `priority` 会发生什么？为什么它不能给两张？
3. 预算脚本为什么要 `process.exit(1)`，只打印警告会怎样？

**验收**

- [ ] 记录表里至少三行，每行的 LCP、首屏 JS、CLS 都有当前值与预算
- [ ] `node scripts/check-budget.mjs` 正常时打印 `✓`，`echo $?` 输出 0
- [ ] 把 `BUDGET.lcpMs` 临时改成 500，脚本退出码为 1 并打印超出多少
- [ ] 表格里的首屏 JS 与 `next build` 输出的 First Load JS 相差不超过 5KB

---

### 第 10 周：包分析与可观测

**本周目标**：用构建输出和包分析报告指出首屏 JS 里最大的三个依赖，并把一条体积预算做成会在 CI 里失败的检查。

**为什么是这些内容**

第 9 周定下了三条预算，但预算本身不会让页面变快，它只负责在超标时亮红灯。灯亮之后，第一个问题永远是「超在哪」。没有包分析，你只能猜：是不是图表库、是不是图标全量引入、是不是某个 polyfill。猜错的代价是把组件改了一通，体积纹丝不动，最后得出「Next 就是慢」这种错误结论。包分析把这步变成看图：哪个模块占多大面积，一眼就能看见。

第二件事是可观测，它管的是发布之后。线上真实的慢和错，跟本地构建出来的数字往往不是一回事：用户在弱网、在旧手机、在某条特定数据下才会触发。如果日志里只有一行 `GET /api/orders 200`，你既不知道是哪一次请求，也不知道它花了多久，更不知道前端那次报错对应服务端的哪一行。这一周要养成的习惯是：任何一次请求都能被一个 id 串起来，任何一次用户报错都能在日志里找到对应记录。

第三件事是把预算接进流水线。写在文档里的预算，两周后就会被忘记；写进 CI 的预算，每次 PR 都会替你记着。这一周结束时，你应该能在一个新项目里用半小时搭起「构建 → 分析 → 卡预算」这条链，而不是等页面卡了才回头补。

#### 步骤 10.1 找出首屏包里的大件

跑一次 `npm run build`，看每个路由那行 `First Load JS`。假设首页写着 `310 kB`，而底部「First Load JS shared by all」是 `103 kB`——剩下两百多 kB 是这个路由独有的，值得追。但构建输出只给总数不给构成，打开 `.next/static/chunks/` 只会看到一堆哈希命名的文件，读不出任何信息。

包分析器的原理不复杂：webpack 在构建时本来就知道每个模块进了哪个 chunk、占多少字节，`@next/bundle-analyzer` 只是把这份 stats 渲染成矩形树图，面积等于体积。所以它看到的是构建期的真实构成，不是估算。要盯着压缩后的数字看：原始体积大的模块压缩后可能很小，真正拖慢首屏的是压缩后仍然大的那些。

读图有固定顺序：先看面积最大的三块，再看它们是从哪个入口被带进来的。最常见的元凶是 barrel 文件——`import { Button } from "@/components"` 会把 `index.ts` 里重导出的所有组件都拉进依赖图，哪怕你只用了一个。第二常见的是全量引入：`import * as Icons from "lucide-react"`、`import _ from "lodash"`、整个 `moment` 连全部 locale。第三是只在交互时才需要的重型库：图表、富文本编辑器、PDF 预览。

改的时候按代价从低到高：① 把不需要交互的部分挪回服务端组件，它压根不该进客户端包；② 换成按需导入；③ 最后才用 `next/dynamic` 延迟加载。顺序反了，就会用「加一个 loading 状态」去解决「本来就不该下载」的问题。

还有一条纪律：一次只改一处，改完重新构建、重新看报告。同时动三个依赖，体积降了也不知道是谁的功劳，下次再超就还是抓瞎。把每次的「改前 / 改后」数字记在同一张表里，这份表比任何优化技巧都更能说明问题。

```ts
// next.config.ts
import type { NextConfig } from "next"
import withBundleAnalyzer from "@next/bundle-analyzer"

const config: NextConfig = {
  // 其余配置原样保留
}

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(config)
```
```json
// package.json 的 scripts 片段
{
  "scripts": {
    "build": "next build",
    "analyze": "ANALYZE=true next build"
  }
}
```

逐行看：`withBundleAnalyzer` 是一个高阶函数，`enabled` 为假时原样返回配置，所以日常构建不受影响；为真时构建结束会起一个本地服务并打开报告页。Windows 的 `cmd` 不支持 `VAR=value cmd` 这种前缀写法，用 `cross-env`，或在 PowerShell 里先 `$env:ANALYZE="true"` 再 `npm run build`。还有一个版本差异要注意：Next 16 起构建默认走 Turbopack，而 analyzer 读的是 webpack 的 stats，分析时显式加 `next build --webpack`，或者直接看构建输出的路由体积表。

:::hint 先想「能不能不进包」，再想「怎么晚点进包」
动态导入只是把下载延后，包还是那么大；把组件挪到服务端才是真正让它消失。报告里那些「点了才出现」的模块，优先检查它为什么会在首屏依赖图里。
:::

:::solution 两种改法
```tsx
// 改法一：延迟加载（组件本身要能独立存在，这段在客户端组件里）
"use client"
import dynamic from "next/dynamic"

const LineChart = dynamic(() => import("@/components/LineChart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded bg-zinc-100" />,
})

// 改法二：先砍依赖，再谈延迟
// 改前：import { Line } from "recharts"（整个库进首屏）
// 改后：只引需要的入口，或换成手写 SVG 折线
```
:::

#### 步骤 10.2 错误与慢请求的可观测

线上最常见的两种反馈是「刚才点了没反应」和「页面报错了，就一句话」。日志里对应的往往只有一行 access log：`GET /api/orders 200`。你不知道那是哪一次请求、慢在数据库还是慢在序列化、前端弹的错误又对应服务端哪一行。这一节要解决的就是把「一次请求」变成日志里一条能被检索的记录。

做法是三件事叠加：一个贯穿请求的 id、一条 JSON 格式的日志、一个统一的错误出口。id 优先用上游传进来的 `x-request-id`（网关或前端生成），没有就自己生成一个 UUID；日志不要拼字符串，直接 `JSON.stringify` 一个对象，这样日志系统能按字段查询；正常和异常都打一条，耗时用 `performance.now()` 前后相减。

Next 还有一个专门的排障线索：`digest`。生产构建会捕获服务端渲染期间的异常，生成一个短哈希，同一个哈希既写进服务端日志，也挂到发给客户端的 error 对象上。所以在 `error.tsx` 里把 `error.digest` 显示出来，用户报错时提供这串，你在日志里 grep 就能定位。两个前提要记住：digest 只在生产构建里有值，`next dev` 下是 `undefined`；Route Handler 里抛的异常不经过 React 渲染树，不会自动产生 digest，得靠你自己生成的 request id。

```ts
// lib/log.ts
export function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }))
}

export async function withRoute(req: Request, fn: () => Promise<Response>) {
  const rid = req.headers.get("x-request-id") ?? crypto.randomUUID()
  const started = performance.now()
  const path = new URL(req.url).pathname
  try {
    const res = await fn()
    const out = new Response(res.body, res)   // fetch 的响应头只读，复制一份再改
    out.headers.set("x-request-id", rid)
    log({ rid, path, status: out.status, ms: Math.round(performance.now() - started) })
    return out
  } catch (err) {
    const e = err as Error
    log({ rid, path, ms: Math.round(performance.now() - started), error: e.message, stack: e.stack })
    return Response.json({ error: "internal", rid }, { status: 500 })
  }
}
```

关键点在 `new Response(res.body, res)` 这一行：`fetch` 返回的响应头是只读的，直接 `res.headers.set` 会抛 `TypeError: immutable`，先复制一份再改才不会踩坑。把 id 回写给调用方之后，用户截图里的响应头、网关日志、应用日志三者就对上了。异常分支里**不要**把 `e.stack` 返回给浏览器，那是信息泄露；只回 rid，让用户报编号。`performance.now()` 比 `Date.now()` 精度高，测毫秒级耗时更稳。

日志要打到标准输出而不是写文件：容器里写文件，重启就没了；标准输出由平台收集，还能按字段建索引。一条请求一条日志，不要在一次请求里打十几条，否则查起来比不打还累。

:::hint digest 与 request id 是两条线，别混
digest 串的是「服务端渲染抛错 → 前端 error.tsx」；request id 串的是「一次 HTTP 请求 → 日志」。两条都留，排障时先用 digest 找到请求，再用 request id 找到那次请求的全部日志。
:::

:::solution 接到路由与错误边界上
```ts
// app/api/orders/route.ts
import { withRoute } from "@/lib/log"

export async function GET(req: Request) {
  return withRoute(req, async () => {
    const rows = await db.order.findMany()
    return Response.json(rows)
  })
}
```
```tsx
// app/error.tsx
"use client"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <p>出错了，编号 {error.digest ?? "dev"}</p>
      <button onClick={reset}>重试</button>
    </div>
  )
}
```
:::

#### 步骤 10.3 把预算写成一条会失败的检查

预算只有两种命运：被自动检查，或者被忘记。这一步把它落到「构建产物」这个可以精确测量的对象上。首屏 JS 的体积在构建后就是确定的，压缩后多少字节可以逐字节算出来，所以它适合放进 CI，每次 PR 都拦一次；LCP 依赖网络与设备，放进每晚的定时任务更合适；错误率只有线上才有，进告警。三个指标三个关卡，不要混在一个脚本里。

工具用 `size-limit`（配 `@size-limit/file` 插件）：它读构建产物、按压缩后的大小判定、同时打印 Brotli 与 gzip 两个数值、超限时退出码为 1，正好能被 CI 直接消费。配置按路由写，别全站一个数——首页 200 kB、后台列表 260 kB，各自的预算应该反映各自的职责。写完之后一定要做一次反向验证：把 limit 临时改成 1 kB，确认命令真的红，再改回来。没红过的检查等于没有检查。

```json
// package.json 片段
{
  "scripts": { "budget": "size-limit" },
  "size-limit": [
    { "name": "shared runtime", "path": ".next/static/chunks/*.js", "limit": "120 kB" },
    { "name": "home", "path": ".next/static/chunks/app/page-*.js", "limit": "80 kB" }
  ]
}
```
```text
路由         预算(First Load JS)   实测      结论
/            200 kB               183 kB    通过
/dashboard   260 kB               288 kB    超标：图表库全量引入
```

路径要以你项目 `.next/static/chunks` 里的真实文件名为准，Next 的小版本之间 chunk 命名会变；预算表里要写清是 Brotli 还是 gzip，口径混了就会得出互相矛盾的结论。CI 里只加一步 `npm run build && npm run budget`，失败信息会直接列出超限的文件和超出多少，比一句「性能不达标」有用得多。

CI 红了不要第一反应去调高数字。先看是哪个 chunk 涨的，再决定是「这次确实需要」还是「又引入了一个全量包」。预算的意义就在这里：它逼你在合并前回答一次「这 20 kB 值不值」。

:::hint 预算卡的是「新增」，不是「存量」
老项目第一次接入时，先把当前体积当基线，之后只允许下降或持平。一上来就按理想值卡，只会逼着大家加 `--no-verify`。
:::

:::solution 反向验证三条命令
```bash
# 1) 先算基线，再把实测值写进 size-limit（卡新增，不卡理想值）
npm run build && npx size-limit

# 2) 证明它真的会红：把 package.json 里某条 limit 临时改成 "1 kB"
npm run budget; echo "exit=$?"     # 期望非 0，且报出超限文件与超出多少

# 3) 改回真实预算，CI 里就只留这一步
npm run build && npm run budget
```
口径：一个路由一条 `limit`，各自反映职责；表里写清是 Brotli 还是 gzip；红了先查是哪个 chunk 涨的，再决定要不要调数字。
:::

:::error 三个真实会撞上的报错
```text
Error: Cannot find module '@next/bundle-analyzer'
```
↓ 装成了全局或没进 devDependencies：`npm i -D @next/bundle-analyzer`，并确认配置里是 `import`。

```text
Error: `ssr: false` is not allowed with `next/dynamic` in Server Components.
```
↓ 在服务端组件里写了 `dynamic(..., { ssr: false })`。把这段挪进一个 `"use client"` 的包装组件，或者去掉 `ssr: false`。

```text
Module not found: Can't resolve 'fs'
```
↓ 服务端专用模块被客户端组件引用了。检查 `"use client"` 边界，把这段逻辑移进 Route Handler 或服务端组件。
:::

**自测**（合上文档回答）

1. 一个路由的 First Load JS 是 310 kB，其中 103 kB 是 shared，剩下两百多 kB 该怎么定位到具体依赖？
2. 用户只给你一串 digest，你怎么在服务端日志里找到那次报错？Route Handler 抛的错也有 digest 吗？
3. 体积预算在 CI 里通过了，线上 LCP 仍然超标，至少说出两个原因。

**验收**

- [ ] `ANALYZE=true npm run build`（Turbopack 项目加 `--webpack`）能打开报告，并写下首屏最大的三个依赖及各自体积
- [ ] 把 `size-limit` 的 limit 临时改成 1 kB，`npm run budget` 退出码为 1；改回后为 0
- [ ] 调一次会抛错的 Route Handler，响应头里有 `x-request-id`，日志里能 grep 到同一个值
- [ ] 制造一次渲染错误，`error.tsx` 显示的 digest 与终端日志里的 digest 一致

---

## 阶段六 · 工程与发布（第 11–12 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 → L4 边界 |
| 这一阶段解决 | 从「能部署」到「敢发、能回滚、可协作」 |
| 核心知识 | standalone 构建、环境变量分层、测试策略、灰度与回滚 |
| 场景项目 | 场景 #6：把一个多页应用做成可发布产物 |
| 离开时应该能 | 独立设计一次发布，并说清回滚路径 |

### 第 11 周：构建产物与配置

**本周目标**：用 standalone 产出不含开发依赖的运行产物，并说清每个环境变量在构建期还是运行期生效、会不会进浏览器包。

**为什么是这些内容**

前十周做的是「应用对不对」，这一周开始做「交付稳不稳」。本地 `npm run build && npm start` 能跑，不代表能上线：镜像动辄 1GB，发布一次拉五分钟；`.env.local` 里配好的变量进了容器变成 undefined；更糟的是某个密钥被 `NEXT_PUBLIC_` 前缀带进浏览器包，任何人打开 DevTools 都能看见。这三类事故的共同点是「本地完全正常」，所以只能靠对构建产物的理解来预防。

standalone 解决体积与启动速度，环境变量分层解决「同一个产物能不能跨环境」。两件事必须一起学：只做 standalone，镜像小了但配置还是写死的，换环境照样要重新构建；只做变量分层，镜像里还塞着几百 MB 的开发依赖，每次发布都在浪费时间和带宽。学完这一周，你应该能做到「构建一次，用不同的环境变量跑预发和生产」，并且能用一条命令验证「客户端包里没有任何密钥」。

还有一层常被忽略：镜像构建缓存。把 `COPY package*.json` 和 `COPY . .` 分开写，依赖没变时 `npm ci` 这一层直接命中缓存，改一行页面代码的构建时间能从五分钟降到四十秒。发布频率越高，这一层的价值越明显。

#### 步骤 11.1 standalone 输出

先看现象：`docker images` 里自己的应用 1.2GB，其中 `node_modules` 占了 800MB，但运行时真正被加载的只有几十个包。原因是普通构建把整个 `node_modules` 和源码一起拷进镜像，而 Next 早就不需要这些。

`output: "standalone"` 让 Next 在构建时做一次静态追踪：从 `server.js` 出发，顺着 `require` 与 `import` 找出运行时真正会加载的文件，复制进 `.next/standalone`，并在里面生成一份精简的 `node_modules`。产物里已经有 `server.js`、`.next/server` 和必要的依赖。有三样东西它**不会**自动带：`.next/static`（浏览器要下载的 chunk）、`public`（图片字体等静态文件）、以及项目根目录的配置文件。漏掉前两个，线上表现就是页面 HTML 正常、所有 JS 和图片 404。

```ts
// next.config.ts
import path from "node:path"
import type { NextConfig } from "next"

const config: NextConfig = {
  output: "standalone",
  // monorepo 里要指到仓库根，否则追踪范围算错；用 cwd 避免 ESM 下没有 __dirname
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
}
export default config
```
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

逐行看：`npm ci` 严格按 lockfile 安装，构建可复现；`COPY --from=builder /app/.next/standalone ./` 把 `server.js` 放在 `/app` 根；`COPY .next/static ./.next/static` 的目标必须是 standalone 内部的 `.next/static`，写成 `./static` 就错了；`HOSTNAME=0.0.0.0` 建议显式写，部分版本的默认值不是它，会出现端口映射了却连不上；启动命令是 `node server.js`，不是 `next start`——standalone 产物里没有 `next` 这个命令行工具。

还有一个隐形大头：构建上下文。`COPY . .` 会把 `.next`、`node_modules`、`.git` 一起送进 daemon，几个 GB 的上下文会让每次构建先卡在传输上。在项目根放一个 `.dockerignore`，至少排除 `node_modules`、`.next`、`.git`、`*.log`，构建时间和镜像层数都会立刻下降。

再给容器加一个健康检查：`HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/ || exit 1`。编排系统据此判断「起来了没有」，比看进程在不在准；后面灰度切流量也应该以这个检查为准，而不是以 `docker ps` 的状态为准。

如果你的页面用了 `next/image`，再确认一下 `sharp` 有没有进产物：图片优化在 standalone 模式下依赖它，缺失时页面能开、图片却全部降级或报错。用 `docker run --rm app:test node -e "require.resolve('sharp')"` 能直接验证。

:::hint 验证 404 比看体积更重要
镜像小不代表对。启动后一定要打开 DevTools 看 `_next/static/` 下的 chunk 是不是 200，这一步能立刻暴露漏拷静态资源。
:::

:::solution 三条验证命令
```bash
du -sh .next/standalone                       # 通常几十 MB，视依赖而定
docker build -t app:test .
docker run --rm -p 3000:3000 app:test
curl -sI http://127.0.0.1:3000 | head -n 1     # HTTP/1.1 200 OK
curl -sI http://127.0.0.1:3000/_next/static/chunks/main-app.js | head -n 1
```
:::

#### 步骤 11.2 环境变量分层

现象很典型：本地 `.env.local` 里配了 `DATABASE_URL`，构建、启动都正常；打成镜像跑起来，第一次查询就报连接失败，日志里 `process.env.DATABASE_URL` 是 `undefined`。另一种更隐蔽：功能一切正常，但 `grep -r "sk_live" .next/static` 能搜到密钥。

根因是 Next 的两套机制。`NEXT_PUBLIC_` 前缀的变量在**构建期**被替换成字面量写进客户端代码，构建完成后就改不了了；没有前缀的变量只在服务端通过 `process.env` 读取，运行时是什么就是什么。加载顺序也要记清：`process.env` 优先级最高，然后是 `.env.<NODE_ENV>.local`、`.env.local`、`.env.<NODE_ENV>`、`.env`。standalone 产物默认不带 `.env*`，因为只有被代码 import 的文件才会被追踪进去；容器里应该用 `-e` 或 `--env-file` 注入，这也正是「运行期」那一层该有的样子。

防线要建在代码里，而不是靠人记住。先 `npm i server-only`，用它标记服务端配置模块：一旦有客户端组件 import 它，构建直接失败，而不是悄悄变成 `undefined`。再用 schema 在模块加载时校验，缺变量就立刻抛错——启动即失败，比跑到半夜某个定时任务才发现要好。

还有一类风险来自「把环境文件当配置提交」：`.env.production` 里带着真实连接串进了仓库，之后所有能读仓库的人都有了生产密码。约定很简单：`.env` 只留示例键和注释，真实值从密钥管理系统注入；`.gitignore` 里排除 `.env*.local`，提交前用 `git grep` 自查一遍。

```ts
// lib/env.ts
import "server-only"
import { z } from "zod"

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  RELEASE: z.string().default("dev"),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error("环境变量不合法：", parsed.error.issues.map((i) => i.path.join(".")))
  throw new Error("invalid server env")
}
export const env = parsed.data
```
```ts
// lib/public-env.ts —— 只放可以公开的信息
export const publicEnv = {
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? "/api",
}
```

`import "server-only"` 这一行是编译期护栏；`safeParse` 而不是 `parse`，是为了在抛错前把「缺了哪几个」一次列全，而不是修一个报一个；`RELEASE` 这种用来在页脚显示版本号的变量给默认值，避免本地开发被卡住。客户端那份只放 API 根路径这类公开信息，任何 token、连接串、内部域名都不许出现在 `NEXT_PUBLIC_` 后面。

密钥泄露这件事，事后补救的代价远大于事前检查。接入 CI 时加一条 `grep` 就够：在 `.next/static` 里搜几个关键前缀（`sk_`、`AKIA`、`-----BEGIN`），命中就让构建失败。它拦不住所有情况，但能拦住最常见的那种——有人图省事把密钥写进了 `NEXT_PUBLIC_`。

:::hint 构建期替换是「写死」，不是「读取」
`NEXT_PUBLIC_API_BASE` 在 bundle 里就是一段字符串常量。想让同一个镜像换环境，就别把会变的东西放进 `NEXT_PUBLIC_`。
:::

:::solution 分层清单
```text
构建期（进产物，改要重建）   运行期（容器注入，改只需重启）
NEXT_PUBLIC_*                DATABASE_URL
basePath / rewrites          SESSION_SECRET
图片域名白名单                REDIS_URL / 第三方密钥
```
:::

#### 步骤 11.3 构建一次，三个环境都能跑

真正要守住的原则是 build once, run anywhere：镜像构建一次，预发和生产用不同的环境变量启动同一个镜像。做到这点要先给变量分类——会进产物的（`NEXT_PUBLIC_*`、`basePath`、图片域名）必须所有环境一致，否则就得分开构建；只在服务端用的（数据库、密钥、下游地址）全部走运行期注入。

最容易被塞进 `NEXT_PUBLIC_` 的是后端 API 地址。正确做法是用同域相对路径 `/api`，由网关按环境转发，前端代码里根本不出现域名。确实需要运行时才知道的公开配置（比如灰度标记、页脚版本号），从服务端组件读出来，作为 props 传给一个客户端 Provider，而不是在浏览器里再请求一次配置接口。

```tsx
// app/config-provider.tsx
"use client"
import { createContext, useContext } from "react"

type Config = { apiBase: string; release: string }
const Ctx = createContext<Config | null>(null)

export function ConfigProvider({ value, children }: { value: Config; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConfig() {
  const v = useContext(Ctx)
  if (!v) throw new Error("ConfigProvider 缺失")
  return v
}
```
```tsx
// app/layout.tsx（服务端组件）
import { env } from "@/lib/env"
import { ConfigProvider } from "./config-provider"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <ConfigProvider value={{ apiBase: "/api", release: env.RELEASE }}>{children}</ConfigProvider>
      </body>
    </html>
  )
}
```

这样 `RELEASE` 换了只需要重启容器，镜像 ID 不变。验证方式是记下 `docker images` 里的 image id，用两组不同的 `-e RELEASE=` 各起一次，页面源码里的版本号应随之变化，而 image id 相同。这一步做到了，「同一个产物跨环境」才算落地。反过来说，如果每次换环境都要重新构建，那 bundle 里一定藏着环境相关的字面量，回头去 `grep` 客户端产物就能找到它。

配置漂移是另一个常见坑：预发和生产跑着同一个镜像，但某个人手动改过一台机器的环境变量，两边行为就不一致了。解法是把环境变量当代码管理：`.env.example` 列全所有键（只写键名和说明，不写值），部署脚本从密钥管理系统拉值，谁改了值有审计记录。这样「这台机器为什么和别人不一样」才有答案。

镜像 tag 也别用 `latest`。用 git 短 sha 或发布号，回滚时才能精确指到上一个版本；`latest` 在多环境里几乎必然指错，尤其是有人手动 `docker pull` 过之后。还有一个细节：standalone 的启动脚本会把 `NODE_ENV` 固定成 production，别指望用环境变量把它改成 development 来调试，要调试就在本地跑 dev。

:::hint 会进产物的变量必须跨环境一致
`NEXT_PUBLIC_*`、`basePath`、图片域名在构建期就被写死进 bundle，换环境只能重新构建；只有服务端读的变量才留得到运行期注入。这条一混，build once 就不成立。
:::

:::solution 用同一个 image id 起两次
```bash
TAG=app:$(git rev-parse --short HEAD)
docker build -t "$TAG" .
ID=$(docker image inspect "$TAG" --format '{{.Id}}')

# 只换运行期变量，镜像不动
docker run -d --name app-a -p 3001:3000 -e RELEASE=v1 -e DATABASE_URL="$DB_A" "$TAG"
docker run -d --name app-b -p 3002:3000 -e RELEASE=v2 -e DATABASE_URL="$DB_B" "$TAG"

# 断言：版本号不同，image id 相同
curl -s localhost:3001 | grep -o 'v1'
curl -s localhost:3002 | grep -o 'v2'
docker image inspect "$TAG" --format '{{.Id}}'   # 与开头记下的 $ID 一致
```
如果第三步失败（版本号没变，或两个环境得分别构建才有差异），说明 bundle 里藏着环境字面量——去客户端产物里 `grep` 那个值就能定位。
:::

:::error 容器里最常见的四个错
```text
Error: Cannot find module '/app/server.js'
```
↓ standalone 目录拷错层级，镜像里多了一层 `/app/standalone`。确认 `COPY` 的目标是 `./`。

```text
Error: ENOENT: no such file or directory, open '/app/.next/BUILD_ID'
```
↓ 用 `next start` 去跑 standalone 产物。改 `CMD ["node", "server.js"]`。

```text
Error: connect ECONNREFUSED 127.0.0.1:3306
```
↓ 容器里的 `127.0.0.1` 是容器自己。数据库地址要用服务名或宿主地址，不能沿用本地的 localhost。

```text
Error: 'sharp' is required to be installed in standalone mode for the image optimization to function correctly.
```
↓ 用了 `next/image` 但产物里没有 `sharp`。在项目里 `npm i sharp` 后重新构建，并确认它出现在 standalone 的 `node_modules` 里。
:::

这四条的共同点是「产物与启动方式不匹配」：要么文件不在预期路径，要么命令不是这个产物该用的。遇到时先 `docker run --rm -it app:test sh` 进去 `ls` 一眼，比反复改 Dockerfile 快得多。

**自测**（合上文档回答）

1. standalone 产物里已经有什么、还缺什么？漏拷 `.next/static` 线上会看到什么现象？
2. `NEXT_PUBLIC_API_BASE` 为什么构建后改不了？想让同一镜像换环境应该怎么做？
3. `.env.local` 在容器里为什么读不到？应该改成什么注入方式？

**验收**

- [ ] `du -sh .next/standalone` 明显小于完整 `node_modules`，`docker run` 后首页与 `_next/static` 下的 chunk 都返回 200
- [ ] 删掉一个必填环境变量启动容器，进程启动即失败并打印出缺的变量名
- [ ] `grep -r "SESSION_SECRET" .next/static` 无结果
- [ ] 同一个 image id 用两组 `RELEASE` 启动，页面显示的版本号不同

---

### 第 12 周：测试与发布

**本周目标**：给一条用户主路径补齐单测、集成、E2E 三层测试，并能在预发用一条命令完成 10% 灰度和 60 秒内的回滚。

**为什么是这些内容**

前十一周都在让功能正确，这一周让「改动敢不敢发」变成一件有答案的事。没有测试，改动的影响范围只能靠记忆；没有灰度，一次错误就是全量错误；没有演练过的回滚，出事时只能一边冒汗一边构建。三件事其实是同一个目标的三个层次：测试降低「引入错误」的概率，灰度降低「错误影响面」，回滚降低「错误持续时间」。

这一周也是整条路线的收口。你前面写过的缓存、Server Action、鉴权、standalone 构建，最后都要经过「发布」这道门。门的左边是「我这里能跑」，右边是「用户那里没坏」。测试三层解决左边，灰度与回滚解决右边。学不会的后果很具体：每次上线前不敢合大改动，出了事只能全站回滚到几天前，数据还得手工修。

发布流程还是团队协作的接口。谁有权发、发之前看哪几个数、谁能在什么条件下叫停，这些约定比工具重要。一个人凭手感发布，团队就只能靠运气上线；把判定线写成数字，才轮得到工具替你执行。

#### 步骤 12.1 测试三层：单测 / 集成 / E2E

先看一个常见的浪费：改了价格格式化函数，跑一遍 E2E，八分钟才结束，而且只覆盖了「下单成功」这一条路径。真正出问题的边界——0 分、负数、千分位、超长数字——一个都没测。测试的性价比取决于「失败时能不能立刻知道问题在哪」，E2E 恰恰最难定位。

三层各管一段：单测测纯函数与分支，毫秒级，失败信息直接指到断言；集成测边界行为，比如 Route Handler 的 401/400/200，直接 import handler 传一个 `Request` 进去，不用起服务器；E2E 只测用户主路径「登录 → 发布 → 可见」，慢且脆，所以数量最少。业界常用的比例大致是 7:2:1，重点不是数字，而是「别用 E2E 去测分支」。

集成测试有个容易踩的坑：handler 里可能 import 了 `next/cache`、`next/headers` 这类只能在 Next 运行时里用的模块。用 `vi.mock` 把它们替换掉，测试就变成了纯粹的「输入 Request，断言 Response」。E2E 则相反，必须真起服务、真开浏览器，所以用 Playwright 的 `webServer` 让它自己拉起构建好的服务。

```ts
// lib/price.test.ts
import { describe, expect, it } from "vitest"
import { formatPrice } from "./price"

describe("formatPrice", () => {
  it.each([
    [0, "¥0.00"],
    [1234, "¥12.34"],
    [-5, "-¥0.05"],
  ])("%i 分 → %s", (cents, expected) => {
    expect(formatPrice(cents)).toBe(expected)
  })
})
```
```ts
// app/api/revalidate/route.test.ts
import { expect, it, vi } from "vitest"
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
import { POST } from "./route"

it("签名不对返回 401", async () => {
  const req = new Request("http://localhost/api/revalidate", {
    method: "POST",
    body: JSON.stringify({ slug: "a", signature: "bad" }),
  })
  expect((await POST(req)).status).toBe(401)
})
```
```ts
// e2e/comment.spec.ts
import { expect, test } from "@playwright/test"

test("登录后能发一条评论", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名").fill("u1")
  await page.getByLabel("密码").fill("p1")
  await page.getByRole("button", { name: "登录" }).click()
  await page.getByPlaceholder("说点什么").fill("第一条")
  await page.getByRole("button", { name: "发布" }).click()
  await expect(page.getByText("第一条")).toBeVisible()
})
```

`it.each` 让边界用例变成一张表，加一行就是加一个用例，比复制 `it` 更不容易漏；`vi.mock` 替换的是模块解析，必须在被测模块被 import 之前生效，Vitest 会自动把它提升到文件顶部，所以位置不用刻意调整；E2E 里用 role 和 label 定位而不是 CSS 选择器，页面改样式不会让测试碎掉。三条命令分别跑：`npx vitest run`、`npx vitest run route.test`、`npx playwright test`。

E2E 还有一个专属问题：数据。测试账号每次跑都留一条评论，跑十次页面上就有十条，断言的「可见」会指向历史数据。做法是每次运行前用固定账号登录、通过接口清掉该账号当天写入的数据，或者让用例自己生成带时间戳的文本再去断言。另一个陷阱是 flaky——同一用例偶尔失败、重跑就过。重试能让流水线变绿，但会掩盖真实竞态；先把失败率记录下来，能稳定复现的按 bug 修，不要用 `retries` 糊过去。

覆盖率不是目标，只是线索。一个 90% 覆盖率但断言全是 `toBeTruthy()` 的测试集，给不了任何安全感；反过来，几个只覆盖「钱、权限、幂等」的用例，价值可能高得多。看覆盖率时只问一个问题：这条没被覆盖的分支，坏了会不会被用户发现？

写单测时也别把什么都 mock 掉。把被测函数依赖的数据库、网络换成假实现是必要的，但连它自己的分支逻辑也 mock，测的就只剩「调用顺序」了。判断标准是：这个 mock 去掉之后，测试还能不能发现一个真实的 bug？

:::hint 集成测试不要起服务器
直接调 handler 更快、无端口冲突、失败信息更准。需要真 HTTP 的地方，那是 E2E 的职责。
:::

:::solution vitest 配置里补两个别名
```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/server-only.ts"),
    },
  },
  test: { environment: "node" },
})
```
:::

#### 步骤 12.2 灰度与回滚

先算一笔时间账：全量发布后五分钟，错误率从 0.1% 涨到 4%，这时开始回滚——重新构建六分钟、推送镜像两分钟、重启一分钟。九分钟里错误率一直是 4%。如果旧版本还在跑，回滚只是把流量切回去，三十秒就结束。这就是灰度与回滚的第一个前提：**旧版本必须还活着，回滚是切流量，不是重新部署**。

灰度需要两个能力：同时运行两个版本、按比例分流。按比例分的时候要按会话 id 做哈希，不能按 IP——NAT 后面几百个用户共用一个出口 IP，按 IP 会把整栋楼都切到新版本；而且同一会话的两次请求应该落在同一版本上，否则购物车、草稿这类有状态的功能会错乱。

数据库是回滚里最难的部分。旧代码和新代码要能同时读同一份库，所以迁移必须前后兼容：先加新列（旧代码不写也不读），再双写，等新版本稳定后删旧列；反过来「先删列再改代码」会让回滚后的旧版本直接 500。这条规则叫 expand / contract，任何时候都要能回退到上一个版本的代码而不回退数据库。

```nginx
# /etc/nginx/conf.d/split.conf（被 nginx.conf 的 http 块 include）
split_clients "$cookie_session" $backend {
  10%  web_new;
  *    web_old;
}
upstream web_old { server 127.0.0.1:3010; }
upstream web_new { server 127.0.0.1:3011; }

server {
  location / {
    proxy_pass http://$backend;
    proxy_set_header X-Request-Id $request_id;
  }
}
```
```bash
# 回滚：把 10% 改成 0%，reload 即完成；应用进程不用动
sed -i 's/10%  web_new/0%   web_new/' /etc/nginx/conf.d/split.conf
nginx -t && systemctl reload nginx
```

`split_clients` 是 nginx 的官方模块，按字符串哈希分流。键选 `$cookie_session` 是为了粘性：同一个会话每次都被分到同一档，用户刷新页面不会在两个版本之间来回跳。`$request_id` 是每个请求重新生成的，拿它当键等于每次重新抽签，只适合「每个请求独立分流」的压测场景，做灰度会出乱子。`proxy_pass` 里用变量时，nginx 会先在已定义的 upstream 组里找名字，找不到才走 DNS，所以这里不需要额外配 resolver。切流量的动作只有一次 `reload`，生产上应该在预发把这条命令演练到能背出来。

没登录的匿名流量没有这个 cookie，空字符串会被哈希到同一档，等于全部落在同一个版本。灰度阶段可以接受，但要心里有数：先确认落的是旧版本，再观察登录用户的 10%。

灰度看哪几个数，要提前写死：5xx 比例、核心接口 P95、前端错误率、关键转化。阈值同时写绝对值和相对值，比如「5xx 超过 0.5% 或比基线高 0.3 个百分点」——只看相对值，基线为 0 时永远不触发；只看绝对值，缓慢劣化又会被忽略。观察窗口给三十分钟，是因为不少问题要等缓存过期、定时任务跑一轮、或者某个低频入口被点到才暴露。

发布顺序也值得固定下来：先跑迁移，再起新版本，探活通过后才切流量，观察期内不清理旧版本。顺序错了，就会出现「新代码在等新列」「旧代码读到新列」这类只能停机修的事故。把这四步写进发布单，谁执行都一样。

:::hint 回滚要提前演练
没演练过的回滚等于没有回滚。至少要能回答：切回去需要多久？数据迁移能不能回退？旧版本还能不能读新数据？
:::

:::solution 发布检查单
```text
□ 新旧版本可同时运行（端口/进程不冲突）
□ 迁移已按 expand/contract 拆分，旧版本能读新表
□ 灰度 10% 观察 30 分钟：错误率、P95、LCP 三项都不越线
□ 越线判定与回滚命令已写在发布单上，并在预发演练过
□ 回滚后检查：5xx 归零、核心接口 200、旧版本日志无新报错
```
:::

:::error 灰度和回滚最常翻的车
```text
Error: relation "orders_new" does not exist
```
↓ 新代码先上线、迁移还没跑。发布顺序必须是「迁移 → 新版本 → 切流量」。

```text
502 Bad Gateway 突然翻倍
```
↓ 新版本进程没起来就被切了流量。切之前先 `curl` 探活，失败就不切。

```text
Error: column "status_v2" does not exist
```
↓ 回滚到旧版本，但旧版本读新列。这正是没做 expand/contract 的后果，只能补一次兼容迁移再回滚。
:::

回滚成功不等于事故结束。现场要留下来：出问题的镜像 tag、灰度窗口内的日志与指标、数据库变更记录，都别急着清理。灰度期间新版本写进去的数据也要单独检查一遍，确认旧版本读得出来、算得对。最后补一条能复现这次问题的测试，再按正常流程发一次——没有回归测试的修复，下次还会以同样的方式回来。

**自测**（合上文档回答）

1. 为什么集成测试直接 import handler，而不是起一个 HTTP 服务器？
2. 灰度分流为什么按会话 cookie 哈希，而不是按客户端 IP？换成 `$request_id` 会怎样？
3. 数据库迁移为什么要拆成 expand 和 contract 两步？不做会怎样？

**验收**

- [ ] `npx vitest run` 全绿；故意改错一条断言，只有那一条失败
- [ ] `npx playwright test` 通过，覆盖「登录 → 发布 → 可见」主路径
- [ ] 本地起两个端口（3010/3011）模拟新旧版本，用 100 个不同 `Cookie: session=s1…s100` 各请求一次，约 10 个命中新版本；同一个 cookie 重复请求始终落在同一版本
- [ ] 把分流比例改成 0% 并 reload，100 次请求全部回到旧版本且无 5xx
- [ ] 从决定回滚到流量归零计时，小于 60 秒，并记录在发布单上

---

## 场景实践库（可迭代的扩展点）

| # | 场景 | 业务背景 | 交付物 | 考察点 | 建议阶段 |
|---|---|---|---|---|---|
| 1 | 后台骨架 | 列表 + 详情 + 设置，嵌套布局 | 三页应用 + 边界文件 | 布局复用、边界 | 一 |
| 2 | 内容站按需失效 | CMS 发布后立刻可见 | tag 失效 + webhook | 缓存四层 | 二 |
| 3 | 评论/工单 | 提交要立刻可见、失败可回滚 | Server Action + 乐观更新 | 写入与幂等 | 三 |
| 4 | 多租户 SaaS | 组织切换 + 角色权限 | 路由 + 三层守卫 | 鉴权隔离 | 四 |
| 5 | 性能专项 | 首页 LCP 超标 | 报告 + 改前改后 | 预算与拆包 | 五 |
| 6 | 可发布产物 | 容器化 + 灰度 | Dockerfile + 检查单 | 交付 | 六 |

**相关项目**（点开即可看完整需求与参考实现）：
[流式仪表盘](/admin/study/projects?p=nextjs/streaming-dashboard) ·
[ISR 内容站](/admin/study/projects?p=nextjs/isr-content-site) ·
[多租户 SaaS 后台](/admin/study/projects?p=nextjs/multi-tenant-saas)


每个项目末尾都有**「验收脚本」**折叠块：复制到本地，把 `BASE` 指向你的服务就能跑一遍验收。

## 毕业评估（L3 / L4 边界）

| 维度 | 合格（L2） | 高级（L3） | 资深（L4） |
|---|---|---|---|
| 渲染策略 | 知道 SSG/SSR | 能按页面选型并解释缓存 | 能定义团队默认策略 |
| 数据 | 会调接口 | 能设计写入链路与幂等 | 能设计一致性方案 |
| 鉴权 | 会做登录 | 能设计三层守卫与多租户 | 能定安全基线 |
| 性能 | 会看分数 | 能定预算并达标 | 能建性能回归体系 |
| 交付 | 能部署 | 能灰度与回滚 | 能设计发布平台 |

**通过标准**：5 个维度至少 4 个达到「高级」，且没有「合格」以下。

## 后续迭代

| 加什么 | 怎么加 | 注意 |
|---|---|---|
| 新场景 | 场景库加一行 + 项目库加一个 `.md` | 一个场景只考察 1–2 个点 |
| 新深度周 | 在阶段后加 `### 第 N 周`，同步更新知识地图 | 每周必须有可验收产出物 |

**三条红线**：每步都要有「思路 + 答案」；场景要能独立上线；不加「以后可能会用」的内容。
