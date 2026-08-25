"use client"
// 文本工具箱（antd 版）：接口契约与 myapp 一致（POST /api/toolbox）
import { useState } from "react"
import { Button, Input, Card, Space } from "antd"
import { postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

const ACTIONS = [
  { key: "summarize", name: "摘要", icon: "📝" },
  { key: "translate", name: "翻译", icon: "🌐" },
  { key: "rewrite", name: "改写", icon: "✍️" },
  { key: "sentiment", name: "情感分析", icon: "💭" },
]

export default function ToolboxPage() {
  const [text, setText] = useState("")
  const [result, setResult] = useState("")
  const [actionName, setActionName] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(action: string, name: string) {
    if (!text.trim()) { toast.warning("请先输入一段文本"); return }
    setBusy(true); setResult(""); setActionName(name)
    try {
      const j = await postJson("/api/toolbox", { action, text })
      setResult(j.result || "")
    } catch (e: any) {
      setResult("⚠️ " + (e.message || "请求失败"))
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">文本工具箱</h1>
      <p className="text-zinc-600 dark:text-zinc-300 text-sm">同一个模型、同一个接口，靠不同的提示词干不同的活。输入一段文本，点任意按钮试试。</p>
      <Input.TextArea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="在这里输入一段文本..." autoSize={{ minRows: 5, maxRows: 12 }} />
      <Space wrap>
        {ACTIONS.map((a) => (
          <Button key={a.key} type="primary" onClick={() => run(a.key, a.name)} loading={busy}>
            {a.icon} {a.name}
          </Button>
        ))}
      </Space>
      {actionName && (
        <Card size="small" className="shadow-sm" title={<span className="text-indigo-600 dark:text-indigo-300">{busy ? `${actionName} 处理中...` : `${actionName} 结果`}</span>}>
          <div className="text-sm whitespace-pre-wrap break-words min-h-[1.5rem]">{result || (busy ? "…" : "")}</div>
        </Card>
      )}
    </div>
  )
}
