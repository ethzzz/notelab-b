"use client"
// AI 工具库（传统管理后台风）：Table 列表 + Modal 表单 + Switch 启停 + Popconfirm 删除
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiJson, postJson, api } from "@/lib/api"
import { toast } from "@/lib/toast"
import { Button, Card, Input, Modal, Form, Select, Switch, Table, Tag, Radio, Popconfirm, Checkbox, Space } from "antd"

type Tool = {
  id: number; name: string; icon: string; category: string; type: string
  description: string; endpoint: string; config: string; enabled: number | boolean
  created_at?: string
}

const CATEGORIES = ["搜索", "生成", "语音", "对话增强", "数据处理", "MCP", "自定义"]
const TYPES = [
  { key: "api", name: "API" },
  { key: "mcp", name: "MCP" },
  { key: "function", name: "Function" },
  { key: "plugin", name: "插件" },
]
const TYPE_COLOR: Record<string, string> = { api: "blue", mcp: "purple", function: "green", plugin: "gold" }

const EMPTY_FORM = { name: "", icon: "🔧", category: "自定义", type: "api", description: "", endpoint: "", config: "", enabled: true }

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState("全部")
  const [editing, setEditing] = useState<Tool | "new" | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    apiJson("/api/tools").then((j) => setTools(j.tools || [])).catch((e) => {
      if (String(e.message).includes("403") || e.message === "需要超级管理员权限") setDenied(true)
    })
  }, [])
  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORIES)
    tools.forEach((t) => set.add(t.category))
    return ["全部", ...Array.from(set)]
  }, [tools])

  const shown = filter === "全部" ? tools : tools.filter((t) => t.category === filter)

  function openNew() { setForm(EMPTY_FORM); setEditing("new") }
  function openEdit(t: Tool) {
    setForm({
      name: t.name, icon: t.icon || "🔧", category: t.category, type: t.type,
      description: t.description || "", endpoint: t.endpoint || "",
      config: t.config || "", enabled: !!t.enabled,
    })
    setEditing(t)
  }

  async function save() {
    if (!form.name.trim()) { toast.warning("工具名称必填"); return }
    if (form.config.trim()) {
      try { JSON.parse(form.config) } catch { toast.warning("config 必须是合法 JSON"); return }
    }
    setSaving(true)
    try {
      if (editing === "new") {
        await postJson("/api/tools", form)
        toast.success("工具已创建")
      } else if (editing) {
        await apiJson(`/api/tools/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        toast.success("工具已保存")
      }
      setEditing(null)
      load()
    } catch (e: any) { toast.error(e.message || "保存失败") }
    setSaving(false)
  }

  async function toggle(t: Tool) {
    try {
      await postJson(`/api/tools/${t.id}/toggle`, {})
      load()
    } catch (e: any) { toast.error(e.message || "操作失败") }
  }

  async function remove(t: Tool) {
    try {
      await api(`/api/tools/${t.id}`, { method: "DELETE" })
      toast.success("已删除")
      load()
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  if (denied) return <Card className="text-center text-zinc-500 dark:text-zinc-400 py-8">🔒 工具库管理仅超级管理员可用。</Card>

  const columns = [
    {
      title: "工具", dataIndex: "name", width: 220,
      render: (_: any, t: Tool) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/30 text-lg">{t.icon || "🔧"}</span>
          <span className={`font-medium truncate ${t.enabled ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}>{t.name}</span>
        </div>
      ),
    },
    { title: "分类", dataIndex: "category", width: 110, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: "类型", dataIndex: "type", width: 100,
      render: (v: string) => <Tag color={TYPE_COLOR[v] || "default"}>{TYPES.find((x) => x.key === v)?.name || v}</Tag>,
    },
    {
      title: "描述", dataIndex: "description",
      render: (v: string) => <span className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{v || "（暂无描述）"}</span>,
    },
    {
      title: "端点", dataIndex: "endpoint", width: 180,
      render: (v: string) => v ? <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 truncate block" title={v}>🔗 {v}</span> : <span className="text-zinc-300">—</span>,
    },
    {
      title: "启用", dataIndex: "enabled", width: 80, align: "center" as const,
      render: (_: any, t: Tool) => <Switch size="small" checked={!!t.enabled} onChange={() => toggle(t)} aria-label={t.enabled ? "点击停用" : "点击启用"} />,
    },
    {
      title: "操作", width: 130, align: "right" as const,
      render: (_: any, t: Tool) => (
        <Space size={4}>
          <Button size="small" type="text" onClick={() => openEdit(t)}>编辑</Button>
          <Popconfirm title="删除工具" description={`删除工具「${t.name}」？删除后不可恢复。`}
            okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => remove(t)}>
            <Button size="small" type="text" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold mb-0">AI 工具库</h1>
        <Tag color="indigo">{tools.length} 个工具 · {tools.filter((t) => t.enabled).length} 个启用</Tag>
        <Button type="primary" onClick={openNew} className="ml-auto">＋ 添加工具</Button>
      </div>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm -mt-1 mb-0">登记与管理可被各 AI 功能引用的增强能力（搜索 / 生成 / 语音 / MCP / 自定义 API）。启停与配置修改即时生效。</p>

      {/* 分类筛选 */}
      <Radio.Group value={filter} onChange={(e) => setFilter(e.target.value)} optionType="button" buttonStyle="solid"
        options={categories} />

      <Table rowKey="id" size="middle" columns={columns as any} dataSource={shown} pagination={false}
        locale={{ emptyText: "暂无工具，点右上角「添加工具」创建第一个" }}
        scroll={{ x: 900 }} />

      {/* 编辑/新建弹窗 */}
      <Modal open={!!editing} onCancel={() => { if (!saving) setEditing(null) }}
        title={editing === "new" ? "➕ 添加工具" : "✏️ 编辑工具"} width={560}
        okText="保存" cancelText="取消" confirmLoading={saving} onOk={save} maskClosable={false}>
        <Form layout="vertical" className="mt-3">
          <div className="flex gap-2">
            <Form.Item className="!w-24" label="图标">
              <Input className="text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="emoji" />
            </Form.Item>
            <Form.Item className="flex-1" label="名称" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="工具名称（必填）" />
            </Form.Item>
          </div>
          <div className="flex gap-2">
            <Form.Item className="flex-1" label="分类">
              <Input list="tool-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="分类" />
              <datalist id="tool-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Form.Item>
            <Form.Item className="!w-40" label="类型">
              <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                options={TYPES.map((t) => ({ value: t.key, label: t.name }))} />
            </Form.Item>
          </div>
          <Form.Item label="描述">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="工具描述：能力、用途、注意事项" />
          </Form.Item>
          <Form.Item label="接口地址">
            <Input className="font-mono !text-xs" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="接口地址 / 端点（如 /api/tts、https://... 或 stdio://...）" />
          </Form.Item>
          <Form.Item label="配置 JSON">
            <Input.TextArea className="font-mono !text-xs" autoSize={{ minRows: 3, maxRows: 8 }} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} placeholder={'配置 JSON，如 {"model":"...","voice":"..."}（密钥只放引用名，不落明文）'} />
          </Form.Item>
          <Checkbox checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })}>
            启用（启用后可被各 AI 功能引用）
          </Checkbox>
        </Form>
      </Modal>
    </div>
  )
}
