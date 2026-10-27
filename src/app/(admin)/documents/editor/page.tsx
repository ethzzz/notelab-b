"use client"
// 文档编辑：DOCX 原生编辑（SuperDoc）。新建走空白 A4 模板，导入直接把本地 docx 交给编辑器，
// 正文以 .docx 字节存 documents 表；PDF 走浏览器打印（分页与屏幕一致）。
// 接口契约以 DocController 为准（/api/docs）。
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, Table, Button, Input, Space, Popconfirm, Spin, Tag } from "antd"
import { Plus, Upload, ArrowLeft, Save, Download, FileText, FileDown, PenLine, Printer, Trash2 } from "lucide-react"
import { apiJson, postJson, BASE_PATH } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { DocxEditorHandle } from "@/components/docx-editor"

// SuperDoc 依赖浏览器环境，动态加载避免 SSR
const DocxEditor = dynamic(() => import("@/components/docx-editor"), { ssr: false })

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MAX_DOC_BYTES = 10 * 1024 * 1024

type DocMeta = {
  id: number; title: string; size_bytes: number
  created_by: number | null; created_at: string; updated_at: string
}
type DocDetail = DocMeta & { docx_base64: string }
type Draft = { id: number | null; title: string }
type LoadState = "idle" | "loading" | "ready"

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function base64ToBlob(b64: string, type = DOCX_MIME): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "")
    fr.onerror = () => reject(new Error("读取文档失败"))
    fr.readAsDataURL(blob)
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeFileName(title: string): string {
  return (title.trim() || "未命名文档").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120)
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

  // ------- 编辑态（draft 非 null 即编辑视图） -------
  const [draft, setDraft] = useState<Draft | null>(null)
  const [file, setFile] = useState<Blob | null>(null)
  const [docKey, setDocKey] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<DocxEditorHandle>(null)

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

  function mountDraft(next: Draft, docx: Blob) {
    setDraft(next)
    setFile(docx)
    setDocKey((k) => k + 1)
    setLoadState("loading")
  }

  async function openDoc(id: number) {
    try {
      const d: DocDetail = await apiJson(`/api/docs/${id}`)
      mountDraft({ id: d.id, title: d.title }, base64ToBlob(d.docx_base64))
    } catch (e: any) { toast.error(e.message || "打开文档失败") }
  }

  async function newDoc() {
    try {
      const res = await fetch(`${BASE_PATH}/templates/blank.docx`)
      if (!res.ok) throw new Error("空白模板加载失败")
      mountDraft({ id: null, title: "未命名文档" }, await res.blob())
    } catch (e: any) { toast.error(e.message || "新建失败") }
  }

  async function removeDoc(id: number) {
    try {
      await apiJson(`/api/docs/${id}`, { method: "DELETE" })
      toast.success("文档已删除")
      fetchData(page, pageSize, q)
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  // 导入：本地 docx 直接交给编辑器（不经服务端解析），点保存才入库
  function onImportFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".docx")) { toast.error("只支持 .docx 文件"); return }
    if (f.size > MAX_DOC_BYTES) { toast.error("文档超过 10MB 上限"); return }
    mountDraft({ id: null, title: safeFileName(f.name.replace(/\.docx$/i, "")) }, f)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function exportBlob(): Promise<Blob> {
    if (!editorRef.current) throw new Error("编辑器尚未就绪")
    return editorRef.current.exportDocx(safeFileName(draft?.title || "未命名文档"))
  }

  async function save() {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) { toast.warning("标题不能为空"); return }
    if (loadState !== "ready") { toast.warning("编辑器还在加载"); return }
    setSaving(true)
    try {
      const docx = await exportBlob()
      const docx_base64 = await blobToBase64(docx)
      if (draft.id == null) {
        const j = await postJson("/api/docs", { title, docx_base64 })
        setDraft({ ...draft, id: j.id })
        toast.success("文档已保存")
      } else {
        await apiJson(`/api/docs/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, docx_base64 }),
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
    if (!draft) return
    try {
      downloadBlob(await exportBlob(), `${safeFileName(draft.title)}.docx`)
      toast.success("已导出 DOCX")
    } catch (e: any) { toast.error(e.message || "导出失败") }
  }

  function backToList() {
    setDraft(null)
    setFile(null)
    setLoadState("idle")
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
      title: "操作", key: "op", width: 250,
      render: (_: any, r: DocMeta) => (
        <Space>
          <Button size="small" icon={<PenLine size={13} />} onClick={() => openDoc(r.id)}>编辑</Button>
          <Button size="small" icon={<Download size={13} />} href={`/api/docs/${r.id}/download`}>下载</Button>
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
      <>
        <style>{`
          @page { size: A4; margin: 0; }
          /* 必须写在 @layer base：Tailwind v4 把 !important 工具类放在 utilities 层，
             无层级的 !important 优先级最低，压不住 main 的 padding 与 layout 的 margin-left */
          @layer base {
            @media print {
              html, body { margin: 0 !important; padding: 0 !important; height: auto !important; background: #fff !important; }
              body * { visibility: hidden !important; }
              .docx-print-root, .docx-print-root * { visibility: visible !important; }
              /* 外壳与卡片头彻底退出打印（antd Tag 自带 visibility:visible，光靠 visibility 藏不住） */
              .ant-layout-sider, .ant-layout-header, .ant-drawer, .ant-card-head { display: none !important; }
              /* 隐藏节点仍占文档流：把祖先链上不通往打印根的兄弟全部移出布局 */
              body *:has(.docx-print-root) > *:not(.docx-print-root):not(:has(.docx-print-root)):not(style) {
                display: none !important;
              }
              /* 祖先的定位/内边距/最小高度会把打印根的分页起点往下推，打印时整条祖先链压平 */
              body *:has(.docx-print-root) {
                position: static !important; overflow: visible !important;
                margin: 0 !important; padding: 0 !important; border: 0 !important;
                height: auto !important; min-height: 0 !important;
              }
              /* SuperDoc 编辑态容器带固定高度 + overflow:auto，会把第二页裁掉 */
              .docx-print-root, .docx-print-root > *, .superdoc-wrapper, .superdoc-editor-container,
              .superdoc, .superdoc__layers, .superdoc__document, .superdoc__sub-document,
              .v2-super-editor, .v2-super-editor__visuals, .v2-super-editor__stage, .superdoc-layout {
                height: auto !important; max-height: none !important; overflow: visible !important;
              }
              .docx-print-root {
                position: static !important; width: 100% !important; background: #fff !important;
              }
              .docx-print-root .superdoc-toolbar,
              .docx-print-root [role="toolbar"] { display: none !important; }
              /* 屏幕上的页间留白（24px gap）在打印里会累计成空白页 */
              .docx-print-root .superdoc-layout { gap: 0 !important; }
              /* SuperDoc 给每张纸都写了 break-after:page；末页之后那次强制分页就是多出来的空白页。
                 改为：非末页强制换页（每张纸正好一页），末页自然结束 */
              .docx-print-root .superdoc-page {
                break-before: auto !important; break-after: auto !important;
                break-inside: avoid !important; zoom: 1 !important; margin: 0 !important;
              }
              .docx-print-root .superdoc-page:not(:last-of-type) { break-after: page !important; }
            }
          }
        `}</style>
        <Card
          title={
            <Space>
              <Button icon={<ArrowLeft size={14} />} onClick={backToList}>返回列表</Button>
              <Input
                value={draft.title} maxLength={200} style={{ width: 320 }}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="文档标题"
              />
              {draft.id == null ? <Tag color="blue">未保存</Tag> : null}
            </Space>
          }
          extra={
            <Space>
              <Button icon={<FileDown size={14} />} onClick={exportDocx} disabled={loadState !== "ready"}>导出 docx</Button>
              <Button icon={<Printer size={14} />} onClick={() => window.print()} disabled={loadState !== "ready"}>导出 PDF</Button>
              <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save} disabled={loadState !== "ready"}>保存</Button>
            </Space>
          }
        >
          <div className="docx-print-root" style={{ position: "relative" }}>
            {file ? (
              <DocxEditor
                key={docKey}
                ref={editorRef}
                file={file}
                onReady={() => setLoadState("ready")}
                onError={(m) => { setLoadState("idle"); toast.error(m) }}
              />
            ) : null}
            {loadState === "loading" ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <Spin tip="正在加载文档…" />
              </div>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            提示：DOCX 版式（分页/页眉页脚/表格/图片）按原文件呈现；「导出 PDF」走浏览器打印，请在打印对话框选择「另存为 PDF」。
          </div>
        </Card>
      </>
    )
  }

  // ---------------- 列表视图 ----------------
  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><FileText size={17} /> 文档编辑</span>}
      extra={
        <Space>
          <Input.Search allowClear placeholder="搜索标题" style={{ width: 220 }} onSearch={(v) => { setQ(v); setPage(1) }} />
          <input ref={fileRef} type="file" accept=".docx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f) }} />
          <Button icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>导入 docx</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={newDoc}>新建文档</Button>
        </Space>
      }
    >
      <Table<DocMeta>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 篇`,
          onChange: (p, s) => { setPage(p); setPageSize(s) },
        }}
      />
    </Card>
  )
}
