"use client"
import { useEffect, useRef, useState } from "react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { X } from "lucide-react"
import { confirmDialog } from "@/components/ui/confirm"
import Select from "@/components/ui/select"
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

  async function deleteConv(id: number) {
    const ok = await confirmDialog({ title: "删除对话", message: "删除后该对话及其消息不可恢复，确定删除？", confirmText: "删除" })
    if (!ok) return
    await api(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {})
    if (currentId === id) { setCurrentId(null); setMessages([]) }
    await loadConvs(false).catch(() => {})
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
        <button onClick={newConv} className="btn-primary">＋ 新对话</button>
        <div className="flex-1 overflow-y-auto card p-2 flex flex-col gap-1">
          {convs.length === 0 && <div className="text-zinc-500 text-sm text-center py-6">暂无对话</div>}
          {convs.map((c) => (
            <div key={c.id} onClick={() => selectConv(c.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${c.id === currentId ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-zinc-600 hover:bg-white/70"}`}>
              <span className="flex-1 truncate">{c.title || "新对话"}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-zinc-600">模型</span>
          <Select value={model} onChange={changeModel} className="w-64" placeholder="选择模型"
            options={models.map((m) => ({ value: m, label: m, icon: "🤖" }))} />
        </div>
        <div className="flex-1 overflow-y-auto card p-4 flex flex-col gap-3">
          {messages.length === 0 && <div className="text-zinc-500 text-sm text-center py-10">开始一段新对话吧</div>}
          {messages.map((m, i) => {
            // 本轮正在生成的 AI 回复：等待期骨架屏 → 流式文本打字机
            const liveAssistant = i === messages.length - 1 && m.role === "assistant" && (busy || typingTail)
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/15" : "bg-white/65 backdrop-blur-md border border-white/70 text-zinc-900 shadow-sm"}`}>
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
        <div className="flex gap-2 mt-3">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="flex-1 input resize-none h-[70px]" />
          <button onClick={send} disabled={busy || !input.trim()}
            className="btn-primary self-stretch">
            {busy ? "回答中" : "发送"}
          </button>
        </div>
      </div>
    </div>
  )
}