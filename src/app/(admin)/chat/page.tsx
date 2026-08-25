"use client"
// 智能对话（传统管理后台风）：SSE 流式逻辑与契约不变，外壳样式中性 antd 化
import { useEffect, useRef, useState } from "react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { X } from "lucide-react"
import { Button, Card, Input, Modal, Select } from "antd"
import TypingText, { SkeletonText } from "@/components/TypingText"

type Conv = { id: number; title: string; model: string; updated_at: string }
type Msg = { role: string; content: string }

export default function ChatPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState("")
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [typingTail, setTypingTail] = useState(false) // 流结束后打字机仍在收尾的窗口期
  const lastScrollRef = useRef(0)

  // 打字过程中节流跟随滚动
  function handleTypingTick() {
    const now = Date.now()
    if (now - lastScrollRef.current > 250) {
      lastScrollRef.current = now
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }

  async function selectConv(id: number, list?: Conv[]) {
    setCurrentId(id)
    const src = list || convs
    const c = src.find((x) => x.id === id)
    if (c?.model) setModel(c.model)
    try {
      const j = await apiJson(`/api/conversations/${id}/messages`)
      setMessages(j.messages || [])
    } catch { setMessages([]) }
  }

  async function loadConvs(selectFirst = false) {
    const j = await apiJson("/api/conversations")
    const list: Conv[] = j.conversations || []
    setConvs(list)
    if (selectFirst && list.length > 0) await selectConv(list[0].id, list)
  }

  async function newConv() {
    const j = await postJson("/api/conversations", { model: model || "" })
    const nj = await apiJson("/api/conversations")
    const list: Conv[] = nj.conversations || []
    setConvs(list)
    await selectConv(j.id, list)
  }

  function deleteConv(id: number) {
    Modal.confirm({
      title: "删除对话",
      content: "删除后该对话及其消息不可恢复，确定删除？",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        await api(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {})
        if (currentId === id) { setCurrentId(null); setMessages([]) }
        await loadConvs(false).catch(() => {})
      },
    })
  }

  async function changeModel(m: string) {
    setModel(m)
    if (currentId) await postJson(`/api/conversations/${currentId}/model`, { model: m }).catch(() => {})
  }

  useEffect(() => {
    apiJson("/api/models").then((j) => {
      setModels(j.models || [])
      if (j.models?.length) setModel(j.models[0])
    }).catch(() => {})
    loadConvs(true).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  function patchLast(content: string) {
    setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content }; return c })
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    if (!currentId) { toast.warning("请先点「新对话」创建一个会话"); return }
    setInput(""); setBusy(true)
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }])
    setTypingTail(true)
    try {
      const resp = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: currentId, message: text }),
      })
      if (!resp.ok || !resp.body) {
        let err = `HTTP ${resp.status}`
        try { const j = await resp.json(); if (j.error) err = j.error } catch { /* ignore */ }
        patchLast("⚠️ " + err); setBusy(false); return
      }
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = "", acc = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() || ""
        for (const p of parts) {
          const line = p.trim()
          if (!line.startsWith("data:")) continue
          try {
            const j = JSON.parse(line.slice(5).trim())
            if (j.delta) { acc += j.delta; patchLast(acc) }
            else if (j.error) { acc += "\n⚠️ " + j.error; patchLast(acc) }
          } catch { /* 忽略碎片 */ }
        }
      }
    } catch (e: any) {
      patchLast("⚠️ " + (e.message || "请求失败"))
    }
    setBusy(false)
    loadConvs(false).catch(() => {})
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-6.5rem)]">
      {/* 会话列表 */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <Button type="primary" block onClick={newConv}>＋ 新对话</Button>
        <Card size="small" className="flex-1 overflow-y-auto" styles={{ body: { padding: 8 } }}>
          {convs.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-6">暂无对话</div>}
          <div className="flex flex-col gap-0.5">
            {convs.map((c) => (
              <div key={c.id} onClick={() => selectConv(c.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${c.id === currentId ? "bg-indigo-50 text-indigo-600 font-medium dark:bg-indigo-500/15 dark:text-indigo-300" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}>
                <span className="flex-1 truncate">{c.title || "新对话"}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">模型</span>
          <Select value={model || undefined} onChange={changeModel} style={{ width: 280 }} placeholder="选择模型"
            options={models.map((m) => ({ value: m, label: `🤖 ${m}` }))} />
        </div>
        <Card size="small" className="flex-1 overflow-y-auto" styles={{ body: { padding: 16 } }}>
          <div className="flex flex-col gap-3">
            {messages.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-10">开始一段新对话吧</div>}
            {messages.map((m, i) => {
              // 本轮正在生成的 AI 回复：等待期骨架屏 → 流式文本打字机
              const liveAssistant = i === messages.length - 1 && m.role === "assistant" && (busy || typingTail)
              return (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "bg-indigo-500 text-white" : "bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100"}`}>
                    {m.role === "user"
                      ? m.content
                      : liveAssistant
                        ? (!m.content
                            ? <SkeletonText lines={3} />
                            : <TypingText text={m.content} done={!busy} onFinished={() => setTypingTail(false)} onTick={handleTypingTick} />)
                        : m.content}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        </Card>
        <div className="flex gap-2 mt-3">
          <Input.TextArea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="flex-1 resize-none" rows={3} />
          <Button type="primary" className="self-stretch !h-auto" onClick={send} loading={busy} disabled={!input.trim()}>
            {busy ? "回答中" : "发送"}
          </Button>
        </div>
      </div>
    </div>
  )
}
