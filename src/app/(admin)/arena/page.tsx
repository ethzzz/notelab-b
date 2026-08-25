"use client"
// 模型竞技场（antd 版）：双路/多路对抗流式，SSE 消费逻辑与 myapp 完全一致
import { useEffect, useState } from "react"
import { Button, Input, Tag, Card, Spin } from "antd"
import { api, apiJson } from "@/lib/api"

// 图像/语音/多模态模型不能走 chat/completions，过滤掉
const NON_CHAT = /image|audio|tts|wan|vl|vision/i

type ArenaResult = { model: string; content?: string; error?: string; loading?: boolean }

export default function ArenaPage() {
  const [models, setModels] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  const [results, setResults] = useState<ArenaResult[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiJson("/api/models").then((j) => {
      const list: string[] = (j.models || []).filter((m: string) => !NON_CHAT.test(m))
      setModels(list)
      const pick: string[] = []
      const seen: string[] = []
      for (const m of list) {
        const vendor = m.split("-")[0]
        if (!seen.includes(vendor)) { seen.push(vendor); pick.push(m) }
        if (pick.length >= 3) break
      }
      setSelected(pick.length ? pick : list.slice(0, 3))
    }).catch(() => {})
  }, [])

  function toggleModel(m: string) {
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function run() {
    if (!prompt.trim() || selected.length === 0 || busy) return
    setBusy(true)
    setResults(selected.map((m) => ({ model: m, loading: true })))
    try {
      const resp = await api("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, models: selected }),
      })
      if (!resp.ok || !resp.body) throw new Error("HTTP " + resp.status)
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
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
            if (j.model) {
              setResults((prev) =>
                (prev || []).map((r) =>
                  r.model === j.model ? { model: j.model, content: j.content, error: j.error } : r
                )
              )
            }
          } catch { /* 忽略碎片 */ }
        }
      }
    } catch (e: any) {
      setResults((prev) => (prev || []).map((r) => (r.loading ? { ...r, error: e.message || "请求失败" } : r)))
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">模型竞技场</h1>
      <p className="text-zinc-600 dark:text-zinc-300 text-sm">同一个问题并行发给多个模型，谁先答完谁先显示，直观对比不同模型。</p>

      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入一个问题，让多个模型并行回答，例如：用一句话解释什么是递归"
            autoSize={{ minRows: 3, maxRows: 8 }}
          />
          <div className="flex flex-wrap gap-1.5">
            {models.map((m) => (
              <Tag.CheckableTag key={m} checked={selected.includes(m)} onChange={() => toggleModel(m)}
                className="!border !rounded-full !px-3 !py-1 !text-xs border-zinc-300/70 dark:border-zinc-600">
                {m}
              </Tag.CheckableTag>
            ))}
          </div>
          <div>
            <Button type="primary" onClick={run} loading={busy} disabled={!prompt.trim() || selected.length === 0}>
              {busy ? "对比中..." : `开始对比（${selected.length} 个模型）`}
            </Button>
          </div>
        </div>
      </Card>

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((r, i) => (
            <Card key={i} size="small" className="shadow-sm"
              title={<span className="font-semibold text-sm">{r.model}</span>}
              extra={
                r.loading ? <span className="text-xs text-zinc-400 dark:text-zinc-500 inline-flex items-center gap-1.5"><Spin size="small" />思考中</span>
                : r.error ? <Tag color="error">失败</Tag>
                : <Tag color="success">完成</Tag>
              }>
              {r.loading ? (
                <div className="text-sm text-zinc-400 dark:text-zinc-500">等待模型响应...</div>
              ) : r.error ? (
                <div className="text-sm text-red-500 whitespace-pre-wrap break-words">{r.error}</div>
              ) : (
                <div className="text-sm whitespace-pre-wrap break-words">{r.content}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
