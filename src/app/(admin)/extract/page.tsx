"use client"
// 结构化抽取（antd 版）：接口契约与 myapp 一致（POST /api/extract）
import { useState } from "react"
import { Button, Input, Card } from "antd"
import { postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

export default function ExtractPage() {
  const [text, setText] = useState("")
  const [fields, setFields] = useState("")
  const [result, setResult] = useState<any>(null)
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  async function run() {
    if (!text.trim() || !fields.trim()) { toast.warning("请填写文本和目标字段"); return }
    setBusy(true); setResult(null); setRaw(""); setTried(true)
    try {
      const j = await postJson("/api/extract", { text, fields })
      setResult(j.result)
      setRaw(j.raw || "")
    } catch (e: any) {
      setRaw("⚠️ " + (e.message || "请求失败"))
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">结构化抽取</h1>
      <p className="text-zinc-600 dark:text-zinc-300 text-sm">给一段文本和目标字段，AI 按字段抽取出结构化 JSON（演示 JSON 模式 / function calling 思想）。</p>

      <Input.TextArea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="粘贴一段文本，例如：张三，28岁，来自北京，是一名软件工程师，联系方式是 zhangsan@example.com..."
        autoSize={{ minRows: 4, maxRows: 10 }} />
      <Input value={fields} onChange={(e) => setFields(e.target.value)}
        placeholder="目标字段，用逗号分隔，例如：姓名, 年龄, 城市, 职业, 邮箱" />
      <div>
        <Button type="primary" onClick={run} loading={busy}>{busy ? "抽取中..." : "开始抽取"}</Button>
      </div>

      {tried && (
        <Card size="small" className="shadow-sm" title={<span className="text-indigo-600 dark:text-indigo-300">抽取结果（JSON）</span>}>
          <div className="flex flex-col gap-3">
            {result !== null ? (
              <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 text-sm overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
            ) : (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">（未能解析为 JSON，原始输出见下方）</div>
            )}
            {raw && (
              <div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">模型原始输出</div>
                <pre className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-xs whitespace-pre-wrap break-words">{raw}</pre>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
