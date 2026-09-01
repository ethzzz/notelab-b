"use client"
// 低代码平台（传统管理后台风）：antd Tabs + Card；交互规范不变（设计稿存浏览器本地、可导出）
import { Fragment, useEffect, useRef, useState, type DragEvent } from "react"
import { Button, Card, Input, InputNumber, Modal, Select, Switch, Tabs, Checkbox, Radio, DatePicker, Table } from "antd"
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons"

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
    <Button size="small" icon={<CopyOutlined />}
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500) }}>
      {ok ? "已复制" : "复制"}
    </Button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{children}</div>
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
    case "textarea": return <Input.TextArea rows={3} placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    case "number": return <InputNumber className="!w-full" placeholder={f.placeholder} value={value === "" || value == null ? null : Number(value)} onChange={(v) => onChange(v ?? "")} />
    case "date": return <DatePicker className="!w-full" onChange={(_d, ds) => onChange(Array.isArray(ds) ? ds[0] : ds)} />
    case "select": return (
      <Select className="w-full" value={value || undefined} onChange={onChange} placeholder="请选择"
        options={(f.options || []).map((o) => ({ value: o, label: o }))} />)
    case "radio": return (
      <Radio.Group value={value} onChange={(e) => onChange(e.target.value)}>
        {(f.options || []).map((o) => <Radio key={o} value={o}>{o}</Radio>)}
      </Radio.Group>)
    case "checkbox": {
      const arr: string[] = Array.isArray(value) ? value : []
      return <Checkbox.Group options={f.options || []} value={arr} onChange={(v) => onChange(v as string[])} />
    }
    case "switch": return <Switch checked={!!value} onChange={(v) => onChange(v)} />
    default: return <Input placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  }
}

function FormDesigner() {
  const [fields, setFields] = useState<Field[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState("")
  const [dropIndex, setDropIndex] = useState<number | null>(null)      // 拖拽插入位置指示
  const [dragging, setDragging] = useState(false)                      // 拖拽进行中（显示指示线）
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)  // 正在拖拽的画布字段（样式变淡）
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setFields(LS.get("b_notelab.lowcode.form", [])) }, [])
  useEffect(() => { LS.set("b_notelab.lowcode.form", fields) }, [fields])

  const selected = fields.find((f) => f.id === selectedId) || null

  function makeField(type: FieldType): Field {
    const def = FIELD_DEFS.find((d) => d.type === type)!
    return {
      id: "f" + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36),
      type,
      label: def.name,
      placeholder: "",
      required: false,
      options: type === "select" || type === "radio" || type === "checkbox" ? ["选项一", "选项二"] : undefined,
    }
  }
  function addField(type: FieldType) {
    const f = makeField(type)
    setFields((prev) => [...prev, f])
    setSelectedId(f.id)
  }
  function insertField(f: Field, at: number) {
    setFields((prev) => { const c = [...prev]; c.splice(Math.min(at, prev.length), 0, f); return c })
    setSelectedId(f.id)
  }
  function moveFieldTo(id: string, target: number) {
    setFields((prev) => {
      const from = prev.findIndex((f) => f.id === id)
      if (from < 0) return prev
      const c = [...prev]; const [x] = c.splice(from, 1)
      c.splice(from < target ? target - 1 : target, 0, x); return c
    })
    setSelectedId(id)
  }
  // 按鼠标 Y 相对字段卡片中点计算插入下标（原生 HTML5 DnD，无额外依赖）
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const cards = Array.from(canvasRef.current?.querySelectorAll("[data-field-id]") || []) as HTMLElement[]
    let idx = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { idx = i; break }
    }
    if (idx !== dropIndex) setDropIndex(idx)
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const at = dropIndex ?? fields.length
    const newType = e.dataTransfer.getData("text/x-new-field")
    const fieldId = e.dataTransfer.getData("text/x-field-id")
    setDropIndex(null); setDragging(false); setDragFieldId(null)
    if (newType) insertField(makeField(newType as FieldType), at)
    else if (fieldId) moveFieldTo(fieldId, at)
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
      <Card size="small" className="w-48 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>组件库</SectionTitle>
        <div className="grid grid-cols-1 gap-1.5">
          {FIELD_DEFS.map((d) => (
            <div key={d.type} draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/x-new-field", d.type); e.dataTransfer.effectAllowed = "copy"; setDragging(true) }}
              onDragEnd={() => { setDragging(false); setDropIndex(null) }}
              onClick={() => addField(d.type)}
              className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f1f] px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 cursor-grab select-none hover:border-indigo-300">
              <span>{d.icon}</span>{d.name}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 mb-0 leading-relaxed">拖拽组件到画布指定位置（或点击添加到末尾）；设计稿自动保存在浏览器本地。</p>
      </Card>

      {/* 画布 */}
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 mb-3">
          <SectionTitle>画布（{fields.length} 个字段）</SectionTitle>
          <div className="ml-auto flex gap-2">
            <Button size="small" onClick={() => setShowExport(true)} disabled={fields.length === 0}>📤 导出 Schema</Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: "清空所有字段？", okText: "清空", okButtonProps: { danger: true }, onOk: () => { setFields([]); setSelectedId(null) } })} disabled={fields.length === 0}>清空</Button>
          </div>
        </div>

        {fields.length === 0 && (
          <div onDragOver={(e) => { e.preventDefault(); if (dropIndex !== 0) setDropIndex(0) }} onDrop={handleDrop}
            className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-12 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
            从左侧拖拽组件到这里，开始搭建表单{dropIndex === 0 && dragging && <div className="h-0.5 mt-2 rounded bg-indigo-400" />}
          </div>
        )}

        <div ref={canvasRef} onDragOver={handleDragOver} onDrop={handleDrop} className="flex flex-col gap-2">
            {fields.map((f, i) => {
              const def = FIELD_DEFS.find((d) => d.type === f.type)!
              const active = selectedId === f.id
              return (
                <Fragment key={f.id}>
                  {dropIndex === i && dragging && <div className="h-0.5 rounded bg-indigo-400" />}
                  <div data-field-id={f.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/x-field-id", f.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); setDragFieldId(f.id) }}
                    onDragEnd={() => { setDragging(false); setDropIndex(null); setDragFieldId(null) }}
                    onClick={() => setSelectedId(f.id)}
                    className={`group rounded-lg border px-3 py-2.5 cursor-grab transition-all bg-white dark:bg-[#1f1f1f] ${dragFieldId === f.id ? "opacity-40" : ""} ${active ? "border-indigo-400" : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300 dark:text-zinc-600" title="拖拽排序">⠿</span>
                      <span>{def.icon}</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{f.label}</span>
                      {f.required && <span className="text-red-500 text-xs">*必填</span>}
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{def.name}</span>
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button size="small" title="上移" onClick={() => moveField(f.id, -1)}>↑</Button>
                        <Button size="small" title="下移" onClick={() => moveField(f.id, 1)}>↓</Button>
                        <Button size="small" danger title="删除" onClick={() => removeField(f.id)}>✕</Button>
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })}
            {dropIndex === fields.length && dragging && <div className="h-0.5 rounded bg-indigo-400" />}
        </div>
      </Card>

      {/* 实时预览：与画布并列居中，随画布即时更新 */}
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 mb-3">
          <SectionTitle>实时预览</SectionTitle>
          <span className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500">随画布即时更新</span>
        </div>
        {fields.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">添加字段后此处显示表单效果</div>}
        {fields.length > 0 && (
          <div className="flex flex-col gap-4">
            {fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                <FormPreviewControl f={f} value={formValues[f.id]} onChange={(v) => setFormValues((prev) => ({ ...prev, [f.id]: v }))} />
              </div>
            ))}
            <Button type="primary" className="self-start" onClick={() => setSubmitted(JSON.stringify(formValues, null, 2))}>提交（演示）</Button>
            {submitted && <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-lg p-3 overflow-x-auto">{submitted}</pre>}
          </div>
        )}
      </Card>

      {/* 属性：最右侧 */}
      <Card size="small" className="w-64 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>属性</SectionTitle>
        {!selected && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">选中画布中的字段进行配置</div>}
        {selected && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400">标题</label>
              <Input className="mt-1" value={selected.label} onChange={(e) => patchField(selected.id, { label: e.target.value })} />
            </div>
            {selected.type !== "switch" && (
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">占位提示</label>
                <Input className="mt-1" value={selected.placeholder || ""} onChange={(e) => patchField(selected.id, { placeholder: e.target.value })} />
              </div>
            )}
            <Checkbox checked={!!selected.required} onChange={(e) => patchField(selected.id, { required: e.target.checked })}>必填</Checkbox>
            {(selected.type === "select" || selected.type === "radio" || selected.type === "checkbox") && (
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">选项（每行一个）</label>
                <Input.TextArea className="mt-1" rows={4} value={(selected.options || []).join("\n")}
                  onChange={(e) => patchField(selected.id, { options: e.target.value.split("\n").filter((x) => x.trim() !== "") })} />
              </div>
            )}
            <Button size="small" danger className="self-start" onClick={() => removeField(selected.id)}>🗑 删除该字段</Button>
          </div>
        )}
      </Card>

      {/* 导出弹窗 */}
      <Modal open={showExport} onCancel={() => setShowExport(false)} title="导出 JSON Schema" width={680}
        footer={[<CopyBtn key="copy" text={JSON.stringify(formToSchema(fields), null, 2)} />, <Button key="close" onClick={() => setShowExport(false)}>关闭</Button>]}>
        <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-lg p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">{JSON.stringify(formToSchema(fields), null, 2)}</pre>
      </Modal>
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
/** 中性配色：节点类型图标底色 */
const KIND_COLOR: Record<FlowKind, string> = {
  trigger: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
  condition: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  action: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  delay: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
}

function FlowDesigner() {
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingAt, setAddingAt] = useState<number | null>(null) // 在第 N 个位置后插入
  const [showExport, setShowExport] = useState(false)
  const [dropIndex, setDropIndex] = useState<number | null>(null) // 拖拽插入位置指示
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

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
  // 按鼠标 Y 相对节点卡片中点计算插入下标（原生 HTML5 DnD）
  function flowDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const cards = Array.from(canvasRef.current?.querySelectorAll("[data-node-id]") || []) as HTMLElement[]
    let idx = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { idx = i; break }
    }
    if (idx !== dropIndex) setDropIndex(idx)
  }
  function flowDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const defIdxStr = e.dataTransfer.getData("text/x-flow-type")
    const at = dropIndex ?? nodes.length
    setDropIndex(null); setDragging(false)
    if (defIdxStr !== "") addNode(Number(defIdxStr), at)
  }
  function patchParams(id: string, key: string, value: string) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n)))
  }
  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const AddMenu = ({ at }: { at: number }) => (
    <Card size="small" className="w-56 shadow-md" styles={{ body: { padding: 6 } }}>
      <div className="flex flex-col gap-0.5">
        {FLOW_DEFS.map((d, di) => (
          <button key={d.type} onClick={() => addNode(di, at)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 text-left">
            <span>{d.icon}</span>{d.name}
            <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{{ trigger: "触发", condition: "条件", action: "动作", delay: "延时" }[d.kind]}</span>
          </button>
        ))}
      </div>
    </Card>
  )

  return (
    <div className="flex gap-4 items-start">
      {/* 节点库 */}
      <Card size="small" className="w-48 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>节点库</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {FLOW_DEFS.map((d, di) => (
            <div key={d.type} draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/x-flow-type", String(di)); e.dataTransfer.effectAllowed = "copy"; setDragging(true) }}
              onDragEnd={() => { setDragging(false); setDropIndex(null) }}
              onClick={() => addNode(di, nodes.length)}
              className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f1f] px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 cursor-grab select-none hover:border-indigo-300">
              <span>{d.icon}</span>{d.name}
              <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{{ trigger: "触发", condition: "条件", action: "动作", delay: "延时" }[d.kind]}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 mb-0 leading-relaxed">拖拽节点到画布指定位置（或点击添加到末尾）。</p>
      </Card>

      {/* 流程画布 */}
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center mb-3">
          <SectionTitle>流程画布（{nodes.length} 个节点）</SectionTitle>
          <div className="ml-auto flex gap-2">
            <Button size="small" onClick={() => setShowExport(true)} disabled={nodes.length === 0}>📤 导出 JSON</Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: "清空流程？", okText: "清空", okButtonProps: { danger: true }, onOk: () => { setNodes([]); setSelectedId(null) } })} disabled={nodes.length === 0}>清空</Button>
          </div>
        </div>

        <div ref={canvasRef} onDragOver={flowDragOver} onDrop={flowDrop} className="flex flex-col items-center gap-0 max-w-xl mx-auto py-2">
          <div className="px-4 py-1.5 rounded-full bg-zinc-700 text-white text-xs font-medium">▶ 开始</div>

          {nodes.map((n, i) => {
            const def = FLOW_DEFS.find((d) => d.type === n.type)!
            const active = selectedId === n.id
            return (
              <div key={n.id} data-node-id={n.id} className="flex flex-col items-center w-full">
                <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />
                {dropIndex === i && dragging && <div className="w-full h-0.5 rounded bg-indigo-400 my-0.5" />}
                <div onClick={() => setSelectedId(n.id)}
                  className={`group w-full rounded-lg border px-4 py-3 cursor-pointer transition-all bg-white dark:bg-[#1f1f1f] ${active ? "border-indigo-400" : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`grid h-7 w-7 place-items-center rounded-md text-sm ${KIND_COLOR[def.kind]}`}>{def.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{def.name}</div>
                      {def.params.length > 0 && (
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[260px]">
                          {def.params.map((p) => n.params[p]).filter(Boolean).join(" · ") || "未配置"}
                        </div>
                      )}
                    </div>
                    <Button size="small" danger className="ml-auto opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); removeNode(n.id) }}>✕</Button>
                  </div>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />
                  <button onClick={() => setAddingAt(addingAt === i ? null : i)}
                    className="grid h-5 w-5 place-items-center rounded-full bg-white dark:bg-[#1f1f1f] border border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 text-xs hover:border-indigo-400 hover:text-indigo-500 transition-colors">＋</button>
                  {addingAt === i && <div className="absolute top-6 z-20"><AddMenu at={i + 1} /></div>}
                </div>
              </div>
            )
          })}

          {nodes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4">
              {dragging && <div className="w-full h-0.5 rounded bg-indigo-400" />}
              {!dragging && (
                <>
                  <button onClick={() => setAddingAt(addingAt === -1 ? null : -1)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white dark:bg-[#1f1f1f] border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-indigo-400 hover:text-indigo-500">＋</button>
                  {addingAt === -1 && <AddMenu at={0} />}
                  <span className="text-zinc-400 dark:text-zinc-500 text-sm">从左侧拖拽节点到这里（或点击 ＋ 添加，建议先加触发器）</span>
                </>
              )}
            </div>
          )}

          {dropIndex === nodes.length && dragging && nodes.length > 0 && <div className="w-full h-0.5 rounded bg-indigo-400 my-0.5" />}
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600" />
          <div className="px-4 py-1.5 rounded-full bg-zinc-700 text-white text-xs font-medium">■ 结束</div>
        </div>
      </Card>

      {/* 节点配置 */}
      <Card size="small" className="w-64 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>节点配置</SectionTitle>
        {!selected && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">点击流程中的节点进行配置</div>}
        {selected && selectedDef && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`grid h-8 w-8 place-items-center rounded-md text-base ${KIND_COLOR[selectedDef.kind]}`}>{selectedDef.icon}</span>
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{selectedDef.name}</div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{{ trigger: "触发器", condition: "条件节点", action: "动作节点", delay: "延时节点" }[selectedDef.kind]}</div>
              </div>
            </div>
            {selectedDef.params.map((p) => (
              <div key={p}>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{p}</label>
                <Input className="mt-1" value={selected.params[p] || ""} onChange={(e) => patchParams(selected.id, p, e.target.value)} />
              </div>
            ))}
            {selectedDef.params.length === 0 && <div className="text-xs text-zinc-400 dark:text-zinc-500">该节点无需配置</div>}
            <Button size="small" danger className="self-start" onClick={() => removeNode(selected.id)}>🗑 删除节点</Button>
          </div>
        )}
      </Card>

      <Modal open={showExport} onCancel={() => setShowExport(false)} title="导出流程 JSON" width={680}
        footer={[<CopyBtn key="copy" text={JSON.stringify({ nodes }, null, 2)} />, <Button key="close" onClick={() => setShowExport(false)}>关闭</Button>]}>
        <pre className="text-xs bg-zinc-900 text-emerald-300 rounded-lg p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">{JSON.stringify({ nodes }, null, 2)}</pre>
      </Modal>
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

  const modelColumns = [
    { title: "字段名", render: (_: any, f: ModelField, i: number) => <Input size="small" placeholder="field_name" value={f.name} onChange={(e) => patch(i, { name: e.target.value })} /> },
    { title: "类型", width: 130, render: (_: any, f: ModelField, i: number) => <Select size="small" className="!w-full" value={f.type} onChange={(v) => patch(i, { type: v })} options={MODEL_TYPES.map((t) => ({ value: t, label: t }))} /> },
    { title: "必填", width: 70, align: "center" as const, render: (_: any, f: ModelField, i: number) => <Checkbox checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> },
    { title: "默认值", width: 140, render: (_: any, f: ModelField, i: number) => <Input size="small" placeholder="可选" value={f.def} onChange={(e) => patch(i, { def: e.target.value })} /> },
    { title: "备注", render: (_: any, f: ModelField, i: number) => <Input size="small" placeholder="字段说明" value={f.note} onChange={(e) => patch(i, { note: e.target.value })} /> },
    { title: "", width: 60, align: "center" as const, render: (_: any, _f: ModelField, i: number) => <Button size="small" danger onClick={() => setFields((prev) => prev.filter((_x, j) => j !== i))}>✕</Button> },
  ]

  return (
    <div className="flex gap-4 items-start">
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <SectionTitle>模型定义</SectionTitle>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">模型名</span>
          <Input className="max-w-[240px]" placeholder="如 orders" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="small" className="ml-auto" onClick={() => setFields((prev) => [...prev, { name: "", type: "string", required: false, def: "", note: "" }])}>＋ 添加字段</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: "清空模型？", okText: "清空", okButtonProps: { danger: true }, onOk: () => { setFields([]); setName("") } })} disabled={fields.length === 0}>清空</Button>
        </div>
        {fields.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-10">点击「添加字段」开始定义数据模型</div>}
        {fields.length > 0 && (
          <Table rowKey={(_r, i) => String(i)} size="small" columns={modelColumns as any}
            dataSource={fields} pagination={false} />
        )}
      </Card>

      <div className="w-[42%] shrink-0 flex flex-col gap-4">
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 SQL DDL</SectionTitle>
            <CopyBtn text={sql} />
          </div>
          <pre className="text-[11px] bg-zinc-900 text-sky-300 rounded-lg p-3 overflow-x-auto max-h-56 overflow-y-auto">{sql}</pre>
        </Card>
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 JSON Schema</SectionTitle>
            <CopyBtn text={schema} />
          </div>
          <pre className="text-[11px] bg-zinc-900 text-emerald-300 rounded-lg p-3 overflow-x-auto max-h-56 overflow-y-auto">{schema}</pre>
        </Card>
      </div>
    </div>
  )
}

// ================= 页面外壳 =================
export default function LowCodePage() {
  return (
    <div className="flex flex-col gap-2">
      <Tabs
        defaultActiveKey="form"
        items={[
          { key: "form", label: "📋 表单设计器", children: <FormDesigner /> },
          { key: "flow", label: "🔀 流程编排", children: <FlowDesigner /> },
          { key: "model", label: "🗃️ 数据模型", children: <DataModeler /> },
        ]}
      />
      <div className="text-xs text-zinc-400 dark:text-zinc-500 -mt-2">可视化搭建 · 设计稿保存在浏览器本地 · 支持导出标准格式</div>
    </div>
  )
}
