"use client"
// 笔记页（Notion 式）：Markdown 保存 / 列表 / 编辑 / 查看
// 接口契约以 NoteController 为准（/api/notes）；渲染用 md-editor 的 marked+DOMPurify
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Card, Table, Button, Input, Space, Popconfirm } from "antd"
import { Plus, ArrowLeft, Save, Eye, PenLine, Trash2, NotebookPen } from "lucide-react"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { MdPreview } from "@/components/md-editor"

// 编辑器含 textarea/预览分屏，仅客户端加载
const MdEditor = dynamic(() => import("@/components/md-editor"), { ssr: false })

type NoteMeta = {
  id: number; title: string; size_bytes: number
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

export default function NotesPage() {
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
    const params = new URLSearchParams({ limit: String(s), offset: String((p - 1) * s) })
    if (kw.trim()) params.set("q", kw.trim())
    apiJson(`/api/notes?${params.toString()}`)
      .then((j) => { setItems(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || "加载笔记失败"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData(page, pageSize, q) }, [page, pageSize, q, fetchData])

  async function openView(id: number) {
    try {
      const d: NoteDetail = await apiJson(`/api/notes/${id}`)
      setView({ id: d.id, title: d.title, md: d.content_md || "", updated_at: d.updated_at })
    } catch (e: any) { toast.error(e.message || "打开笔记失败") }
  }

  async function openEdit(id: number) {
    try {
      const d: NoteDetail = await apiJson(`/api/notes/${id}`)
      setView(null)
      setDraft({ id: d.id, title: d.title, md: d.content_md || "" })
    } catch (e: any) { toast.error(e.message || "打开笔记失败") }
  }

  function newNote() {
    setView(null)
    setDraft({ id: null, title: "未命名笔记", md: "" })
  }

  async function save() {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) { toast.warning("标题不能为空"); return }
    setSaving(true)
    try {
      if (draft.id == null) {
        const j = await postJson("/api/notes", { title, content_md: draft.md })
        setDraft({ ...draft, id: j.id })
        toast.success("笔记已保存")
      } else {
        await apiJson(`/api/notes/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content_md: draft.md }),
        })
        toast.success("笔记已更新")
      }
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    try {
      await apiJson(`/api/notes/${id}`, { method: "DELETE" })
      toast.success("笔记已删除")
      fetchData(page, pageSize, q)
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  function backToList() {
    setDraft(null)
    setView(null)
    fetchData(page, pageSize, q)
  }

  const columns = [
    {
      title: "标题", dataIndex: "title", key: "title",
      render: (t: string, r: NoteMeta) => (
        <button onClick={() => openView(r.id)} className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline">
          <NotebookPen size={14} /> {t}
        </button>
      ),
    },
    { title: "大小", dataIndex: "size_bytes", key: "size_bytes", width: 110, render: fmtSize },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", width: 170 },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at", width: 170 },
    {
      title: "操作", key: "op", width: 240,
      render: (_: any, r: NoteMeta) => (
        <Space>
          <Button size="small" icon={<Eye size={13} />} onClick={() => openView(r.id)}>查看</Button>
          <Button size="small" icon={<PenLine size={13} />} onClick={() => openEdit(r.id)}>编辑</Button>
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
              placeholder="笔记标题"
            />
          </Space>
        }
        extra={
          <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save}>保存</Button>
        }
      >
        <MdEditor value={draft.md} onChange={(md) => setDraft({ ...draft, md })} />
        <div className="mt-2 text-xs text-zinc-400">
          提示：支持 GFM（表格 / 任务列表 / 删除线）；Tab 插入缩进；保存后可在列表查看渲染效果。
        </div>
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
              <NotebookPen size={16} /> {view.title}
            </span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PenLine size={14} />} onClick={() => openEdit(view.id)}>编辑</Button>
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
      title={<span className="inline-flex items-center gap-2"><NotebookPen size={17} /> 笔记</span>}
      extra={
        <Space>
          <Input.Search placeholder="搜索标题" allowClear onSearch={(v) => { setPage(1); setQ(v) }} style={{ width: 200 }} />
          <Button type="primary" icon={<Plus size={14} />} onClick={newNote}>新建笔记</Button>
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
        locale={{ emptyText: "还没有笔记，点右上角「新建笔记」开始" }}
      />
    </Card>
  )
}
