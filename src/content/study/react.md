# React 上手路线 · 4 周专项（面向本项目前端）

> **定位**：你已经在用 Next 16 + React 19 写页面（`notelab-b` / `notelab-c`），所以这里不教「什么是组件」，而是把**容易写错的地方**逐条钉死：状态从哪来、什么时候重渲染、服务端与客户端边界在哪。
>
> **学完的标准**：能在 `notelab-c` 里独立加一个带表单、列表、分页、错误处理的页面，并且知道它为什么不会重复请求、不会无限渲染。
>
> **用法**：思路和代码默认收起，先自己判断，再点开对照。

---

## 先建立三个判断

| 判断 | 错误做法 | 正确做法 |
|---|---|---|
| 状态放哪 | 什么都塞进组件 `useState` | **能被推导的不要存**；跨组件用提升或 Context |
| 什么时候重渲染 | 靠 `useEffect` 手动同步 | 渲染由状态驱动，副作用才用 `useEffect` |
| 服务端还是客户端 | 全站 `"use client"` | 默认服务端；只有需要交互/浏览器的组件才加 |

**一句话**：React 不是「用 JS 操作 DOM」，而是「用状态描述 UI」。每一行 `useEffect` 都要能回答「这是在同步什么外部系统」。

---

## 第 1 周：组件、props、状态

**本周目标**：能解释「状态 → 渲染」的关系，并写出不会无限重渲染的组件。

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

**验收**

- [ ] 能解释「为什么连写三次只加 1」
- [ ] 能用下标 key 复现错位
- [ ] 能在 DevTools 里看出哪些组件重渲染了

---

## 第 2 周：副作用与数据请求

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

:::error Too many re-renders
```text
Uncaught Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
```
**原因**：在渲染期间直接调了 setState —— 最常见的是 `onClick={setOpen(true)}`（少写了箭头函数，渲染时就执行了），或者 `useEffect` 依赖里放了一个每次新建的对象。
**改法**：`onClick={() => setOpen(true)}`；依赖收窄到原始值。
:::

#### 步骤 2.2 三态齐全的错误页

把 loading / error / data 三态都渲染出来，失败时给「重试」按钮。

:::hint 三态缺一个就是白屏
最常见的线上问题不是「接口挂了」，而是「接口挂了但页面什么都不显示」。三态是页面契约的一部分：loading 给骨架，error 给原因 + 重试，data 才是正常内容。
:::

:::solution 代码
```tsx
if (loading) return <Skeleton active />
if (error) return <Alert type="error" message="加载失败" description={error.message}
  action={<Button size="small" onClick={reload}>重试</Button>} />
return <List dataSource={data.items} ... />
```
:::

**验收**

- [ ] 快速切页不会出现旧数据覆盖新数据
- [ ] 请求失败有明确提示，不是白屏
- [ ] 能说出这个页面发了几次请求、为什么

---

## 第 3 周：Next.js App Router（本项目的真实形态）

**本周目标**：能判断组件该不该 `"use client"`，能读懂页面守卫。

#### 步骤 3.1 判断一个组件该不该 "use client"

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

#### 步骤 3.2 读懂页面守卫

打开 `notelab-b/src/app/(admin)/layout.tsx`，找到 `pages.includes(pathname)`，回答：为什么新页面必须在 Java 的 `PageRoutes` 里登记。

:::hint 权限码就是路径本身
后端的 `pages` 清单来自 `PageRoutes.PAGE_ROUTES`，守卫做的是**精确匹配**。没登记的路径，即使页面文件存在，也会被判无权限——表现是「菜单没有」或「点进去被弹回」。
:::

:::solution 结论
```text
/api/menu → { menu: [...], pages: ["/", "/chat", "/study/java", ...] }
守卫：pages.includes(pathname) 为 false → 不渲染子页面 → 跳 /no-access
所以：新增页面 = 前端 page.tsx + Java MenuTree + Java PageRoutes，三处缺一不可
```
:::

:::error 构建期报的两个错
```text
Error: useSearchParams() should be wrapped in a suspense boundary at page "/study/[lang]".
```
↓ 静态页里用了 `useSearchParams`，必须包一层 `<Suspense>`，否则整页会退化成动态渲染（或直接构建失败）。本项目的 `/learning`、`/study` 都是这个写法。

```text
Error: Hydration failed because the server rendered HTML didn't match the client.
```
↓ 服务端与客户端首帧不一致：常见是 `Date.now()` / `Math.random()` / `localStorage` 直接写在渲染里。把这类值放进 `useEffect`，或给首帧一个确定的占位。
:::

**验收**

- [ ] 能说出一个组件该不该加 `"use client"`
- [ ] 能解释「为什么新增页面要同时改 Java 的两处常量」
- [ ] 能说出守卫的局限（它挡误入，不是安全边界）

---

## 第 4 周：工程化与真实交付

**本周目标**：能独立完成「表单 → 请求 → 错误处理 → 构建 → 上线」这条链路。

#### 步骤 4.1 表单校验与提交

用 antd `Form` 做「新建任务」：必填、长度限制、提交中禁用、成功后刷新列表。

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

#### 步骤 4.2 构建通过并上线

`npm run build` 必须过，然后 push → 服务器 `sync-deploy.sh notelab-b` → 线上按 F5 不 404。

:::hint 构建失败不会重启
同步脚本先构建、成功了才 `pm2 restart`；失败时老进程继续服务。所以「线上还是旧版」先看部署日志，不要怀疑缓存。
:::

:::solution 命令
```bash
npm run build
git push origin main
ssh myapp "/root/Notelab/notelab-java/ops/sync-deploy.sh notelab-b"
```
:::

**验收**

- [ ] `npm run build` 通过
- [ ] 线上能访问，刷新不丢
- [ ] 能说出这个页面服务端渲染了什么、客户端渲染了什么

---

## 常见坑（本项目踩过的）

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面刷新 404 | 子路由不在守卫的精确匹配里 | 用 `?id=` 承载二级页，或把路径登记进 `PageRoutes` |
| 无限请求 | `useEffect` 依赖里放了每次新建的对象/函数 | 依赖放原始值，或用 `useCallback` 稳定引用 |
| 改了代码线上没变 | 只 push 没部署 / 构建失败但老进程还在 | 看 `sync-deploy` 日志；构建失败不重启是设计 |
| 深色模式闪白 | 首帧没加防闪烁脚本 | 参考现有 `layout` 的内联脚本 |
| 接口 401 但明明登录了 | B/C 两端 token 不互认 | 确认打的是哪一端、用的哪个 Cookie |

> **提醒**：React 的坑 90% 出在「状态放错位置」和「副作用没清理」。这两条吃透，比学十个新 API 有用。
