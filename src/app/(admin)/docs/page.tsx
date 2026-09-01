"use client"
// 文档编辑：.docx 导入（服务端 POI 解析为 HTML）/ 新建 / 富文本编辑 / 保存 / 导出 docx
// 接口契约以 DocController 为准（/api/docs）
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, Table, Button, Input, Space, Popconfirm, Spin } from "antd"
import { Plus, Upload, ArrowLeft, Save, Download, FileText, PenLine, Trash2 } from "lucide-react"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { htmlToDocxBlob, downloadBlob, safeFileName } from "@/lib/export-docx"
import type { DocEditorHandle } from "@/components/doc-editor"

// Quill 依赖浏览器环境，动态加载避免 SSR
const DocEditor = dynamic(() => import("@/components/doc-editor"), { ssr: false })

type DocMeta = {
  id: number; title: string; size_bytes: number
  created_by: number | null; created_at: string; updated_at: string
}
type DocDetail = DocMeta & { content_html: string }
type Draft = { id: number | null; title: string; html: string }

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export default function DocsPage() {
  // ------- 列表态 -------
  const [items, setItems] = useState<DocMeta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  // ------- 编辑态（draft 非 null 即编辑视图） -------
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editorHtml, setEditorHtml] = useState("")
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<DocEditorHandle>(null)

  const fetchData = useCallback((p: number, s: number, kw: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(s), offset: String((p - 1) * s) })
    if (kw.trim()) params.set("q", kw.trim())
    apiJson(`/api/docs?${params.toString()}`)
      .then((j) => { setItems(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || "加载文档失败"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData(page, pageSize, q) }, [page, pageSize, q, fetchData])

  async function openDoc(id: number) {
    try {
      const d: DocDetail = await apiJson(`/api/docs/${id}`)
      setDraft({ id: d.id, title: d.title, html: "" })
      setEditorHtml(d.content_html || "")
    } catch (e: any) { toast.error(e.message || "打开文档失败") }
  }

  function newDoc() {
    setDraft({ id: null, title: "未命名文档", html: "" })
    setEditorHtml("")
  }

  async function removeDoc(id: number) {
    try {
      await apiJson(`/api/docs/${id}`, { method: "DELETE" })
      toast.success("文档已删除")
      fetchData(page, pageSize, q)
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  // 导入 .docx：读为 base64 → 服务端解析为 HTML → 进编辑器（不落库，保存时才入库）
  async function onImportFile(f: File) {
    if (f.size > 5 * 1024 * 1024) { toast.error("文档超过 5MB 上限"); return }
    setImporting(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result).split(",")[1] || "")
        fr.onerror = () => reject(new Error("文件读取失败"))
        fr.readAsDataURL(f)
      })
      const j = await postJson("/api/docs/import", { name: f.name, data })
      setDraft({ id: null, title: j.title || "未命名文档", html: "" })
      setEditorHtml(j.html || "")
      toast.success("导入成功，复杂排版（页眉/图片等）已简化，请检查后保存")
    } catch (e: any) {
      toast.error(e.message || "导入失败")
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function save() {
    if (!draft) return
    const html = editorRef.current?.getHtml() ?? editorHtml
    const title = draft.title.trim()
    if (!title) { toast.warning("标题不能为空"); return }
    setSaving(true)
    try {
      if (draft.id == null) {
        const j = await postJson("/api/docs", { title, content_html: html })
        setDraft({ ...draft, id: j.id })
        toast.success("文档已保存")
      } else {
        await apiJson(`/api/docs/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content_html: html }),
        })
        toast.success("文档已更新")
      }
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function exportDocx() {
    const root = editorRef.current?.getEditorRoot()
    if (!root) { toast.warning("编辑器未就绪"); return }
    try {
      const blob = await htmlToDocxBlob(root)
      downloadBlob(blob, `${safeFileName(draft?.title)}.docx`)
      toast.success("导出成功")
    } catch (e: any) {
      toast.error(e.message || "导出失败")
    }
  }

  function backToList() {
    setDraft(null)
    setEditorHtml("")
    fetchData(page, pageSize, q)
  }

  const columns = [
    {
      title: "标题", dataIndex: "title", key: "title",
      render: (t: string, r: DocMeta) => (
        <button onClick={() => openDoc(r.id)} className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline">
          <FileText size={14} /> {t}
        </button>
      ),
    },
    { title: "大小", dataIndex: "size_bytes", key: "size_bytes", width: 110, render: fmtSize },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", width: 170 },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", width: 170 },
    {
      title: "操作", key: "op", width: 180,
      render: (_: any, r: DocMeta) => (
        <Space>
          <Button size="small" icon={<PenLine size={13} />} onClick={() => openDoc(r.id)}>编辑</Button>
          <Popconfirm title="删除后不可恢复，确定删除？" onConfirm={() => removeDoc(r.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<Trash2 size={13} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ---------------- 编辑视图 ----------------
  if (draft) {
    return (
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={backToList}>返回列表</Button>
            <Input
              value={draft.title} maxLength={200} style={{ width: 320 }}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="文档标题"
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<Download size={14} />} onClick={exportDocx}>导出 docx</Button>
            <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save}>保存</Button>
          </Space>
        }
      >
        <style>{`.doc-quill .ql-container{min-height:420px;font-size:14px;background:#fff}`}</style>
        <DocEditor ref={editorRef} value={editorHtml} onChange={(h) => setEditorHtml(h)} />
        <div className="mt-2 text-xs text-zinc-400">
          提示：导入的 .docx 会简化页眉页脚/图片等复杂排版；导出为 docx 时图片以 [图片] 占位。
        </div>
      </Card>
    )
  }

  // ---------------- 列表视图 ----------------
  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><FileText size={17} /> 文档编辑</span>}
      extra={
        <Space>
          <Input.Search placeholder="搜索标题" allowClear onSearch={(v) => { setPage(1); setQ(v) }} style={{ width: 200 }} />
          <Button icon={<Upload size={14} />} loading={importing} onClick={() => fileRef.current?.click()}>
            导入 docx
          </Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={newDoc}>新建文档</Button>
          <input
            ref={fileRef} type="file" accept=".docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f) }}
          />
        </Space>
      }
    >
      {importing && <div className="mb-2"><Spin size="small" /> 正在解析文档…</div>}
      <Table
        rowKey="id" size="middle" loading={loading} columns={columns as any} dataSource={items}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, s) => { setPage(p); setPageSize(s) },
        }}
      />
    </Card>
  )
}
