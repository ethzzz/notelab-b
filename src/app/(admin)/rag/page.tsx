"use client"
// 文档问答 RAG（antd 版）：接口契约与 myapp 一致（/api/rag/upload|docs|ask，JSON 上传）
import { useEffect, useState } from "react"
import { Button, Input, Card, Upload, Tag, Empty } from "antd"
import { FileTextOutlined, InboxOutlined } from "@ant-design/icons"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

export default function RagPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [citations, setCitations] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function loadDocs() {
    const j = await apiJson("/api/rag/docs")
    setDocs(j.docs || [])
  }
  useEffect(() => { loadDocs().catch(() => {}) }, [])

  /** 选择本地 .txt/.md：读入文本并带出标题（与 myapp 行为一致） */
  function beforeUpload(f: File) {
    const reader = new FileReader()
    reader.onload = () => {
      setContent(String(reader.result || ""))
      if (!name) setName(f.name.replace(/\.[^.]+$/, ""))
    }
    reader.readAsText(f)
    return false // 阻止 antd 自动上传
  }

  async function upload() {
    if (!name.trim() || !content.trim()) { toast.warning("请填写标题和内容（或选择文件）"); return }
    setUploading(true)
    try {
      await postJson("/api/rag/upload", { name, content })
      setName(""); setContent("")
      await loadDocs()
      toast.success("文档已上传并切片")
    } catch (e: any) { toast.error(e.message || "上传失败") }
    setUploading(false)
  }

  async function ask() {
    if (!question.trim()) return
    setBusy(true); setAnswer(""); setCitations([])
    try {
      const j = await postJson("/api/rag/ask", { question })
      setAnswer(j.answer || "")
      setCitations(j.citations || [])
    } catch (e: any) { setAnswer("⚠️ " + (e.message || "请求失败")) }
    setBusy(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 左：上传与文档 */}
      <div className="lg:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl font-bold">文档问答 RAG</h1>
        <p className="text-zinc-600 text-sm">上传文档后提问，AI 依据文档作答并标注引用；文档里没有的会如实说明。</p>
        <Card size="small" className="shadow-sm" title="① 上传文档（.txt / 粘贴文本）">
          <div className="flex flex-col gap-3">
            <Upload.Dragger accept=".txt,.md" showUploadList={false} beforeUpload={beforeUpload} className="!bg-transparent">
              <p className="ant-upload-drag-icon"><InboxOutlined className="!text-indigo-400" /></p>
              <p className="ant-upload-text !text-sm">点击或拖拽 .txt / .md 文件到此处</p>
            </Upload.Dragger>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="文档标题" />
            <Input.TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="文档内容..."
              autoSize={{ minRows: 4, maxRows: 10 }} />
            <Button type="primary" onClick={upload} loading={uploading}>
              {uploading ? "上传中..." : "上传并切片"}
            </Button>
          </div>
        </Card>
        <Card size="small" className="shadow-sm" title="已上传文档">
          {docs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文档" /> : (
            <div className="flex flex-col gap-2">
              {docs.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-200/70">
                  <span><FileTextOutlined className="mr-1.5 text-indigo-500" />{d.name}</span>
                  <Tag>{d.chunks} 个切片</Tag>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 右：提问与回答 */}
      <div className="lg:w-1/2 flex flex-col gap-4">
        <Card size="small" className="shadow-sm" title="② 提问">
          <div className="flex flex-col gap-3">
            <Input.TextArea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例如：这份文档讲了什么？"
              autoSize={{ minRows: 2, maxRows: 6 }} />
            <Button type="primary" onClick={ask} loading={busy} disabled={!question.trim()}>
              {busy ? "思考中..." : "提问"}
            </Button>
          </div>
        </Card>
        {(answer || citations.length > 0) && (
          <Card size="small" className="shadow-sm" title={<span className="text-indigo-600">回答</span>}>
            <div className="flex flex-col gap-3">
              <div className="text-sm whitespace-pre-wrap break-words">{answer}</div>
              {citations.length > 0 && (
                <div className="border-t border-zinc-100 pt-3">
                  <div className="font-semibold text-sm mb-2">引用（检索到的片段）</div>
                  <div className="flex flex-col gap-2">
                    {citations.map((c, i) => (
                      <div key={i} className="bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-200/70 text-xs text-zinc-600">
                        <span className="text-indigo-600 font-medium">[{i + 1}] {c.doc}</span>
                        <div className="mt-1 whitespace-pre-wrap">{c.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
