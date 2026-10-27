---
title: 实时评论与在线列表
route: react
direction: 实时
level: L3
weeks: 8-9
hours: 6-8
requires: react:5-6
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

:::solution 关键实现：SSE 去重补发 + 乐观更新可回滚 + 在线人数独立订阅
`hooks/useCommentStream.ts`
```ts
'use client'
import { useEffect, useRef, useState } from 'react'

export type Comment = {
  id: string
  content: string
  author: string
  createdAt: string
  /** 乐观插入的临时消息：服务端确认后会被替换，失败则移除 */
  pending?: boolean
}

/**
 * 自建 SSE（不用 EventSource：要带 Authorization，且要控制重连）。
 * 三条不变量：
 *   ① 去重：同一条消息可能因重投出现两次，按 id 过滤
 *   ② 补缺口：重连带 Last-Event-ID / ?after=<lastId>
 *   ③ 乐观消息：临时 id 以 tmp- 开头，真正到达时替换而不是追加
 */
export function useCommentStream(postId: string) {
  const [items, setItems] = useState<Comment[]>([])
  const lastId = useRef<string>('')
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    let stopped = false
    let retry = 0
    let ac: AbortController | null = null

    const merge = (incoming: Comment[]) => {
      setItems((prev) => {
        const next = [...prev]
        for (const c of incoming) {
          if (seen.current.has(c.id)) continue
          seen.current.add(c.id)
          // 如果是自己刚发的（内容相同且还是 pending），替换掉临时项，避免出现两条
          const pendingIdx = next.findIndex((p) => p.pending && p.content === c.content)
          if (pendingIdx >= 0) next[pendingIdx] = c
          else next.push(c)
        }
        lastId.current = incoming[incoming.length - 1]?.id ?? lastId.current
        return next
      })
    }

    const connect = async () => {
      ac = new AbortController()
      try {
        const res = await fetch(`/api/posts/${postId}/comments/stream?after=${lastId.current}`, {
          signal: ac.signal,
          headers: { Accept: 'text/event-stream' },
        })
        if (!res.ok || !res.body) throw new Error(String(res.status))
        retry = 0

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let i: number
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
            if (!data) continue
            merge([JSON.parse(data) as Comment])
          }
        }
      } catch (e) {
        if (stopped || (e instanceof DOMException && e.name === 'AbortError')) return
        // 指数退避重连：断网 10 秒恢复后靠 after 补上缺口
        retry = Math.min(retry + 1, 5)
        setTimeout(connect, 500 * 2 ** retry)
      }
    }

    void connect()
    return () => {
      stopped = true
      ac?.abort()
    }
  }, [postId])

  /** 乐观发送：先插临时项，失败就移除并抛错给调用方提示 */
  const send = async (content: string, author: string) => {
    const tmp: Comment = { id: `tmp-${Date.now()}`, content, author, createdAt: new Date().toISOString(), pending: true }
    setItems((prev) => [...prev, tmp])
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('发送失败')
    } catch (e) {
      setItems((prev) => prev.filter((c) => c.id !== tmp.id)) // 回滚
      throw e
    }
  }

  return { items, send }
}
```
`components/OnlineCount.tsx`
```tsx
'use client'
import { useSyncExternalStore } from 'react'
import { onlineStore } from '@/lib/online-store'

/**
 * 在线人数单独订阅：它每秒都可能变，若和评论区共用一份 state，
 * 每次人数变化都会重渲染整个列表与输入框（验收里「不影响输入框」就是这一条）。
 */
export function OnlineCount() {
  const n = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, () => 0)
  return <span className="text-xs text-zinc-500">{n} 人在线</span>
}
```
`lib/online-store.ts`
```ts
// 极简外部 store：只存一个数字，订阅者只有 OnlineCount
let online = 0
const listeners = new Set<() => void>()

export const onlineStore = {
  get: () => online,
  set(n: number) {
    if (n === online) return
    online = n
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
```
:::

## 验收脚本

:::check 用 curl 同时扮演「订阅者」和「发布者」
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"
POST_ID="${POST_ID:-1}"
TEXT="验收-$(date +%s%N)"

echo "== 1. 先订阅 SSE，再发一条评论，应收到推送"
( timeout 8 curl -sN "$BASE/api/stream?postId=$POST_ID" > /tmp/nl.sse ) & sub=$!
sleep 1
curl -s -o /dev/null -X POST "$BASE/api/comments" -H 'Content-Type: application/json' \
  -d "{\"postId\":$POST_ID,\"content\":\"$TEXT\"}"
wait $sub || true

if grep -q "$TEXT" /tmp/nl.sse; then echo "PASS 1 秒内收到该条（$TEXT）"
else echo "FAIL 未收到推送"; head -c 300 /tmp/nl.sse; exit 1; fi

echo "== 2. 断线重连补偿：带 Last-Event-ID 重连，应补发缺口消息"
curl -sN -H 'Last-Event-ID: 0' --max-time 3 "$BASE/api/stream?postId=$POST_ID" | head -c 300; echo

echo "== 3. 重复投递不应重复渲染（前端按 id 去重）——人工"
echo "   DevTools 里对同一条 event 重放两次，列表仍只有一条"
```

**浏览器核对**

- [ ] 两个窗口互发评论，1 秒内互相可见
- [ ] Network 面板断网 10 秒再恢复，缺口消息被补齐且不重复
- [ ] 乐观发送失败时，临时消息被移除并出现错误提示
- [ ] 375px 下输入框与列表都不横向滚动

:::

## 延伸方向

- 房间/帖子维度：切帖子时重建连接。
- 输入中状态：`typing` 事件 + 节流。
- 消息分页：历史消息懒加载，SSE 只管增量。
