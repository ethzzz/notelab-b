# React 上手路线 · 8 周（面向本项目前端）

> **定位**：你已经在用 Next 16 + React 19 写页面（`notelab-b` / `notelab-c`），所以这里不教「什么是组件」，而是把**容易写错的地方**逐条钉死：状态放哪、什么时候重渲染、服务端与客户端边界在哪、交付前要过哪些关。
>
> **学完的标准**：能在 `notelab-c` 里独立加一个带表单、列表、分页、错误处理、可访问性的页面，知道它为什么不会重复请求、不会无限渲染，并且能安全上线与回滚。
>
> **用法**：思路与代码默认收起，先自己判断，再点开对照。

---

## 先建立三个判断

| 判断 | 错误做法 | 正确做法 |
|---|---|---|
| 状态放哪 | 什么都塞进组件 `useState` | **能被推导的不要存**；跨组件用提升或 Context |
| 什么时候重渲染 | 靠 `useEffect` 手动同步 | 渲染由状态驱动，副作用才用 `useEffect` |
| 服务端还是客户端 | 全站 `"use client"` | 默认服务端；只有需要交互/浏览器的组件才加 |

**一句话**：React 不是「用 JS 操作 DOM」，而是「用状态描述 UI」。每一行 `useEffect` 都要能回答「这是在同步什么外部系统」。

---

## 阶段一 · 组件与状态（第 1–2 周）

### 第 1 周：组件、props、状态

**本周目标**：能解释「状态 → 渲染」的关系，写出不会无限重渲染、列表不会错位的组件。

#### 步骤 1.1 验证「连写三次 setState 只加 1」

写一个按钮，`onClick` 里连调三次 `setCount(count + 1)`，观察只加 1；再改成函数式更新。

:::hint 闭包快照
一次渲染里 `count` 是**常量快照**，三次读到的都是同一个值，所以三次都算出 `0+1`。函数式更新 `setCount(c => c + 1)` 由 React 依次喂最新值，才是连加。
:::

:::solution 代码
```tsx
const [count, setCount] = useState(0)

// ❌ 只加 1：三次读到的都是本轮渲染的 count
onClick={() => { setCount(count + 1); setCount(count + 1); setCount(count + 1) }}

// ✅ 加 3：每次拿最新值
onClick={() => { setCount(c => c + 1); setCount(c => c + 1); setCount(c => c + 1) }}
```
:::

#### 步骤 1.2 用 key 复现一个真 bug

渲染一个可删除的输入框列表，用数组下标当 key，删中间那一项，观察输入框内容错位；换成稳定 id 后恢复正常。

:::hint key 是「身份」不是「位置」
React 用 key 判断「这是不是同一个组件实例」。下标作 key 时，删掉第 0 项后，原来的第 1 项变成下标 0，React 认为它还是「第 0 个」，于是复用了错误的 state。
:::

:::solution 代码
```tsx
// ❌ 删中间项后，后面输入框的内容会往前串
{items.map((item, i) => <Row key={i} defaultValue={item.name} />)}

// ✅ 用稳定 id
{items.map((item) => <Row key={item.id} defaultValue={item.name} />)}
```
:::

#### 步骤 1.3 组合优于继承：用 children 做布局组件

写一个 `Panel` 组件，接收 `title` 与 `children`，让页面结构复用而不是复制。

:::hint React 没有「模板继承」
你不需要 BasePage 那种东西：把公共结构抽成组件，把差异用 `children` / render prop 传进去。判断标准是「这个组件知不知道自己渲染的是什么」——布局组件不该知道。
:::

:::solution 代码
```tsx
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

<Panel title="本周任务"><TaskList /></Panel>
```
:::

**验收**

- [ ] 能解释「为什么连写三次只加 1」
- [ ] 能用下标 key 复现错位
- [ ] 能在 DevTools 里看出哪些组件重渲染了

---

### 第 2 周：副作用与数据请求

**本周目标**：能写出三态齐全、不会竞态、不会无限循环的请求逻辑。

#### 步骤 2.1 修掉「切页竞态」

做一个分页列表，快速切两页，旧请求后到会覆盖新数据；用 `AbortController` 或「请求序号」修掉。

:::hint 竞态的本质
网络返回顺序 ≠ 发出顺序。不取消旧请求，就一定会出现「最后返回的那个覆盖当前状态」。`AbortController` 在依赖变化/卸载时取消；或者记录一个自增 `reqId`，回来时比对是不是最新那次。
:::

:::solution 代码
```tsx
useEffect(() => {
  const ac = new AbortController()
  setLoading(true)
  apiJson(`/api/tasks?page=${page}`, { signal: ac.signal })
    .then(setData)
    .catch((e) => { if (e.name !== "AbortError") setError(e) })
    .finally(() => setLoading(false))
  return () => ac.abort()
}, [page])
```
:::

#### 步骤 2.2 三态齐全的错误页

把 loading / error / data 三态都渲染出来，失败时给「重试」按钮。

:::hint 三态缺一个就是白屏
最常见的线上问题不是「接口挂了」，而是「接口挂了但页面什么都不显示」。三态是页面契约的一部分：loading 给骨架，error 给原因 + 重试，data 才是正常内容。
:::

:::solution 代码
```tsx
if (loading) return <Skeleton active />
if (error) return (
  <Alert type="error" message="加载失败" description={error.message}
    action={<Button size="small" onClick={reload}>重试</Button>} />
)
return <List dataSource={data.items} ... />
```
:::

#### 步骤 2.3 不要用 useEffect 做「能推导的同步」

找出代码里「用 useEffect 把 props 拷进 state」的写法，改成直接派生。

:::hint 派生状态是 bug 温床
`useEffect(() => setFullName(first + last), [first, last])` 会多渲染一次、还会出现「改了 props 但一帧内是旧值」。能算出来的东西，直接在渲染里算。
:::

:::solution 代码
```tsx
// ❌ 多余的 state + effect
const [full, setFull] = useState("")
useEffect(() => setFull(`${first} ${last}`), [first, last])

// ✅ 渲染时派生
const full = `${first} ${last}`
```
:::

:::error Too many re-renders
```text
Uncaught Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
```
**原因**：渲染期间直接调了 setState。最常见是 `onClick={setOpen(true)}`（少写箭头函数），或者 `useEffect` 依赖里放了每次新建的对象。
:::

**验收**

- [ ] 快速切页不会出现旧数据覆盖新数据
- [ ] 请求失败有明确提示，不是白屏
- [ ] 能说出这个页面发了几次请求、为什么

---

## 阶段二 · 渲染与路由（第 3–4 周）

### 第 3 周：渲染机制与性能

**本周目标**：知道什么时候该优化、什么时候是瞎优化。

#### 步骤 3.1 先测再优化：用 Profiler 找真正的慢组件

打开 React DevTools Profiler，录一段交互，找出渲染次数最多 / 耗时最长的组件。

:::hint 默认别加 memo
`memo`/`useMemo`/`useCallback` 本身也有成本，而且会让依赖数组变成新的 bug 来源。先用 Profiler 证明「这里真的慢」，再优化；大多数页面根本不需要。
:::

:::solution 判断顺序
```text
1. 交互卡吗？        → 先看是不是一次渲染太多节点（列表没虚拟化）
2. 组件重渲染多吗？  → Profiler 看「why did this render」
3. 才轮到 memo      → 且只包真正贵的子组件
```
:::

#### 步骤 3.2 状态提升 vs Context

两个兄弟组件要共享筛选条件：先提升到父组件，再评估要不要 Context。

:::hint 什么时候才需要 Context
只有「跨越很多层、且频繁变化」才用 Context。Context 一变，所有消费者都重渲染 —— 这是它最大的代价。能用 props 传两层就传两层。
:::

:::solution 代码
```tsx
// 提升：父组件持有，两个子组件各自接收
function Page() {
  const [keyword, setKeyword] = useState("")
  return (<><SearchBar value={keyword} onChange={setKeyword} /><Table keyword={keyword} /></>)
}

// Context：仅当层级很深（主题、登录态、i18n）
const ThemeCtx = createContext<"light" | "dark">("light")
```
:::

#### 步骤 3.3 受控与非受控

把一个大表单从「每个输入都 setState」改成「非受控 + FormData」，对比渲染次数。

:::hint 受控不是唯一答案
受控方便联动校验，但每敲一个字都重渲染整棵子树；非受控（`defaultValue` + `FormData`）在简单表单上更快。antd `Form` 介于两者之间：内部托管，只在需要时取值。
:::

:::solution 代码
```tsx
// 非受控：提交时一次性取值
function QuickForm() {
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      console.log(Object.fromEntries(fd))
    }}>
      <input name="title" defaultValue="" />
      <button type="submit">保存</button>
    </form>
  )
}
```
:::

**验收**

- [ ] 能用 Profiler 说出「哪个组件、渲染了几次、为什么」
- [ ] 能说出 Context 的代价
- [ ] 知道什么场景该用非受控

---

### 第 4 周：Next.js App Router

**本周目标**：能判断组件该不该 `"use client"`，能读懂并正确使用本项目的页面守卫。

#### 步骤 4.1 判断一个组件该不该 "use client"

拿 `notelab-b` 里现有的三个组件，分别判断：需要 state/事件/浏览器 API 的才加；纯展示的保持服务端。

:::hint 边界越低越好
`"use client"` 会把整棵子树打进客户端包。把交互收缩到最小的叶子组件，外面保持服务端，首屏更快、JS 更少。
:::

:::solution 判断表
| 组件 | 需要 client 吗 | 理由 |
|---|---|---|
| 页面外壳 / 布局 | 否 | 纯结构，无状态 |
| 搜索框 + 列表筛选 | 是 | 有 state 与事件 |
| 静态文档正文 | 否 | 构建时就确定了 |
:::

#### 步骤 4.2 读懂页面守卫

打开 `notelab-b/src/app/(admin)/layout.tsx`，找到 `pages.includes(pathname)`，回答：为什么新页面必须在 Java 的 `PageRoutes` 里登记。

:::hint 权限码就是路径本身
后端的 `pages` 清单来自 `PageRoutes.PAGE_ROUTES`，守卫做的是**精确匹配**。没登记的路径，即使页面文件存在，也会被判无权限 —— 表现是「菜单没有」或「点进去被弹回」。
:::

:::solution 结论
```text
/api/menu → { menu: [...], pages: ["/", "/chat", "/study/java", ...] }
守卫：pages.includes(pathname) 为 false → 不渲染子页面 → 跳 /no-access
所以：新增页面 = 前端 page.tsx + Java MenuTree + Java PageRoutes，三处缺一不可
```
:::

#### 步骤 4.3 二级页用查询参数，不要用子路由

把 `?id=` 风格的详情页改成 `/xxx/123`，观察守卫为什么把你拦在门外。

:::hint 精确匹配的代价
`pages.includes("/xxx")` 对 `/xxx/123` 返回 false。要么把每条子路径登记进权限表（几十条），要么用查询参数承载状态。本项目对二级页的统一约定是 `?id=` / `?track=` / `?week=`。
:::

:::solution 结论
```text
✅ /practice?id=12
✅ /learning?track=java
✅ /study/java?week=3
❌ /practice/12（不在 PAGE_ROUTES → 403）
```
:::

:::error 构建期报的两个错
```text
Error: useSearchParams() should be wrapped in a suspense boundary at page "/study/[lang]".
```
↓ 静态页里用了 `useSearchParams`，必须包一层 `<Suspense>`。

```text
Error: Hydration failed because the server rendered HTML didn't match the client.
```
↓ 首帧不一致：`Date.now()` / `Math.random()` / `localStorage` 直接写在渲染里。放进 `useEffect` 或给确定的占位值。
:::

**验收**

- [ ] 能说出一个组件该不该加 `"use client"`
- [ ] 能解释「为什么新增页面要同时改 Java 的两处常量」
- [ ] 能说出守卫的局限（它挡误入，不是安全边界）

---

## 阶段三 · 工程化（第 5–6 周）

### 第 5 周：表单与提交

**本周目标**：表单能校验、能提交、能失败重试、能防重复提交。

#### 步骤 5.1 antd Form：校验与提交态

用 `Form` 做「新建任务」：必填、长度限制、提交中禁用、成功后刷新列表。

:::hint 校验要前后端一致
前端校验是体验，后端校验才是边界。两边规则不一致时，用户会看到「前端说没问题，提交后报错」。把错误码映射成用户能看懂的话，而不是直接弹后端 JSON。
:::

:::solution 代码
```tsx
const [form] = Form.useForm()
const [submitting, setSubmitting] = useState(false)

async function submit() {
  const values = await form.validateFields()
  setSubmitting(true)
  try {
    await apiJson("/api/tasks", { method: "POST", body: JSON.stringify(values) })
    message.success("已创建")
    await reload()
    form.resetFields()
  } catch (e) {
    message.error((e as Error).message || "提交失败")
  } finally {
    setSubmitting(false)
  }
}
```
:::

#### 步骤 5.2 防重复提交与乐观更新

按钮连点三次会建三条数据：加提交锁；再试一次「先改界面、失败回滚」的乐观更新。

:::hint 两种策略的取舍
提交锁最简单可靠；乐观更新体验好，但必须想清楚**回滚**。凡是没有回滚路径的乐观更新，都是给用户埋雷。
:::

:::solution 代码
```tsx
// 提交锁
if (submitting) return
setSubmitting(true)

// 乐观更新 + 回滚
const prev = list
setList([...list, tempItem])
try {
  const saved = await apiJson("/api/tasks", { method: "POST", body: JSON.stringify(tempItem) })
  setList((l) => l.map((x) => (x.id === tempItem.id ? saved : x)))
} catch (e) {
  setList(prev)          // 回滚
  message.error("创建失败")
}
```
:::

#### 步骤 5.3 错误映射：把 400 变成人话

后端返回 `{"error":"title 不能为空"}` 时，展示到对应字段；网络错误给「检查网络」。

:::hint 错误也是接口契约的一部分
`401` 要跳登录、`403` 要提示无权限、`400` 要定位到字段、`5xx` 要提示稍后重试。用一个 `toUserMessage(err)` 收敛，别在十个页面里各写一遍。
:::

:::solution 代码
```tsx
function toUserMessage(e: unknown): string {
  const err = e as { status?: number; message?: string }
  if (!err.status) return "网络异常，请稍后重试"
  if (err.status === 401) return "登录已过期，请重新登录"
  if (err.status === 403) return "没有权限执行该操作"
  if (err.status === 400) return err.message || "参数不合法"
  if (err.status >= 500) return "服务暂时不可用"
  return err.message || "操作失败"
}
```
:::

**验收**

- [ ] 连点按钮不会重复创建
- [ ] 提交失败有明确原因，不是「操作失败」四个字
- [ ] 乐观更新失败时界面能回滚

---

### 第 6 周：数据层与缓存

**本周目标**：请求有统一封装、缓存有明确失效策略、全局状态不滥用。

#### 步骤 6.1 统一请求封装

写一个 `apiJson`：自动带 cookie、统一错误、可取消、超时。

:::hint 为什么不要在每个页面写 fetch
十个地方写 fetch，就有十种错误处理、十种超时、十种 cookie 策略。收敛到一个函数，改行为只改一处 —— 这也是本项目的做法（`@/lib/api`）。
:::

:::solution 代码
```ts
export async function apiJson<T>(url: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), init.timeout ?? 15000)
  try {
    const res = await fetch(url, { credentials: "include", ...init, signal: init.signal ?? ac.signal })
    const text = await res.text()
    const body = text ? JSON.parse(text) : null
    if (!res.ok) throw Object.assign(new Error(body?.error || res.statusText), { status: res.status })
    return body as T
  } finally {
    clearTimeout(timer)
  }
}
```
:::

#### 步骤 6.2 缓存与失效：想清楚「什么时候旧」

给列表页加缓存（内存/SWR 思路），并明确：新增之后怎么让列表变新。

:::hint 缓存的难点从来不是存，是失效
先回答三个问题：数据多久算旧？谁负责让它失效？失效失败会怎样？答不上就别加缓存 —— 一个显示旧数据的页面比慢一点更糟。
:::

:::solution 代码
```ts
// 最小可用缓存：key + 时间戳 + 主动失效
const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 30_000

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T
  const data = await loader()
  cache.set(key, { at: Date.now(), data })
  return data
}

function invalidate(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k)
}
```
:::

#### 步骤 6.3 全局状态：什么时候真的需要

判断当前项目里哪些状态该进全局（主题、登录态），哪些不该（列表数据）。

:::hint 全局状态的判据
「多个互不相邻的页面都要读写，且生命周期跨路由」才进全局。列表数据、表单草稿、弹窗开关都不该进 —— 它们属于某个页面。
:::

:::solution 判断表
| 状态 | 放哪 | 理由 |
|---|---|---|
| 主题 light/dark | 全局 + localStorage | 全站生效、跨路由 |
| 当前登录用户 | 全局（或每次 /api/me） | 多处要用 |
| 列表筛选条件 | URL 查询参数 | 可分享、可回退 |
| 弹窗开关 | 组件本地 | 只影响自己 |
:::

**验收**

- [ ] 页面里没有裸 `fetch`，全部走统一封装
- [ ] 每个缓存都能说出失效时机
- [ ] 能说出一个「不该进全局」的状态及理由

---

## 阶段四 · 交付（第 7–8 周）

### 第 7 周：测试与可访问性

**本周目标**：关键交互有测试，键盘能用。

#### 步骤 7.1 组件测试：测行为，不测实现

用 Testing Library 的思路写一个测试：输入关键词 → 列表过滤 → 空态文案。

:::hint 为什么不用「快照测试」当主力
快照测的是「结构没变」，一改样式就红，改坏了却可能不红。按用户视角查询（`getByRole` / `getByText`）并断言可见结果，才是有效测试。
:::

:::solution 代码
```tsx
test("输入关键词后列表被过滤", async () => {
  render(<TaskPage />)
  await screen.findByText("写周报")
  await userEvent.type(screen.getByRole("textbox"), "周报")
  expect(screen.getByText("写周报")).toBeInTheDocument()
  expect(screen.queryByText("开会")).not.toBeInTheDocument()
})
```
:::

#### 步骤 7.2 可访问性：键盘与语义

把「div 当按钮」改成 `button`，Tab 能聚焦、Enter 能触发、读屏能读出名字。

:::hint 语义标签自带行为
`<button>` 自带键盘、焦点、role；`<div onClick>` 什么都没有，你得自己补 `tabIndex`、`onKeyDown`、`role`。用对的标签，成本最低。
:::

:::solution 代码
```tsx
// ❌
<div onClick={save} className="btn">保存</div>

// ✅
<button type="button" onClick={save} className="btn">保存</button>

// 图标按钮必须有可读名字
<button type="button" aria-label="删除任务" onClick={del}><TrashIcon /></button>
```
:::

**验收**

- [ ] 关键交互有一个「按用户视角」的测试
- [ ] 全站 Tab 一遍，焦点可见、Enter 能触发
- [ ] 图标按钮都有 `aria-label`

---

### 第 8 周：构建与上线

**本周目标**：能安全上线、能看懂构建产物、能回滚。

#### 步骤 8.1 构建与包体积

`npm run build` 后看产物：哪些页面是静态、哪些是动态、首屏 JS 有多大。

:::hint 构建输出就是体检报告
`○` 静态、`●` SSG、`ƒ` 动态。首屏 JS 突然变大，通常是某个 `"use client"` 往上提了，或者引入了大依赖（图表、编辑器）。改之前先看基线。
:::

:::solution 关注点
```text
1. 页面是 ○ / ● / ƒ？动态页多不多
2. 首屏 JS 有没有突然 +100KB
3. 有没有把 antd/echarts 之类打进不该进的页面
```
:::

#### 步骤 8.2 上线与回滚

走一遍本项目的发布流程：push → `sync-deploy.sh` → 线上验证 → 出问题怎么回滚。

:::hint 构建失败不会重启
同步脚本先构建、成功了才 `pm2 restart`；失败时老进程继续服务。所以「线上还是旧版」先看部署日志，不要怀疑缓存。
:::

:::solution 命令
```bash
npm run build
git push origin main
ssh myapp "/root/Notelab/notelab-java/ops/sync-deploy.sh notelab-b"
# 回滚：git revert <sha> && push && 再跑一次部署
```
:::

#### 步骤 8.3 真实页面：给 notelab-c 加一页

从零加一个页面：设计 → 组件 → 请求 → 状态 → 空态 → 错误态 → 构建 → 上线。

:::hint 验收标准是「别人能用」
页面做完的标志不是「我这能跑」，而是：刷新不丢、后退不崩、接口挂了有提示、手机能看。把这四条写进自检清单。
:::

:::solution 自检清单
```text
□ 刷新保持状态（URL 承载筛选条件）
□ 接口失败有错误态与重试
□ 空数据有空态文案
□ 375px 宽度下不横向滚动
□ npm run build 通过
□ 线上按 F5 不 404
```
:::

**验收**

- [ ] 能说出自己页面的首屏 JS 大小
- [ ] 走过一次完整发布，并能说出回滚步骤
- [ ] 新页面的四条自检全过

---

## 常见坑（本项目踩过的）

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面刷新 404 | 子路由不在守卫的精确匹配里 | 用 `?id=` 承载二级页，或把路径登记进 `PageRoutes` |
| 无限请求 | `useEffect` 依赖里放了每次新建的对象/函数 | 依赖放原始值，或用 `useCallback` 稳定引用 |
| 改了代码线上没变 | 只 push 没部署 / 构建失败但老进程还在 | 看 `sync-deploy` 日志；构建失败不重启是设计 |
| 深色模式闪白 | 首帧没加防闪烁脚本 | 参考现有 `layout` 的内联脚本 |
| 接口 401 但明明登录了 | B/C 两端 token 不互认 | 确认打的是哪一端、用的哪个 Cookie |
| 目录高亮不跟着走 | 观察器盯着被替换掉的旧节点 | 按滚动位置现算，别缓存 DOM 引用 |

> **提醒**：React 的坑 90% 出在「状态放错位置」和「副作用没清理」。这两条吃透，比学十个新 API 有用。
