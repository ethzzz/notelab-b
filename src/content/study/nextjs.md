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

**本周目标**：能说清 `layout` / `page` / `loading` / `error` / `not-found` 各自的职责与执行时机。

#### 步骤 1.1 用最小应用验证嵌套布局的执行顺序

建三层嵌套路由，每层 `layout` 打一行日志，刷新页面看输出顺序。

:::hint 布局不会重新渲染
`layout` 在导航时**保持挂载**，只有 `page` 换。所以布局里不能放「依赖当前页面」的状态；而 `loading.tsx` 是布局级别的 Suspense 兜底，不是页面级的。
:::

:::solution 代码
```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log("[layout] root")
  return <html lang="zh"><body>{children}</body></html>
}

// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  console.log("[layout] dashboard")
  return <section className="flex">{children}</section>
}
```
```text
首次访问 /dashboard/orders 的输出顺序：
[layout] root → [layout] dashboard → [page] orders
从 /dashboard/orders 切到 /dashboard/settings：
只打印 [page] settings（布局被复用）
```
:::

#### 步骤 1.2 划清 RSC 与 Client 的边界

把一个「页面里全是大组件 + 一个搜索框」拆成服务端页面 + 客户端搜索框，比较首屏 JS。

:::hint 边界越低，包越小
`"use client"` 会让整棵子树进客户端包。正确做法是把交互收缩到叶子，外层保持服务端——数据在服务端取，交互组件只拿它需要的那点数据。
:::

:::solution 拆分前后
```tsx
// ❌ 整个页面进客户端包
"use client"
export default function Page() {
  const [q, setQ] = useState("")
  return <><SearchBar value={q} onChange={setQ} /><BigTable /></>
}
```
```tsx
// ✅ 页面是服务端组件，只有搜索框是客户端
export default async function Page() {
  const rows = await db.list()
  return <><SearchBox /><BigTable rows={rows} /></>
}
```
:::

**验收**

- [ ] 能画出 `layout → page` 的执行顺序
- [ ] 能说出一段代码在服务端还是客户端执行
- [ ] 拆分后首屏 JS 明显下降（用构建输出对比）

---

### 第 2 周：边界与并行路由

#### 步骤 2.1 loading / error / not-found 三件套

给一个会抛错、会 404、会慢的页面分别加三个边界文件，验证它们各自生效。

:::hint 三个文件解决三种失败
`loading.tsx` 处理「慢」、`error.tsx` 处理「抛错」、`not-found.tsx`（由 `notFound()` 触发）处理「不存在」。`error.tsx` 必须是客户端组件，且只捕获**渲染期**错误，事件处理器里的错误它接不住。
:::

:::solution 代码
```tsx
// app/posts/[slug]/loading.tsx
export default function Loading() {
  return <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
}

// app/posts/[slug]/error.tsx
"use client"
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <div><p>{error.message}</p><button onClick={reset}>重试</button></div>
}

// app/posts/[slug]/not-found.tsx
export default function NotFound() {
  return <p>文章不存在</p>
}
```
:::

#### 步骤 2.2 并行路由做弹窗

用 `@modal` 插槽实现「列表页上打开详情弹窗、刷新后仍是详情页」。

:::hint 并行路由解决的是「同一 URL 两套 UI」
`app/@modal/(.)posts/[id]/page.tsx` 里的 `(.)` 表示「拦截同一层的路由」：从列表点击时渲染为弹窗，直接刷新时渲染为整页。这是 Next 里少数能同时满足「体验」和「可分享」的方案。
:::

:::solution 目录结构
```text
app/
├── layout.tsx                 接收 children 与 modal 两个插槽
├── posts/page.tsx             列表
├── posts/[id]/page.tsx        直接访问时的整页
└── @modal/(.)posts/[id]/page.tsx   站内跳转时的弹窗
```
```tsx
export default function Layout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return <>{children}{modal}</>
}
```
:::

**验收**

- [ ] 三个边界文件分别被触发过（不是只写了文件）
- [ ] 弹窗：站内点击是弹窗、直接刷新是整页

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

#### 步骤 3.1 把四层缓存画出来

用一次「改数据库 → 刷新页面」的实验，标出哪一层没失效。

:::hint 四层缓存
① 请求记忆化（同一次渲染内重复 `fetch` 只发一次）；② 数据缓存（`fetch` 的 `revalidate`）；③ 全路由缓存（静态页）；④ 客户端路由缓存（`<Link>` 预取）。**改内容不生效，八成卡在第 ②③ 层**。
:::

:::solution 实验表
```text
改 DB → 直接刷新浏览器：没变
原因：路由是静态的（第 ③ 层），页面在构建时生成
解决：给该路由加 revalidate，或在变更后 revalidatePath/Tag
```
:::

#### 步骤 3.2 流式渲染：先出骨架，再出数据

把一个慢接口包进 `<Suspense>`，让页面首屏先返回，数据到了再流式补上。

:::hint 流式渲染的前提
页面本身要能「先返回外壳」。如果页面顶层 `await` 了慢数据，流式就无从谈起——必须把慢的部分下沉到 Suspense 内的子组件。
:::

:::solution 代码
```tsx
export default function Dashboard() {
  return (
    <main>
      <h1>仪表盘</h1>
      <Suspense fallback={<Skeleton rows={4} />}>
        <SlowStats />          {/* 内部 await 慢接口 */}
      </Suspense>
      <Suspense fallback={<Skeleton rows={8} />}>
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
:::

**验收**

- [ ] 能说出页面卡在哪一层缓存
- [ ] 首屏 TTFB 不再被慢接口拖住（用 Network 面板证明）

---

### 第 4 周：按需失效

#### 步骤 4.1 CMS webhook → revalidateTag

内容系统发布后调一个 Route Handler，按 tag 精准失效，而不是全站重建。

:::hint tag 比 path 好
`revalidatePath` 只能按路径失效，容易漏；`revalidateTag` 按数据维度失效，一个 tag 可以覆盖多个页面。给 `fetch` 打 tag 是关键：`fetch(url, { next: { tags: ["post:123"] } })`。
:::

:::solution 代码
```ts
// lib/content.ts
export async function getPost(slug: string) {
  const res = await fetch(`${CMS}/posts/${slug}`, { next: { tags: [`post:${slug}`] } })
  return res.json()
}
```
```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache"

export async function POST(req: Request) {
  const { slug, signature } = await req.json()
  if (!verify(signature, slug)) return new Response("bad signature", { status: 401 })
  revalidateTag(`post:${slug}`)
  return Response.json({ ok: true })
}
```
:::

#### 步骤 4.2 哪些写法会让路由变动态

逐个试 `cookies()` / `headers()` / `searchParams` / `no-store`，观察构建输出从 `○` 变 `ƒ`。

:::hint 动态化是隐式的
用了请求相关 API，整条路由就变成动态渲染。这不是报错，只是构建产物从静态变动态——**首屏成本从 CDN 变成了每次回源**，要心里有数。
:::

:::solution 对照
```text
纯静态：○ /posts
用了 cookies()：ƒ /posts
用了 searchParams：ƒ /posts
fetch(..., { cache: "no-store" })：ƒ /posts
```
:::

**验收**

- [ ] webhook 验签失败返回 401
- [ ] 发布后 1 秒内页面可见新内容（不用重新部署）

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

#### 步骤 5.1 Route Handler 接第三方 webhook

写一个接收支付回调的 handler：验签、幂等、快速返回。

:::hint webhook 的三条铁律
① 必须验签（否则任何人都能伪造）；② 必须幂等（对方会重试）；③ 必须快速返回 2xx（超时会触发更多重试）。
:::

:::solution 代码
```ts
export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get("x-signature") ?? ""
  if (!verifyHmac(raw, sig, process.env.WEBHOOK_SECRET!)) {
    return new Response("bad signature", { status: 401 })
  }
  const event = JSON.parse(raw)
  const seen = await db.markProcessed(event.id)   // 唯一键，重复返回 false
  if (!seen) return Response.json({ ok: true, duplicated: true })
  await handleEvent(event)
  return Response.json({ ok: true })
}
```
:::

#### 步骤 5.2 Server Action + useOptimistic

用一个 Server Action 提交评论，提交中立刻显示、失败回滚。

:::hint Action 不是接口
Server Action 是「从客户端调服务端函数」，参数会被序列化。它仍然是公开端点，**必须自己做鉴权与校验**；`useOptimistic` 负责「先显示再确认」。
:::

:::solution 代码
```tsx
// app/posts/[id]/actions.ts
"use server"
export async function addComment(postId: string, formData: FormData) {
  const user = await requireUser()                 // 必须鉴权
  const content = String(formData.get("content") ?? "").trim()
  if (!content || content.length > 500) throw new Error("内容不合法")
  await db.comment.create({ postId, userId: user.id, content })
  revalidateTag(`post:${postId}`)
}
```
```tsx
"use client"
const [optimistic, addOptimistic] = useOptimistic(comments, (list, c: Comment) => [...list, c])

async function onSubmit(fd: FormData) {
  addOptimistic({ id: "tmp", content: String(fd.get("content")), pending: true })
  await addComment(postId, fd)      // 失败会抛出，乐观项自动回滚
}
```
:::

**验收**

- [ ] 伪造签名被 401 拒绝
- [ ] 同一条回调重复 3 次只处理一次
- [ ] 评论提交失败时列表回到原状

---

### 第 6 周：并发与一致性

#### 步骤 6.1 用 cache() 去重同一次渲染里的重复请求

同一页面两个组件都取用户信息，用 `cache()` 包一层，验证只查一次。

:::hint React 的 cache 是「单次请求内」的
它不跨请求、不跨用户，所以放心用来去重；跨请求缓存要用 Next 的数据缓存（`fetch` + tag）。
:::

:::solution 代码
```ts
import { cache } from "react"

export const getUser = cache(async (id: string) => {
  console.log("query user", id)
  return db.user.findUnique({ where: { id } })
})

// 同一渲染里两处调用 → 只打印一次
```
:::

#### 步骤 6.2 并发写入的幂等键

表单提交带 `requestId`，服务端按唯一键去重——前端连点不会产生两条评论。

:::hint 幂等要从请求带到库
前端生成 `requestId`（`crypto.randomUUID()`），随表单提交；服务端建唯一索引，重复插入捕获冲突后返回已有记录。
:::

:::solution 代码
```ts
const reqId = formData.get("requestId")
try {
  await db.comment.create({ data: { postId, content, requestId: String(reqId) } })
} catch (e) {
  if (isUniqueViolation(e)) return { ok: true, duplicated: true }
  throw e
}
```
:::

**验收**

- [ ] 同页两个组件调 `getUser` 只产生一次查询
- [ ] 连点提交只落一条记录

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

#### 步骤 7.1 用 middleware 做登录重定向

未登录访问 `/dashboard/**` 时跳登录，并带上 `next` 参数。

:::hint middleware 只适合做「粗粒度」判断
它能读 cookie、做重定向、改 header，但**不能连数据库**（边缘运行时限制）。细粒度权限必须在页面/接口里再判一次——middleware 是体验层，不是安全边界。
:::

:::solution 代码
```ts
// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value
  const isProtected = req.nextUrl.pathname.startsWith("/dashboard")
  if (isProtected && !token) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ["/dashboard/:path*"] }
```
:::

#### 步骤 7.2 多租户路由：路径还是子域

比较 `/org/[orgId]/...` 与 `org.example.com` 两种方案，给出取舍。

:::hint 路径更简单，子域更隔离
路径方案：一个部署、cookie 同域、实现简单；子域方案：隔离更彻底、品牌感强，但要处理通配证书、cookie 作用域、跨子域跳转。
:::

:::solution 取舍表
| 维度 | 路径 `/org/[id]` | 子域 `org.x.com` |
|---|---|---|
| 实现成本 | 低 | 高（DNS/证书/cookie） |
| 数据隔离 | 靠代码 | 天然分隔 |
| 品牌感 | 一般 | 强 |
| 适合 | 内部系统、早期产品 | 对外 SaaS、企业客户 |
:::

**验收**

- [ ] 未登录访问受保护页会跳登录并回跳
- [ ] 能说出 middleware 不能当安全边界的原因

---

### 第 8 周：会话与权限

#### 步骤 8.1 在 RSC 里读会话

服务端组件直接读 cookie 拿用户，不经过客户端请求。

:::hint 服务端读会话最省一次往返
`cookies()` 是动态 API，会让路由变动态；但换来的是「首屏就带着用户信息」，比客户端再请求一次体验好。
:::

:::solution 代码
```ts
import { cookies } from "next/headers"

export async function currentUser() {
  const token = (await cookies()).get("session")?.value
  if (!token) return null
  return verifySession(token)     // 校验签名与过期
}
```
:::

#### 步骤 8.2 权限判定的三层

页面守卫、接口守卫、数据守卫各写一次，缺一层都会漏。

:::hint 三层缺一不可
页面守卫挡「误入」，接口守卫挡「绕过 UI」，数据守卫挡「越权拿别人的 id」。前两层是体验，第三层才是安全。
:::

:::solution 代码
```ts
// 数据层：查询必须带租户条件
const rows = await db.order.findMany({ where: { orgId, id } })

// 接口层：Route Handler 里再判一次
if (!can(user, "order:read", orgId)) return new Response("forbidden", { status: 403 })
```
:::

**验收**

- [ ] 换一个 orgId 访问别人的数据会被拒绝
- [ ] 能说出三层守卫各自的失效后果

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

#### 步骤 9.1 建立基线并定预算

用 Lighthouse + 构建输出，给首页定三条预算：LCP、首屏 JS、错误率。

:::hint 预算要可执行
「尽量快」不是预算。写成「LCP < 2.5s、首屏 JS < 200KB、错误率 < 0.1%」，并挂到 CI 或每周巡检上，才有约束力。
:::

:::solution 记录表
```text
页面         LCP    首屏JS   备注
/            2.1s   180KB    基线
/dashboard   3.4s   310KB    超标：图表库全量引入
```
:::

#### 步骤 9.2 图片、字体、第三方脚本

三件最常见的拖慢项，各给一个改法。

:::hint 优先级
首屏大图给 `priority` 与明确尺寸；字体用 `next/font` 自托管 + `display: swap`；第三方脚本用 `next/script` 的 `afterInteractive`。
:::

:::solution 代码
```tsx
import Image from "next/image"
<Image src="/hero.jpg" alt="" width={1200} height={600} priority sizes="100vw" />

import localFont from "next/font/local"
const inter = localFont({ src: "./inter.woff2", display: "swap" })

<Script src="/analytics.js" strategy="afterInteractive" />
```
:::

**验收**

- [ ] 三条预算写下来并挂到某处（CI/巡检）
- [ ] 至少一项指标有改前/改后对比

---

### 第 10 周：包分析与可观测

#### 步骤 10.1 找出首屏包里的大件

用 `@next/bundle-analyzer` 或构建输出定位大依赖，按路由拆分。

:::hint 拆包的正确姿势
动态 `import()` 适合「非首屏、可交互后加载」的组件（图表、编辑器）；把组件挪到服务端则是「根本不需要进包」。先想第二种。
:::

:::solution 代码
```tsx
const Chart = dynamic(() => import("@/components/Chart"), { ssr: false })
```
:::

#### 步骤 10.2 错误与慢请求的可观测

给 Route Handler 加结构化日志与耗时，错误上报带 `digest`。

:::hint digest 是排障的钥匙
`error.tsx` 拿到的 `error.digest` 可以在服务端日志里对上同一行，用户报错时让他提供这串，能直接定位。
:::

:::solution 代码
```ts
export async function GET(req: Request) {
  const started = Date.now()
  try {
    return Response.json(await load())
  } finally {
    console.log(JSON.stringify({ path: new URL(req.url).pathname, ms: Date.now() - started }))
  }
}
```
:::

**验收**

- [ ] 能指出首屏包里最大的三个依赖
- [ ] 能用 digest 在日志里串起一次用户报错

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

#### 步骤 11.1 standalone 输出

用 `output: "standalone"` 打出最小运行产物，容器里只带必要文件。

:::hint standalone 省的是镜像体积
它只带运行时需要的 node_modules 子集；静态资源要手动拷进 `.next/static`。漏拷会导致线上全是 404 的 JS。
:::

:::solution 配置
```ts
// next.config.ts
export default { output: "standalone" }
```
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
CMD ["node", "server.js"]
```
:::

#### 步骤 11.2 环境变量分层

区分构建期注入与运行期读取，避免把密钥打进客户端包。

:::hint 只有 NEXT_PUBLIC_ 会进客户端
其余变量在服务端可用；`NEXT_PUBLIC_` 前缀的变量会**被打进浏览器包**，绝不能放密钥。
:::

:::solution 对照
```text
NEXT_PUBLIC_API_BASE   → 浏览器可见，构建期替换
DATABASE_URL           → 仅服务端，运行期读取
```
:::

**验收**

- [ ] 镜像里只有 standalone 产物 + 静态资源
- [ ] 客户端包里搜不到任何密钥

---

### 第 12 周：测试与发布

#### 步骤 12.1 测试三层：单测 / 集成 / E2E

给一个关键流程写三层测试：函数单测、Route Handler 集成、页面 E2E。

:::hint 别用 E2E 测所有东西
E2E 慢且脆，只覆盖「用户主路径」；边界与分支交给单测与集成。三层比例大致 7:2:1。
:::

:::solution 代码
```ts
// 单测：纯函数
expect(formatPrice(1234)).toBe("¥12.34")

// 集成：Route Handler
const res = await POST(new Request("http://x/api/revalidate", { method: "POST", body }))
expect(res.status).toBe(401)

// E2E：登录 → 发评论 → 可见
await page.goto("/login"); await page.fill("#user", "u1"); ...
```
:::

#### 步骤 12.2 灰度与回滚

设计一次「10% 流量切新版本、指标异常回滚」的发布流程。

:::hint 回滚要提前演练
没演练过的回滚等于没有回滚。至少要能回答：切回去需要多久？数据迁移能不能回退？旧版本还能不能读新数据？
:::

:::solution 发布检查单
```text
□ 新版本可独立运行（不依赖未上线的迁移）
□ 灰度 10% 观察 30 分钟：错误率、P95、LCP
□ 回滚命令已写好并在预发演练过
□ 回滚后数据兼容（前后向兼容）
```
:::

**验收**

- [ ] 三层测试各至少一个
- [ ] 能背出回滚的四步

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
