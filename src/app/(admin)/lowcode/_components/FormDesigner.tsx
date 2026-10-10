"use client"
// 低代码平台 · 表单设计器（深化版）：栅格布局 / 校验规则 / 条件显隐 / 子表单
import { Fragment, useRef, useState, type DragEvent } from "react"
import { Button, Card, Checkbox, Col, Input, InputNumber, Modal, Radio, Row, Segmented, Select, Tooltip } from "antd"
import { DeleteOutlined } from "@ant-design/icons"
import {
  FIELD_DEFS, VISIBLE_OPS, formToSchema, isVisible, validateField,
  type Field, type FieldType, type FormPlan,
} from "../_lib/core"
import { CodeBlock, ExportModal, SectionTitle } from "./ui"
import { FieldControl } from "./FieldControl"

/** 3 列栅格：span 1/2/3 → antd 24 栅格下的 8/16/24 */
function spanToCol(span: number | undefined): number {
  return span === 1 ? 8 : span === 2 ? 16 : 24
}

function makeField(type: FieldType): Field {
  const def = FIELD_DEFS.find((d) => d.type === type)!
  const hasOptions = type === "select" || type === "radio" || type === "checkbox"
  return {
    id: "f" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    type,
    label: def.name,
    placeholder: "",
    required: false,
    options: hasOptions ? ["选项一", "选项二"] : undefined,
    span: 3,
    rules: {},
    visibleWhen: null,
    children: type === "subform" ? [] : undefined,
  }
}

export default function FormDesigner({ plan, onPatch }: {
  plan: FormPlan | null
  onPatch: (patch: Partial<FormPlan>) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<"design" | "preview">("design")
  const [showExport, setShowExport] = useState(false)
  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState("")
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const fields: Field[] = plan?.fields || []
  const setFields = (next: Field[]) => onPatch({ fields: next })
  const selected = fields.find((f) => f.id === selectedId) || null

  function insertField(f: Field, at: number) {
    const c = [...fields]; c.splice(Math.min(at, c.length), 0, f)
    setFields(c); setSelectedId(f.id)
  }
  function moveFieldTo(id: string, target: number) {
    const from = fields.findIndex((f) => f.id === id)
    if (from < 0) return
    const c = [...fields]; const [x] = c.splice(from, 1)
    c.splice(from < target ? target - 1 : target, 0, x)
    setFields(c); setSelectedId(id)
  }
  function patchField(id: string, patch: Partial<Field>) {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function moveField(id: string, dir: -1 | 1) {
    const i = fields.findIndex((f) => f.id === id)
    if (i < 0 || i + dir < 0 || i + dir >= fields.length) return
    const c = [...fields]; const [x] = c.splice(i, 1); c.splice(i + dir, 0, x)
    setFields(c)
  }
  function removeField(id: string) {
    setFields(fields.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

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

  /** 预览提交：走与运行时同一套 validateField，保证「设计器里能过、运行时也能过」 */
  function submitPreview() {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (!isVisible(f.visibleWhen, values)) continue
      const e = validateField(f, values[f.id])
      if (e) errs[f.id] = e
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitted(JSON.stringify(values, null, 2))
  }

  if (!plan) {
    return <Card size="small"><div className="text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center">请先在上方新建或选择一个表单方案</div></Card>
  }

  const schemaText = JSON.stringify(formToSchema(fields), null, 2)

  return (
    <div className="flex gap-4 items-start">
      {/* 组件库 */}
      <Card size="small" className="w-44 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>组件库</SectionTitle>
        <div className="grid grid-cols-1 gap-1.5">
          {FIELD_DEFS.map((d) => (
            <div key={d.type} draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/x-new-field", d.type); e.dataTransfer.effectAllowed = "copy"; setDragging(true) }}
              onDragEnd={() => { setDragging(false); setDropIndex(null) }}
              onClick={() => { const f = makeField(d.type); setFields([...fields, f]); setSelectedId(f.id) }}
              className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f1f] px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 cursor-grab select-none hover:border-indigo-300">
              <span>{d.icon}</span>{d.name}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 mb-0 leading-relaxed">拖拽到画布指定位置（或点击添加到末尾）。</p>
      </Card>

      {/* 画布 / 预览 */}
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Segmented size="small" value={tab} onChange={(v) => setTab(v as any)}
            options={[{ label: "设计画布", value: "design" }, { label: "实时预览", value: "preview" }]} />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{fields.length} 个字段</span>
          <div className="ml-auto flex gap-2">
            <Button size="small" onClick={() => setShowExport(true)} disabled={fields.length === 0}>📤 导出 Schema</Button>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={fields.length === 0}
              onClick={() => Modal.confirm({ title: "清空所有字段？", okText: "清空", okButtonProps: { danger: true }, onOk: () => { setFields([]); setSelectedId(null) } })}>清空</Button>
          </div>
        </div>

        {tab === "design" && (
          <>
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
                const tags: string[] = []
                if (f.span && f.span !== 3) tags.push(`${f.span}/3 宽`)
                if (f.rules && Object.values(f.rules).some((v) => v != null && v !== "")) tags.push("校验")
                if (f.visibleWhen?.field) tags.push("条件显隐")
                if (f.type === "subform") tags.push(`${(f.children || []).length} 子字段`)
                return (
                  <Fragment key={f.id}>
                    {dropIndex === i && dragging && <div className="h-0.5 rounded bg-indigo-400" />}
                    <div data-field-id={f.id} draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/x-field-id", f.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); setDragFieldId(f.id) }}
                      onDragEnd={() => { setDragging(false); setDropIndex(null); setDragFieldId(null) }}
                      onClick={() => setSelectedId(f.id)}
                      className={`group rounded-lg border px-3 py-2.5 cursor-grab transition-all bg-white dark:bg-[#1f1f1f] ${dragFieldId === f.id ? "opacity-40" : ""} ${active ? "border-indigo-400" : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-300 dark:text-zinc-600" title="拖拽排序">⠿</span>
                        <span>{def.icon}</span>
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{f.label}</span>
                        {f.required && <span className="text-red-500 text-xs">*必填</span>}
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{def.name}</span>
                        {tags.map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">{t}</span>
                        ))}
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
          </>
        )}

        {tab === "preview" && (
          <div>
            {fields.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">添加字段后此处显示表单效果</div>}
            <Row gutter={[12, 12]}>
              {fields.map((f) => {
                if (!isVisible(f.visibleWhen, values)) return null
                const err = errors[f.id]
                return (
                  <Col key={f.id} span={spanToCol(f.span)}>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <FieldControl f={f} value={values[f.id]} onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))} />
                      {err && <span className="text-xs text-red-500">{err}</span>}
                    </div>
                  </Col>
                )
              })}
            </Row>
            {fields.length > 0 && (
              <>
                <Button type="primary" className="mt-4" onClick={submitPreview}>提交（演示）</Button>
                {submitted && <div className="mt-3"><CodeBlock text={submitted} maxH="240px" /></div>}
              </>
            )}
          </div>
        )}
      </Card>

      {/* 属性 */}
      <Card size="small" className="w-72 shrink-0" styles={{ body: { padding: 12, maxHeight: "70vh", overflowY: "auto" } }}>
        <SectionTitle>属性</SectionTitle>
        {!selected && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">选中画布中的字段进行配置</div>}
        {selected && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400">标题</label>
              <Input className="mt-1" size="small" value={selected.label} onChange={(e) => patchField(selected.id, { label: e.target.value })} />
            </div>
            {selected.type !== "switch" && selected.type !== "subform" && (
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">占位提示</label>
                <Input className="mt-1" size="small" value={selected.placeholder || ""} onChange={(e) => patchField(selected.id, { placeholder: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-4">
              <Checkbox checked={!!selected.required} onChange={(e) => patchField(selected.id, { required: e.target.checked })}>必填</Checkbox>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">宽度</span>
                <Radio.Group size="small" value={selected.span || 3} onChange={(e) => patchField(selected.id, { span: e.target.value })}
                  options={[{ label: "1/3", value: 1 }, { label: "2/3", value: 2 }, { label: "整行", value: 3 }]} optionType="button" buttonStyle="solid" />
              </div>
            </div>

            {(selected.type === "select" || selected.type === "radio" || selected.type === "checkbox") && (
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">选项（每行一个）</label>
                <Input.TextArea className="mt-1" rows={4} size="small" value={(selected.options || []).join("\n")}
                  onChange={(e) => patchField(selected.id, { options: e.target.value.split("\n").filter((x) => x.trim() !== "") })} />
              </div>
            )}

            {/* 子表单字段 */}
            {selected.type === "subform" && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">子字段（{(selected.children || []).length}）</span>
                  <Select<FieldType> size="small" className="!w-28" placeholder="＋ 添加" value={undefined}
                    onChange={(t) => {
                      const nf = makeField(t)
                      patchField(selected.id, { children: [...(selected.children || []), nf] })
                    }}
                    options={FIELD_DEFS.filter((d) => d.type !== "subform").map((d) => ({ value: d.type, label: d.name }))} />
                </div>
                {(selected.children || []).length === 0 && <div className="text-[11px] text-zinc-400 dark:text-zinc-500">用右上角下拉添加子字段（不支持再嵌套子表单）</div>}
                <div className="flex flex-col gap-1.5">
                  {(selected.children || []).map((c) => (
                    <div key={c.id} className="flex items-center gap-1">
                      <Input size="small" className="flex-1" value={c.label} placeholder="标题"
                        onChange={(e) => patchField(selected.id, { children: (selected.children || []).map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })} />
                      <Tooltip title="必填">
                        <Checkbox checked={!!c.required}
                          onChange={(e) => patchField(selected.id, { children: (selected.children || []).map((x) => (x.id === c.id ? { ...x, required: e.target.checked } : x)) })} />
                      </Tooltip>
                      <Button size="small" danger onClick={() => patchField(selected.id, { children: (selected.children || []).filter((x) => x.id !== c.id) })}>✕</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 校验规则 */}
            {selected.type !== "subform" && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">校验规则</div>
                {selected.type === "number" ? (
                  <div className="flex items-center gap-2">
                    <InputNumber size="small" className="!w-20" placeholder="最小" value={selected.rules?.min ?? null}
                      onChange={(v) => patchField(selected.id, { rules: { ...(selected.rules || {}), min: v ?? null } })} />
                    <span className="text-xs text-zinc-400">~</span>
                    <InputNumber size="small" className="!w-20" placeholder="最大" value={selected.rules?.max ?? null}
                      onChange={(v) => patchField(selected.id, { rules: { ...(selected.rules || {}), max: v ?? null } })} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <InputNumber size="small" className="!w-24" placeholder="最短" value={selected.rules?.minLen ?? null}
                        onChange={(v) => patchField(selected.id, { rules: { ...(selected.rules || {}), minLen: v ?? null } })} />
                      <InputNumber size="small" className="!w-24" placeholder="最长" value={selected.rules?.maxLen ?? null}
                        onChange={(v) => patchField(selected.id, { rules: { ...(selected.rules || {}), maxLen: v ?? null } })} />
                    </div>
                    {selected.type !== "switch" && (
                      <Input size="small" placeholder="正则，如 ^1[3-9]\\d{9}$" value={selected.rules?.pattern || ""}
                        onChange={(e) => patchField(selected.id, { rules: { ...(selected.rules || {}), pattern: e.target.value } })} />
                    )}
                  </div>
                )}
                <Input size="small" className="mt-1.5" placeholder="自定义错误提示（可选）" value={selected.rules?.message || ""}
                  onChange={(e) => patchField(selected.id, { rules: { ...(selected.rules || {}), message: e.target.value } })} />
              </div>
            )}

            {/* 条件显隐 */}
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">条件显隐</span>
                {selected.visibleWhen?.field && (
                  <Button size="small" type="link" onClick={() => patchField(selected.id, { visibleWhen: null })}>清除</Button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Select size="small" placeholder="参照字段" value={selected.visibleWhen?.field || undefined}
                  onChange={(v) => patchField(selected.id, { visibleWhen: { field: v, op: selected.visibleWhen?.op || "eq", value: selected.visibleWhen?.value || "" } })}
                  options={fields.filter((f) => f.id !== selected.id && f.type !== "subform").map((f) => ({ value: f.id, label: f.label }))} />
                {selected.visibleWhen?.field && (
                  <div className="flex items-center gap-1.5">
                    <Select size="small" className="!w-24" value={selected.visibleWhen?.op || "eq"}
                      onChange={(v) => patchField(selected.id, { visibleWhen: { ...(selected.visibleWhen!), op: v } })}
                      options={VISIBLE_OPS.map((o) => ({ value: o.value, label: o.label }))} />
                    {selected.visibleWhen.op !== "empty" && selected.visibleWhen.op !== "notEmpty" && (
                      <Input size="small" className="flex-1" placeholder="比较值"
                        value={selected.visibleWhen?.value || ""}
                        onChange={(e) => patchField(selected.id, { visibleWhen: { ...(selected.visibleWhen!), value: e.target.value } })} />
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button size="small" danger className="self-start" onClick={() => removeField(selected.id)}>🗑 删除该字段</Button>
          </div>
        )}
      </Card>

      <ExportModal open={showExport} onClose={() => setShowExport(false)} title="导出 JSON Schema" text={schemaText} />
    </div>
  )
}
