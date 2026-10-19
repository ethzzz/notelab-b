---
title: 实时评论与在线列表
route: react
direction: 实时
level: L3
weeks: 8-9
tags: SSE, 乐观更新, 重连, 去重
summary: 前端接 SSE 不难，难的是断线补偿、重复消息去重、以及乐观更新失败后的回滚。
---

## 业务背景

评论区要「别人发了我立刻看到」，在线人数要实时变。用轮询体验差；用 SSE 又会遇到：断线后消息缺口、重复投递、自己发的消息回显两次。

## 需求（用户故事）

- 作为访客，别人发的评论我 1 秒内能看到，不用刷新。
- 作为访客，我断网 10 秒恢复后，能看到这期间别人发的评论。
- 作为访客，我自己发的评论立刻出现（乐观），失败时明确提示并撤回。
- 作为访客，在线人数变化不影响我的输入框。

## 接口契约

```text
GET  /api/comments?postId=...         → 初始列表
POST /api/comments                    → {id, content, author}
GET  /api/stream?postId=...           → SSE：{type:"comment", data:{...}}
                                        {type:"online", data:{count}}
```

## 验收标准

- 两个浏览器窗口互发评论，1 秒内互相可见。
- 断网 10 秒再恢复：补齐缺口，且不重复渲染同一条。
- 同一条消息收到两次（SSE 重投）：列表里只有一条。
- 乐观更新失败：出现错误提示，临时消息被移除。
- 375px 下评论输入框与列表不横向滚动。

## 关键决策

:::hint 三个必须处理的边界
1. **去重按消息 id**：SSE 可能重投，React 也要防止重复 `setState` 追加。
2. **重连用 Last-Event-ID**：浏览器 `EventSource` 会自动带上，但服务端要支持回放，否则缺口补不回来。
3. **乐观更新要有回滚**：临时 id 的消息在失败时必须能被精确定位并移除。
:::

## 参考实现

:::solution EventSource + 去重 + 乐观回滚
```tsx
const [list, setList] = useState<Comment[]>([])
const seen = useRef(new Set<string>())

useEffect(() => {
  const es = new EventSource(`/api/stream?postId=${postId}`)
  es.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type !== "comment") return
    const c = msg.data as Comment
    if (seen.current.has(c.id)) return          // 去重
    seen.current.add(c.id)
    setList((prev) => [...prev, c])
  }
  es.onerror = () => { /* 浏览器会按 retry 自动重连，这里只做 UI 提示 */ }
  return () => es.close()
}, [postId])
```
```tsx
async function send(content: string) {
  const temp: Comment = { id: `tmp-${crypto.randomUUID()}`, content, author: me, pending: true }
  setList((prev) => [...prev, temp])
  try {
    const saved = await apiJson<Comment>("/api/comments", { method: "POST", body: JSON.stringify({ content }) })
    setList((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
  } catch (e) {
    setList((prev) => prev.filter((c) => c.id !== temp.id))   // 精确回滚
    message.error("发送失败，请重试")
  }
}
```
:::

## 延伸方向

- 房间/帖子维度：切帖子时重建连接。
- 输入中状态：`typing` 事件 + 节流。
- 消息分页：历史消息懒加载，SSE 只管增量。
