"use client"
// 文档面板（笔记 / PRD 共用）：Markdown 列表 / 查看 / 编辑 / 下载 / 删除
//
// 为什么做成「一个组件 + type 参数」而不是复制一份页面：
// 笔记与 PRD 在数据上就是同一套（notes 表、content_md 字段、同一个 /api/notes 接口，
// 只靠 doc_type 区分），复制会让两边的功能慢慢长歪（一边加了导出、另一边忘了）。
// 差异只有文案与图标，收敛在下面的 PANEL 表里。
//
// 接口契约以 NoteController 为准：每个入口都带 type，跨类型读写会被后端判 404。
import { useCallback, useEffect, useState } from "react"
import { Card, Table, Button, Input, Space, Popconfirm } from "antd"
import { Plus, ArrowLeft, Save, Eye, PenLine, Trash2, NotebookPen, Download, FileText } from "lucide-react"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
// MdEditor 默认导出已是「仅客户端 + 懒加载」，页面不用再自己 dynamic 包装（见 components/md-editor.tsx）
import MdEditor, { MdPreview } from "@/components/md-editor"

/** 文档类型：与后端 com.notelab.model.NoteType 的白名单一致 */
export type DocType = "note" | "prd"

/** 两种类型的**全部**差异：文案 + 图标。新增类型只改这里与后端白名单 */
const PANEL = {
  note: {
    title: "笔记",
    icon: NotebookPen,
    entity: "笔记",
    newTitle: "未命名笔记",
    empty: "还没有笔记，点右上角「新建笔记」开始",
    placeholder: "笔记标题",
    tip: "提示：支持 GFM（表格 / 任务列表 / 删除线）；Tab 插入缩进；保存后可在列表查看渲染效果。",
  },
  prd: {
    title: "PRD 管理",
    icon: FileText,
    entity: "PRD",
    newTitle: "未命名 PRD",
    empty: "还没有 PRD，点右上角「新建 PRD」开始",
    placeholder: "PRD 标题（建议带编号，如 PRD-P9-xxx）",
    tip: "提示：支持 GFM（表格 / 任务列表 / 删除线）；PRD 与笔记同一套存储，只是分类不同；保存后可在列表查看渲染效果。",
  },
} as const

type NoteMeta = {
  id: number; doc_type: DocType; title: string; size_bytes: number
  created_by: number | null; created_at: string; updated_at: string
}
type NoteDetail = NoteMeta & { content_md: string }
type Draft = { id: number | null; title: string; md: string }
type View = { id: number; title: string; md: string; updated_at: string }

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** 文件名清洗：去掉系统禁用的非法字符，过长截断 */
function safeFileName(name: string): string {
  const s = (name || "note").trim().replace(/[\\/:*?"<>|]/g, "_")
  return s.slice(0, 80) || "note"
}

/** 下载一个服务端文件：用隐藏 <a> 触发原生下载（携带会话 cookie，服务端返回 Content-Disposition: attachment） */
function downloadViaAnchor(url: string) {
  const a = document.createElement("a")
  a.href = url
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 导出客户端内容（草稿/当前编辑器）：提交隐藏表单到 /api/notes/export，由服务端回显为 .md 附件，避免 blob: 触发 Chrome 不安全下载拦截 */
function downloadViaForm(filename: string, contentMd: string) {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = "/api/notes/export"
  form.style.display = "none"
  const add = (k: string, v: string) => {
    const i = document.createElement("input")
    i.type = "hidden"
    i.name = k
    i.value = v
    form.appendChild(i)
  }
  add("filename", filename)
  add("content_md", contentMd || "")
  document.body.appendChild(form)
  form.submit()
  setTimeout(() => form.remove(), 1000)
}

export default function NotesPanel({ type = "note" }: { type?: DocType }) {
  const cfg = PANEL[type]
  const Icon = cfg.icon
  /** 类型参数统一从这里拼，避免某个入口漏传 type 导致跨类型读写 */
  const tq = `type=${type}`

  // ------- 列表态 -------
  const [items, setItems] = useState<NoteMeta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)

  // ------- 编辑态 / 查看态（互斥，均为 null 时显示列表） -------
  const [draft, setDraft] = useState<Draft | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback((p: number, s: number, kw: string) => {
    setLoading(true)
    const params = new URLSearchParams({ type, limit: String(s), offset: String((p - 1) * s) })
    if (kw.trim()) params.set("q", kw.trim())
    apiJson(`/api/notes?${params.toString()}`)
      .then((j) => { setItems(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || `加载${cfg.entity}失败`))
      .finally(() => setLoading(false))
  }, [type, cfg.entity])

  useEffect(() => { fetchData(page, pageSize, q) }, [page, pageSize, q, fetchData])

  async function openView(id: number) {
    try {
      const d: NoteDetail = await apiJson(`/api/notes/${id}?${tq}`)
      setView({ id: d.id, title: d.title, md: d.content_md || "", updated_at: d.updated_at })
    } catch (e: any) { toast.error(e.message || `打开${cfg.entity}失败`) }
  }

  async function openEdit(id: number) {
    try {
      const d: NoteDetail = await apiJson(`/api/notes/${id}?${tq}`)
      setView(null)
      setDraft({ id: d.id, title: d.title, md: d.content_md || "" })
    } catch (e: any) { toast.error(e.message || `打开${cfg.entity}失败`) }
  }

  function newNote() {
    setView(null)
    setDraft({ id: null, title: cfg.newTitle, md: "" })
  }

  async function save() {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) { toast.warning("标题不能为空"); return }
    setSaving(true)
    try {
      if (draft.id == null) {
        const j = await postJson("/api/notes", { title, content_md: draft.md, type })
        setDraft({ ...draft, id: j.id })
        toast.success(`${cfg.entity}已保存`)
      } else {
        await apiJson(`/api/notes/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content_md: draft.md, type }),
        })
        toast.success(`${cfg.entity}已更新`)
      }
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    try {
      await apiJson(`/api/notes/${id}?${tq}`, { method: "DELETE" })
      toast.success(`${cfg.entity}已删除`)
      fetchData(page, pageSize, q)
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  function backToList() {
    setDraft(null)
    setView(null)
    fetchData(page, pageSize, q)
  }

  /** 单篇下载：直接走服务端导出端点（/api/notes/{id}/export），原生下载 */
  function downloadNote(id: number) {
    downloadViaAnchor(`/api/notes/${id}/export?${tq}`)
  }

  /** 下载全部：走服务端合并导出端点（/api/notes/export-all?type=&q=），服务端拼装 */
  function downloadAll() {
    const qs = new URLSearchParams({ type })
    if (q.trim()) qs.set("q", q.trim())
    downloadViaAnchor(`/api/notes/export-all?${qs.toString()}`)
  }

  /** 编辑态直接下载草稿（客户端内容 → 服务端回显） */
  function downloadDraft() {
    if (!draft) return
    downloadViaForm(safeFileName(draft.title || cfg.newTitle), draft.md)
  }

  const columns = [
    {
      title: "标题", dataIndex: "title", key: "title",
      render: (t: string, r: NoteMeta) => (
        <button onClick={() => openView(r.id)} className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline">
          <Icon size={14} /> {t}
        </button>
      ),
    },
    { title: "大小", dataIndex: "size_bytes", key: "size_bytes", width: 110, render: fmtSize },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", width: 170 },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", width: 170 },
    {
      title: "操作", key: "op", width: 320,
      render: (_: any, r: NoteMeta) => (
        <Space>
          <Button size="small" icon={<Eye size={13} />} onClick={() => openView(r.id)}>查看</Button>
          <Button size="small" icon={<PenLine size={13} />} onClick={() => openEdit(r.id)}>编辑</Button>
          <Button size="small" icon={<Download size={13} />} onClick={() => downloadNote(r.id)}>下载</Button>
          <Popconfirm title="删除后不可恢复，确定删除？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
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
              placeholder={cfg.placeholder}
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<Download size={14} />} onClick={downloadDraft}>下载</Button>

            <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save}>保存</Button>
          </Space>
        }
      >
        <MdEditor
          value={draft.md}
          onChange={(md) => setDraft({ ...draft, md })}
          /* 吃掉剩余高度。300px = 顶栏 + 标题/操作栏 + 卡片内边距 + 下方提示行的合计；
             `max(420px, …)` 兜住小窗口，免得窄屏下压到只剩一条缝。
             用 calc 而不是 JS 量算：窗口缩放、字体加载、提示行换行都不用重算。 */
          height="max(420px, calc(100vh - 300px))"
        />
        <div className="mt-2 text-xs text-zinc-400">{cfg.tip}</div>
      </Card>
    )
  }

  // ---------------- 查看视图 ----------------
  if (view) {
    return (
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={backToList}>返回列表</Button>
            <span className="inline-flex items-center gap-2 text-base font-semibold">
              <Icon size={16} /> {view.title}
            </span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<Download size={14} />} onClick={() => downloadViaAnchor(`/api/notes/${view.id}/export?${tq}`)}>下载</Button>
            <Button type="primary" icon={<PenLine size={14} />} onClick={() => openEdit(view.id)}>编辑</Button>
          </Space>
        }
      >
        <MdPreview value={view.md} />
        <div className="mt-3 text-xs text-zinc-400">更新于 {view.updated_at}</div>
      </Card>
    )
  }

  // ---------------- 列表视图 ----------------
  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><Icon size={17} /> {cfg.title}</span>}
      extra={
        <Space>
          <Input.Search placeholder="搜索标题" allowClear onSearch={(v) => { setPage(1); setQ(v) }} style={{ width: 200 }} />
          <Button icon={<Download size={14} />} onClick={downloadAll}>下载全部</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={newNote}>新建{cfg.entity}</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          onChange: (p, s) => { setPage(p); setPageSize(s) },
        }}
        locale={{ emptyText: cfg.empty }}
      />
    </Card>
  )
}
