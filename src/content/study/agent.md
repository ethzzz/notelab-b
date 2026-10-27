# Agent 前端 · 6 周冲刺路线（React / 6 年 → P6）

> **给谁**：6 年 React 经验、能做业务、但没系统做过「流式 + 多会话 + 工具调用可视化」这一类 AI 产品的工程师。
> **终点**：P6（高级工程师）—— 不是"会用 SDK"，而是能定协议、能给指标、能说清每个选择的代价。
> **节奏**：每周 8–10 小时，每周一个可演示的产出。没过验收不进下一周。

## 这条路线要把你带到哪

| 级别 | 叫法 | 能做什么 | 怎么算达到 |
|---|---|---|---|
| L1 | 会用 | 接一个 `useChat` 把对话跑起来 | 能在一天内搭出 demo |
| L2 | 能独立 | 自己写 SSE 解析、做增量渲染、撑住长对话 | 交付一个可上线的单人 Agent 页面 |
| **L3** | **高级（本路线终点）** | 定事件协议、建组件体系、给出性能数据、能兜住失败模式 | 通过文末 rubric |
| L4 | 资深 | 设计多 Agent 协作架构、平台级编排与发布体系 | 本路线只覆盖边界，需长期实战 |

**P6 的具体标志**（面试官会逐条验证）：

- 给你一条流，能说出它会在哪 7 种情况下坏，每种怎么兜；
- 能解释为什么选 A 不选 B，并说出 A 的代价；
- 性能优化有指标、有归因、有 before/after，不是"感觉快了很多"；
- 产出的组件或协议被**别人复用**，而不是只有自己会改。

## 知识地图：五个域

| 域 | P6 要求 | 对应周 |
|---|---|---|
| 流式链路 | 自己实现解析与重连，失败模式可枚举 | 1 |
| 增量渲染 | 把 O(n²) 降成 O(n)，富内容延迟渲染 | 2 |
| 状态建模 | 多会话、并发流、竞态守卫、恢复 | 3 |
| 过程可视化 | part 协议、工具卡片、参数表单、HITL | 4 |
| 性能与表达 | 虚拟化、调度、埋点、方案评审 | 5–6 |

> 配套实验台：`agent-frontend-lab`（手写解析器 + 合并增量 + 增量渲染 + 虚拟化）。
> 每条 `:::solution` 里的代码都能在那个工程里跑到。
>
> 每个步骤都有一个 **开发链路** 小节：需求拆解 → 数据模型 → 接口契约 → 关键实现 → 验证 → 上线，
> **只写这个实现真正的取舍与代价**。没有难点的步骤会直说"按既有模式做"，不凑字数。

---

## 阶段一 · 流式链路（第 1–2 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L1 → L2 |
| 这一阶段解决 | 从"数据能到"到"任何故障都不丢、不乱、不卡" |
| 核心知识 | SSE 报文、分帧、UTF-8 半包、断线判定、竞态守卫、增量渲染 |
| 场景项目 | 一个能切会话、能停止、能重生成、断线可恢复的单人对话页 |
| 离开时应该能 | 不看库，手写一套 SSE 客户端并讲清每个 if 的由来 |

### 第 1 周：把"能收到字"变成"任何故障都不丢"

**本周目标**：不依赖 `EventSource` 与任何 SDK，手写一套 SSE 客户端，覆盖半包、多字节截断、心跳、中途断开四类故障，并为"重新生成"加上竞态守卫。

**为什么是这些内容**

绝大多数人只会用 `useChat`，一被问"SSE 一帧长什么样"就卡住。而这条链路上的每一个 bug 都有同一个特征：**本机不复现、线上偶发**。中文乱码每几百字闪一次、切会话后旧回复覆盖新回复、断网后界面永远停在"生成中"——全都不是"再试一次就好了"的问题，而是协议层没写对。

所以第一周不追求功能多，追求**每条失败路径都有对应的代码和测试**。写完你应该能画出一张图：字节流 → 解码 → 分帧 → 解析 → 状态机 → 渲染，并在每一层标出"这里会怎么坏"。

#### 步骤 1.1 用 fetch + ReadableStream 取代 EventSource

先记住 EventSource 的四个硬限制，这是面试的第一道题：

1. 只能 GET，发不了长 prompt 和结构化 body；
2. 不能自定义请求头，带不了 `Authorization` 和链路追踪 id；
3. 拿不到非 2xx 的响应体，401/429 只能靠 `onerror` 猜；
4. 没有背压，消费慢的时候全堆在内存里。

它白送的两个能力必须自己补上：**自动重连**和 **`Last-Event-ID` 续传**。所以生产代码几乎都是 `fetch` + `response.body.getReader()`。

**开发链路**

- **需求拆解**：要的不是"能收到字"，而是**任意分片切法下都不丢帧、不乱码**。隐藏约束：chunk 边界不可控、中文 3 字节会被切开、部分后端不发结尾空行。
- **数据模型**：缓冲区只保存"未完成的那一行"，完整帧立刻消费，不在内存里堆整条回复。
- **契约**：帧 = `event` + `data` + `id`；`data` 为空且无 `event` 视为心跳，丢弃。
- **关键实现**：按行扫，不按 `\n\n` 切。代价是多一次行扫描；收益是任何切法都不丢。
- **验证**：逐字符喂 + 按 2 字节切 UTF-8，8 个用例覆盖半包/跨包/多行 data。
- **上线**：纯前端，落 B 端对话页；无接口改动，回滚就是换回旧解析器。

:::hint 三个必踩的坑
1. **不能按 `\n\n` 切**：`data: {"delta":"你` 可能被 chunk 切成两半，正则匹配不到结尾，那一帧就丢了。正确做法是**按行处理**，只消费完整的行，剩下的留在缓冲区。
2. **必须用 `TextDecoder` 的 `stream: true`**：中文 UTF-8 占 3 字节，chunk 边界很可能切在第 2 个字节上。不加这个参数，每个边界都会产出 `�`，而且频率取决于网络分片，极难复现。
3. **`\r\n` 会被切在中间**：缓冲区末尾是 `\r` 时不能立刻当行尾，要等下一个 chunk 判断是不是 `\r\n`，否则会多吐一个空行（对空行敏感的场景就会多派发一帧）。
:::

:::solution 参考实现：逐行增量解析器
```ts
export type SSEFrame = { event: string; data: string; id: string | null }

export class SSEParser {
  private buf = ""
  private event = ""
  private data: string[] = []
  private id: string | null = null

  feed(chunk: string): SSEFrame[] {
    this.buf += chunk
    const out: SSEFrame[] = []

    for (;;) {
      const m = /[\r\n]/.exec(this.buf)
      if (!m) break
      // 行尾是 \r 且正好在缓冲区末尾：可能是被切开的 \r\n，等下一个 chunk
      if (this.buf[m.index] === "\r" && m.index === this.buf.length - 1) break

      let next = m.index + 1
      if (this.buf[m.index] === "\r" && this.buf[next] === "\n") next += 1

      const line = this.buf.slice(0, m.index)
      this.buf = this.buf.slice(next)

      if (line === "") {
        const frame = this.dispatch()
        if (frame) out.push(frame)   // 空 data + 默认 event = 心跳，丢弃
      } else {
        this.line(line)
      }
    }
    return out
  }

  private line(line: string) {
    if (line.startsWith(":")) return            // 注释 / 心跳
    const i = line.indexOf(":")
    const field = i === -1 ? line : line.slice(0, i)
    let value = i === -1 ? "" : line.slice(i + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    if (field === "event") this.event = value
    else if (field === "data") this.data.push(value)
    else if (field === "id") this.id = value
  }

  private dispatch(): SSEFrame | null {
    const event = this.event || "message"
    const data = this.data.join("\n")           // 多行 data 用换行拼
    const id = this.id
    this.event = ""
    this.data = []
    this.id = null
    return data === "" && event === "message" ? null : { event, data, id }
  }
}

export async function* readSSE(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = body.getReader()
  const dec = new TextDecoder()
  const parser = new SSEParser()
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      for (const f of parser.feed(dec.decode(value, { stream: true }))) yield f
    }
    for (const f of parser.feed(dec.decode())) yield f
  } finally {
    reader.releaseLock()
  }
}
```
:::

:::error 常见报错
- **中文间歇性乱码**：漏了 `{ stream: true }`，或者用 `String.fromCharCode` 自己拼字节。
- **偶发丢帧**：按 `\n\n` 切而不是按行切，最后一个不完整帧被丢掉；或者流结束时没 flush。
- **每帧都触发两次渲染**：把注释心跳（`: ping`）也当成了消息。
- **`[DONE]` 之后还继续读**：部分后端的结束标记是 `data: [DONE]`，要显式判断并 `break`，否则 reader 悬挂、内存不释放。
:::

#### 步骤 1.2 判断"流断了"，以及重连后怎么接

`reader.read()` 返回 `done: true` **不代表成功**。正常结束应该有 `end` 事件；没有 `end` 就 `done`，说明连接在中途被掐断（网关超时、服务重启、客户端网络切换）。这是最容易漏的一层：界面上看起来"生成完了"，其实只生成了一半。

**开发链路**

- **需求拆解**：用户感知是"停在半截"，真实问题是"没有 `end` 就 `done`"被当成了成功。隐含要求：重连不能把服务打挂，也不能重复内容。
- **数据模型**：`sawEnd` 布尔 + `attempt` 计数；重连前先拉快照覆盖本地，再接增量。
- **契约**：有 `end` = 正常结束；无 `end` 即断线；`error` 且 `retryable: false` 不重连。
- **关键实现**：指数退避 + ±20% 抖动。代价是最坏要等 30s 才放弃；收益是服务重启时不会形成重连脉冲。
- **验证**：断网 3 次 + 服务端 kill 一次，断言不重复、状态落 `error` 而不是永远 `streaming`。
- **上线**：前端改动为主；要真正"续上"必须服务端提供进行中 run 的快照接口，否则只能降级为提示重试。

:::hint 断线三件事
1. **判定**：维护 `sawEnd` 布尔，流结束后检查；同时把 `fetch` 抛错、`status !== 200`、`body === null` 都归为失败。
2. **退避**：`min(30s, 500ms × 2^n)` 再加 ±20% 抖动。**没有抖动**的重连在服务重启时会形成脉冲，把刚起来的服务再打挂一次。
3. **续传**：生成中的流**无法真正续**（服务端 token 已经推过了）。现实做法是重连后先拉一次 `GET /api/runs/{id}` 拿当前快照，再用快照覆盖本地，然后接后续增量。`Last-Event-ID` 只在"服务端保留事件缓冲区"时才有意义。
:::

:::solution 参考实现：断线判定与退避
```ts
let sawEnd = false
let attempt = 0

while (attempt < 5) {
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "text/event-stream" } })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    for await (const f of readSSE(res.body, ac.signal)) {
      if (f.event === "end") { sawEnd = true; break }
      if (f.event === "error") throw new Error(f.data)
      handle(f)
    }
    if (sawEnd) break
    throw new Error("stream closed without end")
  } catch (e) {
    if (ac.signal.aborted) throw e          // 用户主动停，不重连
    attempt += 1
    const base = Math.min(30_000, 500 * 2 ** attempt)
    await sleep(base * (0.8 + Math.random() * 0.4))   // 抖动
    await resyncSnapshot(runId)             // 关键：先对齐状态，再接增量
  }
}
```
:::

:::error 常见报错
- **重连风暴**：固定 500ms 重试且无抖动，服务恢复瞬间被打满。
- **重复内容**：重连后从头发，本地又 append 了一遍。必须靠 `seq` 或 `partId` 去重。
- **永远转圈**：`done` 后没检查 `sawEnd`，状态一直停在 `streaming`。
:::

#### 步骤 1.3 竞态：abort 管"停"，runId 管"谁算数"

这两件事经常被混成一件。`AbortController` 只能阻止**还没到**的数据，阻止不了**已经在路上**的那几帧。所以真正的正确性来自版本号：每次生成分配一个 `runId`，写入前校验"这条消息当前的 runId 还是不是我这个"。

**开发链路**

- **需求拆解**：这是**正确性**问题（旧内容覆盖新内容），不是"要能停下"。两者常被混成一个 `abort` 调用。
- **数据模型**：每条 assistant 消息各自持有 `runId` + `status`；到终态后拒绝任何写入。
- **契约**：`abort` 只负责停止传输，不承担正确性；正确性由"当前 runId"定义。
- **关键实现**：写入前比一次 `runId`。代价是每次写入多一次比较；收益是并发下内容可证明唯一。
- **验证**：连点两次"重新生成"，断言最终内容只属于第二次；切会话再切回不串台。
- **上线**：纯前端；不需要服务端配合，也不改变请求次数。

:::hint 三类竞态
1. **重新生成**：旧流没停干净，新流已经开始，旧 token 覆盖新回复 → 内容错乱。
2. **切会话**：A 会话的流还在跑，用户切到 B，回来发现 A 的内容是半截或错位。
3. **并发多条**：同一会话里用户连发两条，两路流同时写同一个列表 → 顺序错。

前两个靠 `runId` + `abort` 解决；第三个必须让**每条 assistant 消息独立持有自己的 runId**，而不是会话级共享一个"当前流"。
:::

:::solution 参考实现：写入守卫
```ts
function applyIfLive(state: State, msgId: string, runId: string, fn: (m: Msg) => Msg) {
  const m = state.messages[msgId]
  if (!m) return null
  if (m.runId !== runId) return null                              // 不是当前这次生成
  if (m.status === "done" || m.status === "error" || m.status === "cancelled") return null
  return { messages: { ...state.messages, [msgId]: fn(m) } }
}

// 重新生成：换一个新的 runId 重跑，旧流即使有残帧也写不进来
function retry(msgId: string) {
  abortMap.get(msgId)?.abort()
  const runId = newRunId()
  resetMessage(msgId, runId)
  void streamInto({ msgId, runId })
}
```
:::

:::error 常见报错
- **只 abort 不加守卫**：本机永远正常，线上偶发"回复变成两段拼在一起"。
- **把流写在 `useEffect` 里**：路由一跳就断，而且 React 18 的开发态双调用会让同一条流跑两遍。
- **abort 后状态没落**：`catch` 里不区分 `signal.aborted`，把用户主动停止也显示成"错误"。
:::

**验收**

- [ ] 单测覆盖：单帧、多帧粘连、逐字符半包、`\r\n` 被切开、多行 data、心跳、UTF-8 跨字节。
- [ ] 手动断网 3 次，恢复后内容不重复、不乱序。
- [ ] 快速点两次"重新生成"，最终内容只属于第二次。
- [ ] 切会话再切回，进行中的流仍然在写，且没有串台。

### 第 2 周：增量渲染，把 O(n²) 降成 O(n)

**本周目标**：让 5000 字的流式回复稳定在 55fps 以上，并把"每 token 全量重解析"改成"只重算尾块"，用 Profiler 数据证明。

**为什么是这些内容**

流式渲染的性能问题有个欺骗性：300 字时完全正常，2000 字开始掉帧，5000 字时输入框都卡。根因是复杂度而不是"框架慢"——第 k 个 token 到来时要重新解析前 k 个字符，总成本是 O(n²)。数据量翻倍，成本翻四倍，所以它总是"在某个长度突然崩"。

这一周要建立的直觉是：**渲染成本必须与"变化量"成正比，而不是与"总量"成正比**。

#### 步骤 2.1 块级切分：稳定块 + 尾块

Markdown 的块边界是空行（围栏内除外）。已经闭合的块不会再变，可以 memo；只有最后一块还在增长。

**开发链路**

- **需求拆解**：目标不是"渲染更快"，而是**渲染成本与变化量成正比**。长度翻倍成本不该翻四倍。
- **数据模型**：`stable[]` + `tail`；块是 append-only 的，内容本身就是稳定身份（key 用内容，不用下标）。
- **契约**：块边界 = 围栏外的空行；围栏未闭合时整段归 `tail`，绝不切成半截代码块。
- **关键实现**：切分 + 块级 memo。代价是多一层组件与一次切分；收益是 O(n²) → O(n)。
- **验证**：5000 字流式回复，Profiler 对比提交次数；肉眼确认代码块不闪。
- **上线**：纯前端，无接口依赖；回滚只影响渲染层，不动数据。

:::hint 两个边界情况
1. **未闭合围栏**：``` 开了没关时，后面所有内容都属于这个代码块，不能按空行切——否则会被渲染成"一段代码 + 一段正文"，视觉上整段跳变。
2. **memo 的 key 用内容而不是下标**：块是 append-only 的，内容天然是稳定身份；用下标的话，一旦前面插入内容，React 会把旧内容贴到新位置。
:::

:::solution 参考实现：切分 + 补围栏
```ts
const FENCE = /^\s*(```|~~~)/

export function splitBlocks(md: string) {
  const stable: string[] = []
  let cur: string[] = []
  let inFence = false

  for (const line of md.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence
    if (!inFence && line.trim() === "") {
      if (cur.length) { stable.push(cur.join("\n")); cur = [] }
      continue
    }
    cur.push(line)
  }
  return { stable, tail: cur.join("\n"), inFence }
}

// 流式时补上结尾围栏，避免"代码块 → 纯文本"的闪回
export function closeFence(md: string) {
  const n = (md.match(/^\s*(```|~~~)/gm) ?? []).length
  if (n % 2 === 0) return md
  const marker = md.match(/^\s*(```|~~~)/)?.[1] ?? "```"
  return `${md}\n${marker}`
}
```

配合渲染层：`stable.map(b => <MdBlock key={b} md={b} />)`，`MdBlock` 用 `memo` + `useMemo(marked.parse)`。
:::

:::error 常见报错
- **每次 token 都重建整棵 Markdown 树**：`react-markdown` 默认行为就是全量 parse，必须自己切块。
- **代码高亮实时跑**：Shiki/Prism 单次 5–20ms，每帧跑一次必然掉帧。块闭合后再高亮。
- **`key={index}`**：内容插入时 memo 命中错误，出现"上一段内容闪到下一段"。
:::

#### 步骤 2.2 富内容的渲染时机：公式、图表、表格

KaTeX、Mermaid、ECharts 的共同点是**初始化成本远高于文本**，而且**半截输入会渲染出错误结果**（`$x^2` 只有左括号时 KaTeX 会抛错，Mermaid 语法不全时直接报红）。

**开发链路**

- **需求拆解**：真正要解的是"半截输入"，不是"渲染慢"。用户看到红色报错会认为功能坏了，而不是"还没生成完"。
- **数据模型**：以内容哈希为键的结果缓存；只有块闭合后才写入缓存。
- **契约**：闭合判定 = 围栏出现偶数次且 `$$` 出现偶数次；奇数次继续等下一帧。
- **关键实现**：延迟渲染 + 缓存 + 失败降级成代码块。代价是闭合前看到的是源码而非图形；收益是不闪、不报错、不重算。
- **验证**：流式过程中不出现红色错误框；Mermaid 同一段只初始化一次（看 DOM 节点数）。
- **上线**：纯前端；图表库按需懒加载，避免首屏体积回退。

:::hint 三条规则
1. **只在块闭合后渲染**：用 `inFence` / 是否以 `$$` 结尾 / 是否已出现 ` ```mermaid ` 闭合来判断。
2. **缓存结果**：同一段公式/图只渲染一次，用内容哈希做 key。流式场景里"重算同一段"是纯浪费。
3. **失败降级成代码块**，不要显示红色报错框——用户在流式过程中看到报错会以为功能坏了。
:::

:::solution 参考实现：延迟渲染
```tsx
function RichBlock({ md }: { md: string }) {
  const hash = useMemo(() => simpleHash(md), [md])
  const cache = useRef(new Map<string, string>())

  const html = useMemo(() => {
    if (cache.current.has(hash)) return cache.current.get(hash)!
    const out = renderMermaidOrKatex(md)   // 失败时返回 <pre>
    cache.current.set(hash, out)
    return out
  }, [hash, md])

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

判断"何时算闭合"：块内 ` ``` ` 出现偶数次、`$$` 出现偶数次。奇数次就继续等下一帧。
:::

:::error 常见报错
- **Mermaid 每帧重新初始化**：会累积大量 iframe/DOM，内存飙升。
- **公式半截时抛异常把整棵树打崩**：没有 try/catch，一个 `$` 就让页面白屏。
- **表格列没定型就渲染**：流式中表格行数一直在变，宽度会跳。可以先降级成文本，闭合后再渲染。
:::

**验收**

- [ ] 5000 字回复的 Profiler 截图：提交次数下降一个数量级。
- [ ] 肉眼观察代码块从"输出中"到"完成"没有整段闪烁。
- [ ] 公式/图表在流式过程中不报错、不重算。
- [ ] 文档里写清"为什么这样切"，别人能照着改。

---

## 阶段二 · 状态与过程可视化（第 3–4 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从"一条流"到"多会话、多阶段、可干预" |
| 核心知识 | 扁平化 store、selector 粒度、part 协议、工具卡片、schema 表单、HITL |
| 场景项目 | 带工具调用与审批的 Agent 工作台 |
| 离开时应该能 | 说清一条消息的完整生命周期，并给出事件协议 |

### 第 3 周：状态建模，让并发和恢复变得确定

**本周目标**：把消息、会话、运行状态拆成可独立订阅的单元，做到"改一条消息只重渲染一条"，并支持切会话不中断、刷新可恢复。

**为什么是这些内容**

AI 产品的状态比普通表单难一个量级：同一条消息会在"流式中"被高频改写；同一会话可能有多条并发流；用户随时切走再回来；刷新后还要接上。如果沿用"一个 `useState` 装整个对话"的写法，会同时踩三个坑：性能（整树重渲染）、正确性（竞态覆盖）、体验（切走就断）。

解法是把**引用稳定性**当成设计目标：状态扁平化，组件按 id 订阅，流放组件之外。

#### 步骤 3.1 扁平化存储与 selector 粒度

**开发链路**

- **需求拆解**：性能瓶颈不在"状态太大"，而在**订阅太粗**——改一条消息，整棵树重渲染。
- **数据模型**：normalized（`Record<id, Message>` + `order[]`），"引用稳定"是设计目标而不是副作用。
- **契约**：组件只订阅 `messages[id]`；selector 一律返回已有引用，不返回新对象/新数组。
- **关键实现**：扁平化 + 按 id 订阅。代价是每次取值多一次索引；收益是改一条只重渲染一条。
- **验证**：DevTools 的 Highlight updates，新增一个 token 只该闪一条消息。
- **上线**：纯前端；若已有旧结构，迁移成本主要在读写两端，建议一次性换完不留双份。

:::hint 三条硬规则
1. `messages: Record<id, Message>` + `order: string[]`，不要嵌套数组。改一条消息不触碰其他引用。
2. 每个消息组件只订阅自己的那条：`useStore(s => s.messages[id])`。**不要**订阅整个数组再 `find`。
3. selector 里不要做 `Object.values()` / `filter()`：每次返回新数组，`Object.is` 永远不等，直接触发无限重渲染。
:::

:::solution 参考实现：zustand 分片
```ts
type State = {
  sessions: Record<string, Session>
  order: Record<string, string[]>        // sessionId -> msgId[]
  messages: Record<string, Message>
  activeId: string
}

// 组件里：只取自己的消息
const msg = useChat((s) => s.messages[id])

// 会话列表：取引用稳定的对象，展开放到渲染期
const sessions = useChat((s) => s.sessions)
return Object.values(sessions).map(...)
```
:::

:::error 常见报错
- `useStore(s => s.messages.filter(...))` → 无限重渲染（返回新数组）。
- 用 Context 传整个 store → 任何一条消息更新，所有消费者都重渲染。
- 把流式文本和"最终文本"存两份，最后对账出错位。
:::

#### 步骤 3.2 会话并发与刷新恢复

**开发链路**

- **需求拆解**：两个诉求常被当成一个——"切走别断"（前端结构问题）与"刷新能接上"（需要服务端快照）。前者自己能解，后者不能。
- **数据模型**：模块级 run 注册表（`msgId → AbortController`），与组件生命周期无关。
- **契约**：`GET /api/runs?status=running` 返回进行中快照；重连后按 `runId` 幂等去重。
- **关键实现**：runner 与组件解耦，流在模块层消费。代价是多了一份模块级状态（必须显式清理，否则内存泄漏）；收益是导航/卸载都不影响生成。
- **验证**：切会话 10 次内容不串；刷新后能识别进行中的 run 或明确提示已中断。
- **上线**：需要服务端提供"进行中 run"查询；没有就先只做"切走不断"，恢复降级为提示。

:::hint 设计要点
- 流的消费者（`for await` 循环）放在模块级 runner 里，**不放组件**。组件卸载不影响流。
- 每条 assistant 消息是独立的 run 单元，有自己的 abort 和 runId。
- 刷新恢复靠服务端：`GET /api/runs?status=running` 拿到进行中的 run，用 snapshot 覆盖本地再接增量。
- 本地持久化用 IndexedDB，别用 localStorage（5MB 上限，长对话很容易撑爆）。
:::

:::solution 参考实现：run 注册表
```ts
const aborts = new Map<string, AbortController>()   // msgId -> controller

export function send(sessionId: string, text: string) {
  const runId = newRunId()
  const msgId = `a_${runId}`
  store.addMessages(sessionId, [userMsg(text), assistantStub(msgId, runId)])
  void streamInto({ sessionId, msgId, runId, prompt: text })   // 不 await
}

export function stop(msgId: string) {
  aborts.get(msgId)?.abort()      // 只停，不删内容
}
```
:::

:::error 常见报错
- 把 `await streamInto()` 写在事件处理里：切走即中断。
- 刷新后本地有半条消息、服务端还在跑 → 出现两条重复消息，没有按 runId 去重。
- 用 `Date.now()` 当消息 id：同一毫秒连发会碰撞。
:::

**验收**

- [ ] 1000 条历史 + 正在流式输出，输入框打字不卡。
- [ ] 切会话 10 次，消息不串、不丢、不重复。
- [ ] 刷新页面后，进行中的 run 能被识别并续上（或明确提示已中断）。
- [ ] DevTools 里能看到：新增一个 token 只触发一条消息组件重渲染。

### 第 4 周：Agent 过程可视化与事件协议

**本周目标**：把"思考 / 工具调用 / 检索 / 结果"做成可扩展的 part 协议与组件注册表，并让工具参数从 JSON Schema 自动生成表单。

**为什么是这些内容**

AI 产品的差异不在"能聊天"，而在**用户能不能看懂、能不能干预**。一个工具调用如果只显示"正在调用工具…"，用户既不知道调了什么、也不知道能不能改参数、更不知道失败了怎么办——产品就退化成了黑盒。

这一周的核心是**协议先行**：先定义 part 的类型，再让渲染器按类型注册。这样加一种新能力（新的检索方式、新的执行器）只需要加一个组件，而不是到处改 `switch`。

#### 步骤 4.1 part 协议与渲染器注册表

**开发链路**：这一步没有新的取舍——`switch`、多态组件、注册表三种写法都能跑，注册表只是把"加一种类型"的成本从 N 处降到 1 处，没有性能或正确性代价。按 hint 做即可，不需要单独的上线评估。

:::hint 协议设计四条
1. **判别联合**：`{ type: "text" } | { type: "tool_call" } | ...`，别用裸字符串。
2. **稳定的 id**：每个 part 都有 `id`，流式增量按 id 归并，而不是"最后一段一定是文本"。
3. **未知类型安全降级**：后端先上线新 part 时，前端要显示"暂不支持"而不是崩溃。
4. **协议带版本号**：`v: 1`，破坏性变更时前端能给出可读提示而不是解析失败。
:::

:::solution 参考实现：registry
```ts
export type Part =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "thinking"; text: string }
  | { id: string; type: "tool_call"; callId: string; name: string; args: unknown; state: "running" | "ok" | "fail" }
  | { id: string; type: "retrieval"; hits: { docId: string; text: string; score: number }[] }

const RENDERERS: Record<Part["type"], ComponentType<{ part: Part }>> = {
  text: TextPart,
  thinking: ThinkingPart,
  tool_call: ToolCallPart,
  retrieval: RetrievalPart,
}

export function PartView({ part }: { part: Part }) {
  const C = RENDERERS[part.type]
  return C ? <C part={part} /> : <div className="unknown">暂不支持的内容类型：{part.type}</div>
}
```
:::

:::error 常见报错
- `switch (part.type)` 散落在 6 个文件里，加一种类型改 6 处。
- 用"最后一段是文本"来推断增量位置，遇到并行工具调用就错位。
- 工具参数直接 `JSON.stringify` 一大坨，用户读不懂也没法改。
:::

#### 步骤 4.2 JSON Schema 参数表单与 HITL 审批

工具参数本质上是结构化数据，Schema 已经描述了类型、枚举、必填，没必要手写每个表单。

**开发链路**：Schema → 控件的映射是标准套路，没有需要权衡的架构选择；难点全在细节（校验定位、密钥脱敏、审批超时），按 hint 逐条做。风险集中在一处：审批回传的参数必须真的被执行。

:::hint 映射表与三个细节
| Schema | 控件 |
|---|---|
| `string` / `number` / `boolean` | Input / InputNumber / Switch |
| `enum` | Select |
| `object` | 分组 |
| `array` | 可增删列表 |
| `oneOf` | 类型选择器 + 对应子表单 |

细节：① 必填项在提交前校验并定位到字段；② 密钥类字段（`apiKey`、`token`）用密码框 + 只显示掩码；③ 审批要有超时策略，超时后按钮置灰并给出"已过期，请重新发起"，不要让用户点了没反应。
:::

:::solution 参考实现：审批卡片
```tsx
function ApprovalCard({ call, onApprove, onReject }: Props) {
  const [draft, setDraft] = useState(call.args)
  const [touched, setTouched] = useState(false)

  return (
    <div className="approval">
      <header>需要你确认：{call.name}</header>
      <SchemaForm schema={call.schema} value={draft} onChange={setDraft} />
      {touched ? <div className="hint">参数已修改，将按新参数执行</div> : null}
      <footer>
        <button onClick={() => onApprove(draft)}>执行</button>
        <button onClick={onReject}>跳过</button>
      </footer>
    </div>
  )
}
```
:::

:::error 常见报错
- 审批后没有把"修改后的参数"回传，服务端仍按原参数执行。
- 没有超时：用户十分钟后点"执行"，run 已经结束了。
- 嵌套 array/object 只渲染第一层，深层参数用户根本改不了。
:::

**验收**

- [ ] 新增一种 part 类型只改 1 个文件（registry 加一行）。
- [ ] 工具卡片能显示参数、耗时、结果，失败时有原因。
- [ ] 参数表单能改、能校验、能把修改回传。
- [ ] 未知 part 类型不崩，显示降级提示。

---

## 阶段三 · 性能与表达（第 5–6 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 站稳 |
| 这一阶段解决 | 从"能跑"到"有数据、有取舍、讲得清" |
| 核心知识 | 虚拟化与流式冲突、渲染调度、指标埋点、方案评审 |
| 场景项目 | 一份能贴进简历的性能报告 + 一次技术方案评审 |
| 离开时应该能 | 面对"为什么不用 X"，给出取舍与代价 |

### 第 5 周：性能优化，从手段到数字

**本周目标**：把长对话做到 1000 条历史下依旧流畅，并产出一份带 before/after 数据的报告。

**为什么是这些内容**

P5 和 P6 在性能题上的差别不是"知不知道虚拟化"，而是**能不能定义指标、能不能归因、能不能证明**。面试官问"你做了什么优化"，答"用了虚拟化"是 P5；答"我把 flush/delta 从 1.0 降到 0.05，commit 次数从 60/s 降到 3/s，输入延迟从 300ms 降到 40ms"才是 P6。

#### 步骤 5.1 虚拟化与流式的冲突

**开发链路**

- **需求拆解**：冲突点是**"高度频繁变化"与"虚拟化要求高度稳定"**。不是"虚拟化不好用"，是两个前提互相打架。
- **数据模型**：虚拟列表只负责历史（高度已定），尾部在虚拟容器之外的正常文档流里。
- **契约**：虚拟项必须带 `data-index` 供 `measureElement` 测量；`stick` 由滚动位置判定，不靠"最后一条变了就滚"。
- **关键实现**：把尾部排除在虚拟区间外。代价是长尾时整页滚动（尾部不计入虚拟高度）；收益是滚动不抖。
- **验证**：1000 条历史滚动 + 同时流式输出，观察是否跳动；上滑后不应被拽回底部。
- **上线**：纯前端；虚拟化库会带来包体积增量，需在报告里写清代价。

:::hint 核心取舍
流式消息的高度每帧都在变。把它塞进虚拟列表，`measureElement` 会反复重算、滚动位置来回跳。
**做法：尾部那一条不进虚拟列表**，放在虚拟容器之后的正常文档流里。历史消息照常虚拟化。
配合：`stick` 标记（用户上滑后停止自动跟随）、`ResizeObserver` 跟随内容增长、`overscan` 留 3–6 屏。
:::

:::solution 参考实现
```tsx
const count = ids.length - 1            // 最后一条不参与虚拟化
const virtualizer = useVirtualizer({
  count,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 160,
  overscan: 6,
})

return (
  <div ref={parentRef} className="scroll" onScroll={onScroll}>
    <div ref={contentRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div key={vi.key} data-index={vi.index} ref={virtualizer.measureElement}
               style={{ position: "absolute", width: "100%", transform: `translateY(${vi.start}px)` }}>
            <MessageRow id={ids[vi.index]} />
          </div>
        ))}
      </div>
      <MessageRow id={ids[ids.length - 1]} />   {/* 尾部：普通文档流 */}
    </div>
  </div>
)
```
:::

:::error 常见报错
- 尾部也虚拟化 → 滚动抖动，用户吐槽"页面在跳"。
- 每次新消息都 `scrollToIndex(last)` → 用户看历史时被强行拽回底部。
- `measureElement` 没加 `data-index` → 高度测量全错，列表塌陷。
:::

#### 步骤 5.2 指标、归因与报告

**开发链路**：这一步是方法论而不是实现，没有技术取舍——指标定义、归因顺序、报告结构照着 hint 走即可。唯一硬要求：数字必须能复现，否则整份报告不成立。

:::hint 该埋哪几个数
| 指标 | 定义 | 为什么重要 |
|---|---|---|
| TTFT | 请求发出 → 第一个 token 渲染 | 体感"快不快"主要看它 |
| tokens/s | 稳态每秒字符数 | 区分"服务慢"还是"渲染慢" |
| flush/delta | 状态写入次数 ÷ 收到增量数 | 判断有没有做合并，理想 < 0.1 |
| commit/s | React 每秒提交次数 | Profiler 直接读 |
| INP | 交互到下一帧 | 输入框卡不卡看它 |

归因顺序：先看 flush/delta（是不是没合并）→ 再看 commit/s（是不是整树重渲染）→ 再看长任务（是不是解析/高亮在主线程）。
:::

:::solution 报告结构（贴进简历的就是这个）
```markdown
## 背景
1000 条历史 + 流式输出时，输入延迟 300ms，滚动掉帧到 30fps。

## 归因
1. flush/delta = 1.0：每个 token 一次 setState
2. commit/s = 60：整棵消息树重渲染
3. 主线程长任务 80ms：Markdown 全量解析

## 措施
1. rAF 合并增量 → flush/delta 0.05
2. 扁平化 store + 按 id 订阅 → 只有尾条重渲染
3. 块级切分 + 尾块单独算 → 解析成本从 O(n²) 降到 O(n)

## 结果
输入延迟 300ms → 40ms；稳态 58fps；首屏 JS +18KB（虚拟化库），可接受。
```
:::

:::error 常见报错
- 只报平均值不报 p95：优化了个寂寞，长尾依旧卡。
- 前后对比不在同一数据集上，数字好看但不可信。
- 把"加了 loading"当成性能优化。
:::

**验收**

- [ ] 一份包含指标定义、归因、措施、结果的报告。
- [ ] 能复现 before/after（切回旧实现即可对比）。
- [ ] 说得出这次优化引入了什么代价（体积、复杂度、维护成本）。

### 第 6 周：差异化能力与对外表达

**本周目标**：按目标岗位二选一做一个差异化模块，并把整条路线包装成"能讲 30 分钟"的项目叙事。

**为什么是这些内容**

前五周打的是通用能力，P6 还需要一个**别人没有的东西**。JD 里明确写了"可视化编排类产品建设（如 Agent 工作流设计器）"，所以画布是性价比最高的选项；如果目标团队偏 C 端 Agent 产品，则把时间投在"断线补齐 + 多端同步"这种稳定性深水区。

#### 步骤 6.1 二选一：编排画布 或 稳定性深水区

**开发链路**：这一步本身是**选项**而不是实现，所以没有统一链路。选画布，取舍在 undo/redo（命令模式省内存 vs 快照实现简单）与坐标变换；选稳定性，取舍在重连策略与去重口径。选定之后，按选中那条的难点再补一份链路。

:::hint 画布的四条主线
1. **坐标**：`screen → flow` 变换（要考虑缩放与容器偏移），拖拽/缩放用同一套矩阵。
2. **撤销重做**：命令模式或 immer patches；**一次拖拽 = 一个事务**，不能每帧一条 undo。
3. **schema 面板**：选中节点 → 右侧表单（复用第 4 周的 SchemaForm），改动写回节点 `data`。
4. **运行态**：节点状态（待执行/运行中/成功/失败）+ 实时日志 + 单步执行；连线做拓扑排序检测环。
:::

:::solution 参考实现：环检测与命令栈
```ts
// 添加一条边之前先判环：从 target 出发能否走回 source
function wouldCycle(edges: Edge[], source: string, target: string): boolean {
  const adj = new Map<string, string[]>()
  for (const e of edges) adj.set(e.source, [...(adj.get(e.source) ?? []), e.target])
  adj.set(source, [...(adj.get(source) ?? []), target])

  const seen = new Set<string>()
  const stack = [target]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === source) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    stack.push(...(adj.get(cur) ?? []))
  }
  return false
}

// 命令模式：do/undo 成对，拖拽结束才 push
type Command = { do(): void; undo(): void }
const history: Command[] = []
```
:::

:::error 常见报错
- 拖拽过程中每帧 push 一条 undo，撤销要点 60 次才回退一步。
- 图数据和节点业务配置混在一个 state，改个标签导致全图重渲染。
- 连线不做环检测，运行时死循环。
:::

#### 步骤 6.2 方案评审文档与面试叙事

**开发链路**：纯表达环节，不改系统。评分点是"有没有说清代价"和"数据能否复现"，按 hint 的六段式写；写不出「决策与代价」那一段，说明前面五周其实没想清楚。

:::hint 评审文档的六段式
背景 → 约束 → 方案对比（至少 2 个）→ 决策与代价 → 风险与兜底 → 验证方式。
**决策与代价**这段是 P6 的核心：任何方案都有代价，说不出来就说明没想清楚。
:::

:::solution 面试叙事模板
```text
背景：C 端 Agent 产品，用户平均会话 40 轮，长会话卡顿投诉集中在第 20 轮之后。
约束：不能改后端协议；包体积预算 +50KB；两周内上线。
方案：A 全量重渲染（现状）／B 只优化 Markdown／C 合并增量 + 扁平化 store + 虚拟化。
决策：选 C。代价是要重写消息 store，风险集中在存量数据迁移。
验证：埋 TTFT / flush-delta / INP 三个指标，灰度 10% 对比一周。
复盘：如果重做，我会先做埋点再动手——这次是凭感觉定位，绕了两天。
```
:::

:::error 常见报错
- 只讲"我做了什么"，不讲"为什么不是另一个"。
- 数据没有口径（"快了很多"），一追问就露馅。
- 把团队成果说成个人成果，被交叉验证时崩盘。
:::

**验收**

- [ ] 一个可演示的差异化模块（画布或稳定性方案）。
- [ ] 一份六段式评审文档。
- [ ] 5 分钟讲完项目，且能扛住连续 4 层追问。

---

## 附录

### 附 A：15 题自测

1. 为什么不用 `EventSource`？它的四个限制分别怎么绕过？
2. 一个 chunk 里出现 `data: 你好` 的后半截字节，怎么处理？
3. 用户点"停止生成"，你要 abort 什么？服务端要不要也停？
4. 流式过程中代码块一直没闭合，UI 怎么办？
5. 重新生成时旧流的 token 还在到达，怎么保证不覆盖新内容？
6. 断线重连怎么"续上"已经生成一半的回复？
7. 多会话并发流式，store 怎么组织？
8. 1000 条消息 + 正在流式输出，虚拟化怎么不抖？
9. 为什么不能每收到一个 token 就 `setState`？
10. 工具调用的参数表单怎么从 JSON Schema 生成？
11. 画布的 undo/redo 怎么实现？连续拖拽算几步？
12. 节点连线的环检测怎么做？
13. 你怎么和 backend 约定流式事件协议？未知事件怎么处理？
14. Markdown 渲染的 XSS 面有哪些？Mermaid 呢？
15. 你的流式链路上线后，用什么指标判断它"好"？

### 附 B：减分项自查

- 只会 `useChat`，说不清 SSE 帧格式与分帧逻辑。
- 把流式请求写在组件 `useEffect` 里，切路由就断。
- 每个 token 全量重解析 Markdown。
- 用 `setTimeout` 拼"打字机效果"，而不是按真实到达节奏渲染。
- 状态用一堆布尔标志，没有 run 状态机。
- 虚拟化套在正在流式的最后一条消息上。
- 事件协议裸传字符串，没有 `seq` / 类型 / 校验。
- 组件库只有样式没有 headless 逻辑，业务方无法扩展 part 类型。

### 附 C：P6 rubric

| 维度 | 不达标 | 达标 | 拔尖 |
|---|---|---|---|
| 流式链路 | 用 SDK，说不清协议 | 能手写解析器并覆盖故障 | 定义了团队可用的事件协议 |
| 渲染 | 全量重解析 | 块级切分 + memo | 有 Worker/调度分层，有数据 |
| 状态 | 单 store 全量订阅 | 扁平化 + 按 id 订阅 | 并发与恢复都可证明 |
| 组件 | 页面里写死 | registry 可扩展 | 被其他业务接入 |
| 表达 | 讲功能 | 讲取舍与数据 | 讲失败与复盘，能指导他人 |
