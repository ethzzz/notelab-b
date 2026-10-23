"use client"
// 社区运营（PRD-P9 M2）：B 端管理 C 端 /community 的板块与主题内容。
//
// 为什么这一页的优先级高于「用户点赞/收藏」：C 端只有 5 个账号，社区内容不可能靠 UGC 长起来，
// 供给主体是管理员 —— 写主题、整理板块、把已有博客导成讨论区（2026-10-23 定）。
//
// 三条实现约定：
// ① 官方发帖 author_id=0，C 端显示为「NoteLab 官方」；**不能**用 B 端 users.id（两套 id 空间会撞号）。
// ② 种子帖（author_id=0 且 link_type=blog）不进 C 端列表，除非有人回复 —— 这里能看到全部，
//    因为管理端刻意不套 C 端那条 VISIBLE 规则。
// ③ 「导入博客种子帖」是幂等的：有回复的种子帖不会被删，只清理无人回的空壳。
import { useCallback, useEffect, useState } from "react"
import {
  Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Tag, Tooltip,
} from "antd"
import {
  Download, LayoutGrid, Lock, LockOpen, Pencil, Pin, Plus, Sparkles, Trash2, MessageSquare,
} from "lucide-react"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { AdminPage, DataTable, ModalForm, actionColumn } from "@/components/admin"

type Board = {
  id: number; slug: string; name: string; description: string; icon: string
  sort_no: number; status: string; post_count: number; created_at?: string
}

type Post = {
  id: number; board_id: number; board_name: string; board_slug: string
  title: string; status: string; author_id: number; link_type: string; link_key: string
  is_pinned: number; is_featured: number
  view_count: number; comment_count: number; like_count: number
  created_at: string; updated_at: string; last_reply_at: string | null
  /** 只有详情接口（GET /posts/{id}）返回正文字段；列表行没有，所以是可选 */
  content_md?: string
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  normal: { text: "正常", color: "green" },
  closed: { text: "已锁定", color: "orange" },
  hidden: { text: "已隐藏", color: "default" },
  deleted: { text: "已删除", color: "red" },
}

export default function CommunityAdminPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [items, setItems] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [boardSlug, setBoardSlug] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  // 主题编辑弹窗
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [saving, setSaving] = useState(false)

  // 板块管理抽屉
  const [boardOpen, setBoardOpen] = useState(false)
  const [boardEditing, setBoardEditing] = useState<Board | null>(null)
  const [boardFormOpen, setBoardFormOpen] = useState(false)
  const [boardSaving, setBoardSaving] = useState(false)

  const fetchBoards = useCallback(() => {
    apiJson<{ boards: Board[] }>("/api/community-admin/boards")
      .then((j) => setBoards(j.boards || []))
      .catch((e) => toast.error(e.message || "读取板块失败"))
  }, [])

  const fetchPosts = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) })
    if (boardSlug) p.set("board", boardSlug)
    if (status) p.set("status", status)
    if (q.trim()) p.set("q", q.trim())
    apiJson<{ items: Post[]; total: number }>(`/api/community-admin/posts?${p}`)
      .then((j) => { setItems(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || "读取主题失败"))
      .finally(() => setLoading(false))
  }, [page, pageSize, boardSlug, status, q])

  useEffect(() => { fetchBoards() }, [fetchBoards])
  useEffect(() => { fetchPosts() }, [fetchPosts])

  // ---------- 主题 ----------

  async function savePost(v: any) {
    setSaving(true)
    try {
      if (editing) {
        await apiJson(`/api/community-admin/posts/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board_slug: v.board_slug, title: v.title, content_md: v.content_md ?? "" }),
        })
        toast.success("已保存")
      } else {
        await postJson("/api/community-admin/posts", {
          board_slug: v.board_slug, title: v.title, content_md: v.content_md,
        })
        toast.success("已发布")
      }
      setEditorOpen(false)
      setEditing(null)
      fetchPosts()
      fetchBoards()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function toggleFlag(p: Post, key: "pinned" | "featured") {
    const cur = key === "pinned" ? p.is_pinned : p.is_featured
    try {
      await postJson(`/api/community-admin/posts/${p.id}/flags`, { [key]: !cur })
      // 本地乐观更新：置顶/精华是单字段切换，重新拉整页会把用户滚回顶部
      setItems((list) => list.map((x) => (x.id === p.id ? { ...x, [key === "pinned" ? "is_pinned" : "is_featured"]: cur ? 0 : 1 } : x)))
    } catch (e: any) {
      toast.error(e.message || "操作失败")
    }
  }

  async function toggleClosed(p: Post) {
    const closed = p.status !== "closed"
    try {
      await postJson(`/api/community-admin/posts/${p.id}/flags`, { closed })
      setItems((list) => list.map((x) => (x.id === p.id ? { ...x, status: closed ? "closed" : "normal" } : x)))
      toast.success(closed ? "已锁定" : "已解锁")
    } catch (e: any) {
      toast.error(e.message || "操作失败")
    }
  }

  async function removePost(p: Post) {
    try {
      await apiJson(`/api/community-admin/posts/${p.id}`, { method: "DELETE" })
      toast.success("已删除")
      fetchPosts()
      fetchBoards()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  async function importSeeds() {
    setImporting(true)
    try {
      const r = await postJson("/api/community-admin/import-blog-seeds", {})
      toast.success(r.message || "导入完成")
      fetchPosts()
      fetchBoards()
    } catch (e: any) {
      toast.error(e.message || "导入失败")
    } finally {
      setImporting(false)
    }
  }

  // ---------- 板块 ----------

  async function saveBoard(v: any) {
    setBoardSaving(true)
    try {
      if (boardEditing) {
        await apiJson(`/api/community-admin/boards/${boardEditing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        })
        toast.success("板块已更新")
      } else {
        await postJson("/api/community-admin/boards", v)
        toast.success("板块已创建")
      }
      setBoardFormOpen(false)
      setBoardEditing(null)
      fetchBoards()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setBoardSaving(false)
    }
  }

  async function removeBoard(b: Board) {
    try {
      await apiJson(`/api/community-admin/boards/${b.id}`, { method: "DELETE" })
      toast.success("板块已删除")
      fetchBoards()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  const boardOptions = boards.map((b) => ({ value: b.slug, label: `${b.icon || "💬"} ${b.name}` }))

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "标题",
      dataIndex: "title",
      width: 360,
      render: (v: string, r: Post) => (
        <span className="flex items-center gap-1.5">
          {r.author_id === 0 && <Tag color="blue">官方</Tag>}
          <span className="line-clamp-1" title={v}>{v}</span>
        </span>
      ),
    },
    {
      title: "板块",
      dataIndex: "board_name",
      width: 100,
      render: (v: string, r: Post) => (
        <span className="text-zinc-500">
          {v}
          {r.link_type === "blog" && (
            <Tooltip title={r.link_key}>
              <span className="ml-1 text-[10px] text-indigo-500">讨论区</span>
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (v: string) => <Tag color={STATUS_META[v]?.color || "default"}>{STATUS_META[v]?.text || v}</Tag>,
    },
    {
      title: "标记",
      width: 80,
      render: (_: any, r: Post) => (
        <Space size={2}>
          {r.is_pinned ? <Pin size={13} className="text-indigo-500" /> : null}
          {r.is_featured ? <Sparkles size={13} className="text-amber-500" /> : null}
        </Space>
      ),
    },
    {
      title: "回复",
      dataIndex: "comment_count",
      width: 70,
      render: (v: number) => (
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} className="text-zinc-400" />
          {v}
        </span>
      ),
    },
    { title: "浏览", dataIndex: "view_count", width: 70 },
    { title: "创建时间", dataIndex: "created_at", width: 150, render: (v: string) => v?.slice(0, 16) },
    actionColumn((_: any, r: Post) => (
      <Space size={2}>
        <Tooltip title="编辑">
          <Button
            type="text" size="small" icon={<Pencil size={14} />}
            onClick={() => {
              // 列表行没有正文，必须回读详情（否则编辑会把正文清空）
              apiJson<{ post: any }>(`/api/community-admin/posts/${r.id}`)
                .then((j) => { setEditing(j.post); setEditorOpen(true) })
                .catch((e) => toast.error(e.message || "读取详情失败"))
            }}
          />
        </Tooltip>
        <Tooltip title={r.is_pinned ? "取消置顶" : "置顶"}>
          <Button type="text" size="small" onClick={() => toggleFlag(r, "pinned")}
            icon={<Pin size={14} className={r.is_pinned ? "text-indigo-500" : "text-zinc-400"} />} />
        </Tooltip>
        <Tooltip title={r.is_featured ? "取消精华" : "设为精华"}>
          <Button type="text" size="small" onClick={() => toggleFlag(r, "featured")}
            icon={<Sparkles size={14} className={r.is_featured ? "text-amber-500" : "text-zinc-400"} />} />
        </Tooltip>
        <Tooltip title={r.status === "closed" ? "解锁" : "锁定（禁止新回复）"}>
          <Button type="text" size="small" onClick={() => toggleClosed(r)}
            icon={r.status === "closed" ? <LockOpen size={14} className="text-orange-500" /> : <Lock size={14} className="text-zinc-400" />} />
        </Tooltip>
        <Popconfirm title="删除这个主题？" description="C 端将不再显示，回复一并不可见" okText="删除" cancelText="取消"
          onConfirm={() => removePost(r)}>
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
        </Popconfirm>
      </Space>
    ), 190),
  ]

  return (
    <AdminPage
      title="社区运营"
      description="C 端 /community 的板块与主题内容。官方发帖以「NoteLab 官方」身份出现；种子讨论区按博客文章生成，无人回复时不在 C 端列表显示。"
      extra={
        <Space>
          <Button icon={<LayoutGrid size={14} />} onClick={() => setBoardOpen(true)}>板块管理</Button>
          <Tooltip title="读博客 RSS，为还没有讨论区的文章补建。有回复的讨论区不会被删除。">
            <Button icon={<Download size={14} />} loading={importing} onClick={importSeeds}>
              导入博客讨论区
            </Button>
          </Tooltip>
          <Button type="primary" icon={<Plus size={14} />}
            onClick={() => { setEditing(null); setEditorOpen(true) }}>
            新建主题
          </Button>
        </Space>
      }
    >
      <Space wrap>
        <Select
          allowClear placeholder="全部板块" style={{ width: 160 }} value={boardSlug || undefined}
          options={boardOptions}
          onChange={(v) => { setBoardSlug(v || ""); setPage(1) }}
        />
        <Select
          allowClear placeholder="全部状态" style={{ width: 130 }} value={status || undefined}
          options={Object.entries(STATUS_META).map(([k, m]) => ({ value: k, label: m.text }))}
          onChange={(v) => { setStatus(v || ""); setPage(1) }}
        />
        <Input.Search
          allowClear placeholder="搜索标题/正文" style={{ width: 240 }}
          onSearch={(v) => { setQ(v); setPage(1) }}
        />
        <span className="text-xs text-zinc-400">共 {total} 条</span>
      </Space>

      <DataTable<Post>
        columns={columns as any}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page, pageSize, total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, s) => { setPage(p); setPageSize(s) },
        }}
      />

      {/* 主题编辑 */}
      <ModalForm
        open={editorOpen}
        title={editing ? `编辑主题 #${editing.id}` : "新建主题"}
        width={760}
        confirmLoading={saving}
        okText={editing ? "保存" : "发布"}
        entity="community_posts"
        initialValues={
          editing
            ? { board_slug: editing.board_slug, title: editing.title, content_md: editing.content_md || "" }
            : { board_slug: boards[0]?.slug, title: "", content_md: "" }
        }
        onCancel={() => { setEditorOpen(false); setEditing(null) }}
        onSubmit={savePost}
      >
        <Form.Item name="board_slug" label="板块" rules={[{ required: true, message: "请选择板块" }]}>
          <Select options={boardOptions} />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: "请填标题" }, { max: 120 }]}>
          <Input placeholder="一句话说清这个主题讲什么" showCount maxLength={120} />
        </Form.Item>
        {editing?.link_type === "blog" && (
          <p className="-mt-1 mb-3 text-xs text-zinc-400">
            这是一个博客讨论区（{editing.link_key}）。补一段导语能让空讨论区不至于是空白的。
          </p>
        )}
        <Form.Item
          name="content_md"
          label="正文（Markdown）"
          rules={editing ? [] : [{ required: true, message: "请填正文" }]}
        >
          <Input.TextArea rows={14} maxLength={20000} showCount
            placeholder={"支持 Markdown：**粗体**、`代码`、- 列表、> 引用、[链接](https://…)"} />
        </Form.Item>
      </ModalForm>

      {/* 板块管理 */}
      <Drawer
        title="板块管理"
        width={640}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        extra={
          <Button type="primary" size="small" icon={<Plus size={13} />}
            onClick={() => { setBoardEditing(null); setBoardFormOpen(true) }}>
            新增板块
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
              <span className="text-lg">{b.icon || "💬"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-zinc-800">{b.name}</span>
                  <code className="text-[11px] text-zinc-400">/{b.slug}</code>
                  {b.status !== "active" && <Tag>已归档</Tag>}
                </div>
                <div className="line-clamp-1 text-[11px] text-zinc-400">
                  {b.description || "（无描述）"} · {b.post_count} 个主题 · 排序 {b.sort_no}
                </div>
              </div>
              <Button type="text" size="small" icon={<Pencil size={13} />}
                onClick={() => { setBoardEditing(b); setBoardFormOpen(true) }} />
              <Popconfirm title="删除板块？" description="板块下有主题时不允许删除" okText="删除" cancelText="取消"
                onConfirm={() => removeBoard(b)}>
                <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
              </Popconfirm>
            </div>
          ))}
          {boards.length === 0 && <p className="text-xs text-zinc-400">还没有板块。</p>}
        </div>
      </Drawer>

      <ModalForm
        open={boardFormOpen}
        title={boardEditing ? `编辑板块 ${boardEditing.name}` : "新增板块"}
        width={520}
        confirmLoading={boardSaving}
        entity="community_boards"
        initialValues={
          boardEditing
            ? {
                slug: boardEditing.slug, name: boardEditing.name, description: boardEditing.description,
                icon: boardEditing.icon, sort_no: boardEditing.sort_no, status: boardEditing.status,
              }
            : { slug: "", name: "", description: "", icon: "💬", sort_no: 100, status: "active" }
        }
        onCancel={() => { setBoardFormOpen(false); setBoardEditing(null) }}
        onSubmit={saveBoard}
      >
        <Form.Item
          name="slug" label="slug（C 端 URL 的一部分）"
          rules={[
            { required: true, message: "请填 slug" },
            { pattern: /^[a-z0-9][a-z0-9-]{1,48}$/, message: "2-49 位小写字母/数字/短横线" },
          ]}
          extra="改 slug 会让 /community/b/<slug> 的旧链接失效，慎改"
        >
          <Input placeholder="general" />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: "请填名称" }, { max: 50 }]}>
          <Input placeholder="综合讨论" />
        </Form.Item>
        <Form.Item name="description" label="描述" rules={[{ max: 200 }]}>
          <Input placeholder="一句话题材说明" />
        </Form.Item>
        <div className="flex gap-3">
          <Form.Item name="icon" label="图标（emoji）" className="w-32">
            <Input maxLength={4} />
          </Form.Item>
          <Form.Item name="sort_no" label="排序" className="w-32">
            <InputNumber min={0} max={9999} className="w-full" />
          </Form.Item>
          <Form.Item name="status" label="状态" className="w-32">
            <Select options={[{ value: "active", label: "正常" }, { value: "archived", label: "归档（只读）" }]} />
          </Form.Item>
        </div>
      </ModalForm>
    </AdminPage>
  )
}
