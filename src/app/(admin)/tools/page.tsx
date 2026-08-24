"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiJson, postJson, api } from "@/lib/api"
import { toast } from "@/lib/toast"
import { confirmDialog } from "@/components/ui/confirm"
import Select from "@/components/ui/select"
import Modal from "@/components/ui/modal"
import { Switch, Button, Input as AntInput, Checkbox } from "antd"

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
const TYPE_BADGE: Record<string, string> = {
  api: "bg-sky-50 text-sky-700 border-sky-200",
  mcp: "bg-violet-50 text-violet-700 border-violet-200",
  function: "bg-emerald-50 text-emerald-700 border-emerald-200",
  plugin: "bg-amber-50 text-amber-700 border-amber-200",
}

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
    const ok = await confirmDialog({ title: "删除工具", message: `删除工具「${t.name}」？删除后不可恢复。`, confirmText: "删除" })
    if (!ok) return
    try {
      await api(`/api/tools/${t.id}`, { method: "DELETE" })
      toast.success("已删除")
      load()
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  if (denied) return <div className="card p-8 text-center text-zinc-500">🔒 工具库管理仅超级管理员可用。</div>

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">AI 工具库</h1>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{tools.length} 个工具 · {tools.filter((t) => t.enabled).length} 个启用</span>
        <button onClick={openNew} className="btn-primary ml-auto">＋ 添加工具</button>
      </div>
      <p className="text-zinc-600 text-sm -mt-2">登记与管理可被各 AI 功能引用的增强能力（搜索 / 生成 / 语音 / MCP / 自定义 API）。启停与配置修改即时生效。</p>

      {/* 分类筛选 */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${filter === c ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md shadow-indigo-600/20" : "bg-white/60 backdrop-blur-sm text-zinc-600 border-zinc-300/60 hover:border-indigo-400"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* 工具卡片 */}
      {shown.length === 0 ? (
        <div className="card p-10 text-center text-zinc-500">暂无工具，点右上角「添加工具」创建第一个。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((t) => (
            <div key={t.id} className={`card p-4 flex flex-col gap-2.5 ${t.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 text-xl">{t.icon || "🔧"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-zinc-800 truncate">{t.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded-full">{t.category}</span>
                    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${TYPE_BADGE[t.type] || TYPE_BADGE.api}`}>{(TYPES.find((x) => x.key === t.type)?.name) || t.type}</span>
                  </div>
                </div>
                <Switch size="small" checked={!!t.enabled} onChange={() => toggle(t)}
                  aria-label={t.enabled ? "点击停用" : "点击启用"} />
              </div>
              <p className="text-sm text-zinc-600 line-clamp-2 min-h-[2.5rem]">{t.description || "（暂无描述）"}</p>
              {t.endpoint && <div className="text-[11px] font-mono text-zinc-400 truncate" title={t.endpoint}>🔗 {t.endpoint}</div>}
              <div className="flex gap-2 mt-auto pt-1">
                <button onClick={() => openEdit(t)} className="btn-ghost flex-1 py-1.5">✏️ 编辑</button>
                <button onClick={() => remove(t)} className="btn-ghost flex-1 py-1.5 hover:bg-red-50 hover:text-red-600">🗑️ 删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/新建弹窗（antd Modal） */}
      <Modal open={!!editing} onClose={() => { if (!saving) setEditing(null) }}
        title={editing === "new" ? "➕ 添加工具" : "✏️ 编辑工具"} maxW="max-w-lg">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <AntInput className="!w-20 text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="图标" title="工具图标（emoji）" />
            <AntInput className="flex-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="工具名称（必填）" />
          </div>
          <div className="flex gap-2">
            <AntInput className="flex-1" list="tool-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="分类" />
            <datalist id="tool-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })} className="w-36"
              options={TYPES.map((t) => ({ value: t.key, label: t.name }))} />
          </div>
          <AntInput.TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="工具描述：能力、用途、注意事项" />
          <AntInput className="font-mono !text-xs" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="接口地址 / 端点（如 /api/tts、https://... 或 stdio://...）" />
          <AntInput.TextArea className="font-mono !text-xs" autoSize={{ minRows: 3, maxRows: 8 }} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} placeholder={'配置 JSON，如 {"model":"...","voice":"..."}（密钥只放引用名，不落明文）'} />
          <Checkbox checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })}>
            启用（启用后可被各 AI 功能引用）
          </Checkbox>
          <div className="flex gap-2 mt-1">
            <Button type="primary" onClick={save} loading={saving} className="flex-1">{saving ? "保存中..." : "保存"}</Button>
            <Button onClick={() => setEditing(null)}>取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
