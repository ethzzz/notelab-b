"use client"
import { useEffect, useState } from "react"
import { confirmDialog } from "@/components/ui/confirm"
import Select from "@/components/ui/select"

// ================= 通用工具 =================
const LS = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
  },
  set(key: string, value: any) {
    if (typeof window === "undefined") return
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
  },
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button className="btn-ghost text-xs"
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500) }}>
      {ok ? "✓ 已复制" : "📋 复制"}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{children}</div>
}

// ================= 表单设计器 =================
type FieldType = "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "switch" | "date"
type Field = { id: string; type: FieldType; label: string; placeholder?: string; required?: boolean; options?: string[] }

const FIELD_DEFS: { type: FieldType; name: string; icon: string }[] = [
  { type: "text", name: "单行文本", icon: "📝" },
  { type: "textarea", name: "多行文本", icon: "📄" },
  { type: "number", name: "数字", icon: "🔢" },
  { type: "select", name: "下拉选择", icon: "📃" },
  { type: "radio", name: "单选组", icon: "🔘" },
  { type: "checkbox", name: "多选组", icon: "☑️" },
  { type: "switch", name: "开关", icon: "🎚️" },
  { type: "date", name: "日期", icon: "📅" },
]

function formToSchema(fields: Field[]) {
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const f of fields) {
    const p: any = { title: f.label }
    p.type = f.type === "number" ? "number" : f.type === "switch" ? "boolean" : "string"
    if (f.type === "date") p.format = "date"
    if (f.type === "select" || f.type === "radio" || f.type === "checkbox") p.enum = f.options || []
    if (f.placeholder) p.description = f.placeholder
    properties[f.id] = p
    if (f.required) required.push(f.id)
  }
  return { type: "object", properties, required }
}

function FormPreviewControl({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  switch (f.type) {
    case "textarea": return <textarea className="input resize-none" rows={3} placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    case "number": return <input type="number" className="input" placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    case "date": return <input type="date" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    case "select": return (
      <Select value={value || ""} onChange={onChange} placeholder="请选择"
        options={(f.options || []).map((o) => ({ value: o, label: o }))} />)
    case "radio": return (
      <div className="flex flex-wrap gap-3">
        {(f.options || []).map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm text-zinc-700 cursor-pointer">
            <input type="radio" checked={value === o} onChange={() => onChange(o)} />{o}
          </label>))}
      </div>)
    case "checkbox": {
      const arr: string[] = Array.isArray(value) ? value : []
      return (
        <div className="flex flex-wrap gap-3">
          {(f.options || []).map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={arr.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />{o}
            </label>))}
        </div>)
    }
    case "switch": return (
      <button onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? "bg-indigo-500" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>)
    default: return <input className="input" placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  }
}

function FormDesigner() {
  const [fields, setFields] = useState<Field[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState<string>("")

  useEffect(() => { setFields(LS.get("b_notelab.lowcode.form", [])) }, [])
  useEffect(() => { LS.set("b_notelab.lowcode.form", fields) }, [fields])

  const selected = fields.find((f) => f.id === selectedId) || null

  function addField(type: FieldType) {
    const def = FIELD_DEFS.find((d) => d.type === type)!
    const f: Field = {
      id: "f" + Date.now().toString(36),
      type,
      label: def.name,
      placeholder: "",
      required: false,
      options: type === "select" || type === "radio" || type === "checkbox" ? ["选项一", "选项二"] : undefined,
    }
    setFields((prev) => [...prev, f])
    setSelectedId(f.id)
    setPreview(false)
  }
  function patchField(id: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function moveField(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const i = prev.findIndex((f) => f.id === id)
      if (i < 0 || i + dir < 0 || i + dir >= prev.length) return prev
      const c = [...prev]; const [x] = c.splice(i, 1); c.splice(i + dir, 0, x); return c
    })
  }
  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="flex gap-4 items-start">
      {/* 组件库 */}
      <div className="w-48 shrink-0 card p-3">
        <SectionTitle>组件库</SectionTitle>
        <div className="grid grid-cols-1 gap-1.5">
          {FIELD_DEFS.map((d) => (
            <button key={d.type} onClick={() => addField(d.type)}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-zinc-600 bg-white/60 border border-black/5 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all text-left">
              <span>{d.icon}</span>{d.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">点击组件添加到画布；设计稿自动保存在浏览器本地。</p>
      </div>

      {/* 画布 */}
      <div className="flex-1 min-w-0 card p-4">
        <div className="flex items-center gap-2 mb-3">
          <SectionTitle>画布（{fields.length} 个字段）</SectionTitle>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => { setPreview(!preview); setSubmitted("") }}>{preview ? "🛠 回到设计" : "👁 预览"}</button>
            <button className="btn-ghost text-xs" onClick={() => setShowExport(true)} disabled={fields.length === 0}>📤 导出 Schema</button>
            <button className="btn-ghost text-xs text-red-500" onClick={async () => { if (await confirmDialog({ message: "清空所有字段？", confirmText: "清空" })) { setFields([]); setSelectedId(null) } }} disabled={fields.length === 0}>🗑 清空</button>
          </div>
        </div>

        {fields.length === 0 && <div className="text-zinc-400 text-sm text-center py-12">从左侧点击组件，开始搭建表单</div>}

        {!preview ? (
          <div className="flex flex-col gap-2">
            {fields.map((f) => {
              const def = FIELD_DEFS.find((d) => d.type === f.type)!
              const active = selectedId === f.id
              return (
                <div key={f.id} onClick={() => setSelectedId(f.id)}
                  className={`group rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${active ? "border-indigo-400 bg-indigo-50/70 shadow-sm" : "border-black/5 bg-white/60 hover:border-indigo-200"}`}>
                  <div className="flex items-center gap-2">
                    <span>{def.icon}</span>
                    <span className="text-sm font-medium text-zinc-800">{f.label}</span>
                    {f.required && <span className="text-red-500 text-xs">*必填</span>}
                    <span className="text-[11px] text-zinc-400">{def.name}</span>
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-ghost text-xs px-1.5" title="上移" onClick={() => moveField(f.id, -1)}>↑</button>
                      <button className="btn-ghost text-xs px-1.5" title="下移" onClick={() => moveField(f.id, 1)}>↓</button>
                      <button className="btn-ghost text-xs px-1.5 text-red-500" title="删除" onClick={() => removeField(f.id)}>✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-lg">
            {fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                <FormPreviewControl f={f} value={formValues[f.id]} onChange={(v) => setFormValues((prev) => ({ ...prev, [f.id]: v }))} />
              </div>
            ))}
            <button className="btn-primary self-start" onClick={() => setSubmitted(JSON.stringify(formToSchema(fields) && formValues, null, 2))}>提交（演示）</button>
            {submitted && <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-xl p-3 overflow-x-auto">{submitted}</pre>}
          </div>
        )}
      </div>

      {/* 属性面板 */}
      <div className="w-60 shrink-0 card p-3">
        <SectionTitle>属性</SectionTitle>
        {!selected && <div className="text-zinc-400 text-sm py-6 text-center">选中画布中的字段进行配置</div>}
        {selected && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-500">标题</label>
              <input className="input mt-1" value={selected.label} onChange={(e) => patchField(selected.id, { label: e.target.value })} />
            </div>
            {selected.type !== "switch" && (
              <div>
                <label className="text-xs text-zinc-500">占位提示</label>
                <input className="input mt-1" value={selected.placeholder || ""} onChange={(e) => patchField(selected.id, { placeholder: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={!!selected.required} onChange={(e) => patchField(selected.id, { required: e.target.checked })} />
              必填
            </label>
            {(selected.type === "select" || selected.type === "radio" || selected.type === "checkbox") && (
              <div>
                <label className="text-xs text-zinc-500">选项（每行一个）</label>
                <textarea className="input mt-1 resize-none" rows={4} value={(selected.options || []).join("\n")}
                  onChange={(e) => patchField(selected.id, { options: e.target.value.split("\n").filter((x) => x.trim() !== "") })} />
              </div>
            )}
            <button className="btn-ghost text-xs text-red-500 self-start" onClick={() => removeField(selected.id)}>🗑 删除该字段</button>
          </div>
        )}
      </div>

      {/* 导出弹窗 */}
      {showExport && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4" onClick={() => setShowExport(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">导出 JSON Schema</h3>
              <div className="flex gap-2"><CopyBtn text={JSON.stringify(formToSchema(fields), null, 2)} /><button className="btn-ghost text-xs" onClick={() => setShowExport(false)}>关闭</button></div>
            </div>
            <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-xl p-4 overflow-x-auto">{JSON.stringify(formToSchema(fields), null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ================= 流程编排 =================
type FlowKind = "trigger" | "condition" | "action" | "delay"
type FlowNode = { id: string; type: string; params: Record<string, string> }
const FLOW_DEFS: { kind: FlowKind; type: string; name: string; icon: string; params: string[] }[] = [
  { kind: "trigger", type: "schedule", name: "定时触发", icon: "⏰", params: ["cron 表达式"] },
  { kind: "trigger", type: "webhook", name: "Webhook 触发", icon: "🔗", params: ["路径"] },
  { kind: "trigger", type: "manual", name: "手动触发", icon: "👆", params: [] },
  { kind: "condition", type: "if", name: "条件判断", icon: "🔀", params: ["条件表达式"] },
  { kind: "action", type: "notify", name: "发送通知", icon: "📨", params: ["接收人", "通知内容"] },
  { kind: "action", type: "http", name: "调用 API", icon: "🌐", params: ["URL", "方法"] },
  { kind: "action", type: "data", name: "写入数据", icon: "💾", params: ["目标表", "数据 JSON"] },
  { kind: "delay", type: "wait", name: "延时等待", icon: "⏳", params: ["时长（秒）"] },
]
const KIND_COLOR: Record<FlowKind, string> = {
  trigger: "from-emerald-500 to-teal-500",
  condition: "from-amber-500 to-orange-500",
  action: "from-indigo-500 to-violet-500",
  delay: "from-zinc-400 to-zinc-500",
}

function FlowDesigner() {
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingAt, setAddingAt] = useState<number | null>(null) // 在第 N 个位置后插入
  const [showExport, setShowExport] = useState(false)

  useEffect(() => { setNodes(LS.get("b_notelab.lowcode.flow", [])) }, [])
  useEffect(() => { LS.set("b_notelab.lowcode.flow", nodes) }, [nodes])

  const selected = nodes.find((n) => n.id === selectedId) || null
  const selectedDef = selected ? FLOW_DEFS.find((d) => d.type === selected.type) : null

  function addNode(defIdx: number, at: number) {
    const def = FLOW_DEFS[defIdx]
    const n: FlowNode = { id: "n" + Date.now().toString(36), type: def.type, params: {} }
    setNodes((prev) => { const c = [...prev]; c.splice(at, 0, n); return c })
    setSelectedId(n.id)
    setAddingAt(null)
  }
  function patchParams(id: string, key: string, value: string) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n)))
  }
  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const AddMenu = ({ at }: { at: number }) => (
    <div className="card p-2 flex flex-col gap-1 w-56">
      {FLOW_DEFS.map((d, di) => (
        <button key={d.type} onClick={() => addNode(di, at)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 text-left">
          <span>{d.icon}</span>{d.name}
          <span className="ml-auto text-[10px] text-zinc-400">{{ trigger: "触发", condition: "条件", action: "动作", delay: "延时" }[d.kind]}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex gap-4 items-start">
      {/* 流程画布 */}
      <div className="flex-1 min-w-0 card p-4">
        <div className="flex items-center mb-3">
          <SectionTitle>流程画布（{nodes.length} 个节点）</SectionTitle>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => setShowExport(true)} disabled={nodes.length === 0}>📤 导出 JSON</button>
            <button className="btn-ghost text-xs text-red-500" onClick={async () => { if (await confirmDialog({ message: "清空流程？", confirmText: "清空" })) { setNodes([]); setSelectedId(null) } }} disabled={nodes.length === 0}>🗑 清空</button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-0 max-w-xl mx-auto py-2">
          <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-zinc-700 to-zinc-800 text-white text-xs font-medium shadow">▶ 开始</div>

          {nodes.map((n, i) => {
            const def = FLOW_DEFS.find((d) => d.type === n.type)!
            const active = selectedId === n.id
            return (
              <div key={n.id} className="flex flex-col items-center w-full">
                <div className="w-px h-5 bg-zinc-300" />
                <div onClick={() => setSelectedId(n.id)}
                  className={`group w-full rounded-2xl border px-4 py-3 cursor-pointer transition-all bg-white/70 ${active ? "border-indigo-400 shadow-md shadow-indigo-500/10" : "border-black/5 hover:border-indigo-200"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${KIND_COLOR[def.kind]} text-sm shadow-sm`}>{def.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-800">{def.name}</div>
                      {def.params.length > 0 && (
                        <div className="text-[11px] text-zinc-400 truncate max-w-[260px]">
                          {def.params.map((p) => n.params[p]).filter(Boolean).join(" · ") || "未配置"}
                        </div>
                      )}
                    </div>
                    <button className="ml-auto btn-ghost text-xs px-1.5 text-red-500 opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); removeNode(n.id) }}>✕</button>
                  </div>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="w-px h-5 bg-zinc-300" />
                  <button onClick={() => setAddingAt(addingAt === i ? null : i)}
                    className="grid h-5 w-5 place-items-center rounded-full bg-white border border-zinc-300 text-zinc-400 text-xs hover:border-indigo-400 hover:text-indigo-500 transition-colors">＋</button>
                  {addingAt === i && <div className="absolute top-6 z-20"><AddMenu at={i + 1} /></div>}
                </div>
              </div>
            )
          })}

          {nodes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4">
              <button onClick={() => setAddingAt(addingAt === -1 ? null : -1)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white border border-dashed border-zinc-300 text-zinc-400 hover:border-indigo-400 hover:text-indigo-500">＋</button>
              {addingAt === -1 && <AddMenu at={0} />}
              <span className="text-zinc-400 text-sm">点击 ＋ 添加第一个节点（建议先加触发器）</span>
            </div>
          )}

          <div className="w-px h-5 bg-zinc-300" />
          <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-zinc-700 to-zinc-800 text-white text-xs font-medium shadow">■ 结束</div>
        </div>
      </div>

      {/* 节点配置 */}
      <div className="w-64 shrink-0 card p-3">
        <SectionTitle>节点配置</SectionTitle>
        {!selected && <div className="text-zinc-400 text-sm py-6 text-center">点击流程中的节点进行配置</div>}
        {selected && selectedDef && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${KIND_COLOR[selectedDef.kind]} text-base`}>{selectedDef.icon}</span>
              <div>
                <div className="text-sm font-medium text-zinc-800">{selectedDef.name}</div>
                <div className="text-[11px] text-zinc-400">{{ trigger: "触发器", condition: "条件节点", action: "动作节点", delay: "延时节点" }[selectedDef.kind]}</div>
              </div>
            </div>
            {selectedDef.params.map((p) => (
              <div key={p}>
                <label className="text-xs text-zinc-500">{p}</label>
                <input className="input mt-1" value={selected.params[p] || ""} onChange={(e) => patchParams(selected.id, p, e.target.value)} />
              </div>
            ))}
            {selectedDef.params.length === 0 && <div className="text-xs text-zinc-400">该节点无需配置</div>}
            <button className="btn-ghost text-xs text-red-500 self-start" onClick={() => removeNode(selected.id)}>🗑 删除节点</button>
          </div>
        )}
      </div>

      {showExport && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4" onClick={() => setShowExport(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">导出流程 JSON</h3>
              <div className="flex gap-2"><CopyBtn text={JSON.stringify({ nodes }, null, 2)} /><button className="btn-ghost text-xs" onClick={() => setShowExport(false)}>关闭</button></div>
            </div>
            <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-xl p-4 overflow-x-auto">{JSON.stringify({ nodes }, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ================= 数据模型 =================
type ModelField = { name: string; type: string; required: boolean; def: string; note: string }
const MODEL_TYPES = ["string", "text", "number", "boolean", "date", "enum"]

function modelToSql(name: string, fields: ModelField[]) {
  const cols = fields.filter((f) => f.name.trim()).map((f) => {
    const t = f.type === "text" ? "TEXT" : f.type === "number" ? "DOUBLE" : f.type === "boolean" ? "TINYINT(1)" : f.type === "date" ? "DATETIME" : "VARCHAR(255)"
    return `  \`${f.name}\` ${t}${f.required ? " NOT NULL" : ""}${f.def ? ` DEFAULT '${f.def}'` : ""}${f.note ? ` COMMENT '${f.note}'` : ""}`
  })
  return `CREATE TABLE \`${name || "my_table"}\` (\n  id BIGINT AUTO_INCREMENT PRIMARY KEY,\n${cols.join(",\n")},\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
}
function modelToSchema(name: string, fields: ModelField[]) {
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const f of fields.filter((x) => x.name.trim())) {
    const p: any = {}
    p.type = f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string"
    if (f.type === "date") p.format = "date-time"
    if (f.note) p.description = f.note
    properties[f.name] = p
    if (f.required) required.push(f.name)
  }
  return { title: name || "my_table", type: "object", properties, required }
}

function DataModeler() {
  const [name, setName] = useState("")
  const [fields, setFields] = useState<ModelField[]>([])
  useEffect(() => { const v = LS.get("b_notelab.lowcode.model", { name: "", fields: [] as ModelField[] }); setName(v.name); setFields(v.fields) }, [])
  useEffect(() => { LS.set("b_notelab.lowcode.model", { name, fields }) }, [name, fields])

  function patch(i: number, p: Partial<ModelField>) { setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...p } : f))) }
  const sql = modelToSql(name, fields)
  const schema = JSON.stringify(modelToSchema(name, fields), null, 2)

  return (
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 card p-4">
        <SectionTitle>模型定义</SectionTitle>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-zinc-500 shrink-0">模型名</span>
          <input className="input max-w-[240px]" placeholder="如 orders" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-ghost text-xs ml-auto" onClick={() => setFields((prev) => [...prev, { name: "", type: "string", required: false, def: "", note: "" }])}>＋ 添加字段</button>
          <button className="btn-ghost text-xs text-red-500" onClick={async () => { if (await confirmDialog({ message: "清空模型？", confirmText: "清空" })) { setFields([]); setName("") } }} disabled={fields.length === 0}>🗑 清空</button>
        </div>
        {fields.length === 0 && <div className="text-zinc-400 text-sm text-center py-10">点击「添加字段」开始定义数据模型</div>}
        {fields.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400">
                  <th className="py-1.5 pr-2 font-medium">字段名</th>
                  <th className="py-1.5 pr-2 font-medium">类型</th>
                  <th className="py-1.5 pr-2 font-medium">必填</th>
                  <th className="py-1.5 pr-2 font-medium">默认值</th>
                  <th className="py-1.5 pr-2 font-medium">备注</th>
                  <th className="py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={i} className="border-t border-black/5">
                    <td className="py-1.5 pr-2"><input className="input py-1 text-xs" placeholder="field_name" value={f.name} onChange={(e) => patch(i, { name: e.target.value })} /></td>
                    <td className="py-1.5 pr-2">
                      <Select size="sm" value={f.type} onChange={(v) => patch(i, { type: v })} options={MODEL_TYPES} className="w-24" />
                    </td>
                    <td className="py-1.5 pr-2 text-center"><input type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /></td>
                    <td className="py-1.5 pr-2"><input className="input py-1 text-xs" placeholder="可选" value={f.def} onChange={(e) => patch(i, { def: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input className="input py-1 text-xs" placeholder="字段说明" value={f.note} onChange={(e) => patch(i, { note: e.target.value })} /></td>
                    <td className="py-1.5"><button className="btn-ghost text-xs px-1.5 text-red-500" onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="w-[42%] shrink-0 flex flex-col gap-4">
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 SQL DDL</SectionTitle>
            <CopyBtn text={sql} />
          </div>
          <pre className="text-[11px] bg-zinc-900 text-sky-300 rounded-xl p-3 overflow-x-auto max-h-56 overflow-y-auto">{sql}</pre>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 JSON Schema</SectionTitle>
            <CopyBtn text={schema} />
          </div>
          <pre className="text-[11px] bg-zinc-900 text-emerald-300 rounded-xl p-3 overflow-x-auto max-h-56 overflow-y-auto">{schema}</pre>
        </div>
      </div>
    </div>
  )
}

// ================= 页面外壳 =================
const TABS = [
  { key: "form", name: "表单设计器", icon: "📋" },
  { key: "flow", name: "流程编排", icon: "🔀" },
  { key: "model", name: "数据模型", icon: "🗃️" },
]

export default function LowCodePage() {
  const [tab, setTab] = useState("form")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 card p-1.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20" : "text-zinc-600 hover:bg-white/70"}`}>
              {t.icon} {t.name}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400">可视化搭建 · 设计稿保存在浏览器本地 · 支持导出标准格式</span>
      </div>
      {tab === "form" && <FormDesigner />}
      {tab === "flow" && <FlowDesigner />}
      {tab === "model" && <DataModeler />}
    </div>
  )
}