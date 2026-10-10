"use client"
// 低代码平台 · 单字段控件渲染
//
// ⚠️ 预览与运行时必须共用这一个组件：两边各写一份渲染，就会出现
// 「预览里好好的、运行时样式/校验不一样」的经典失配。校验口径见 _lib/core 的 validateField。

import { Button, Checkbox, DatePicker, Input, InputNumber, Radio, Select, Switch } from "antd"
import type { Field } from "../_lib/core"

export function FieldControl({ f, value, onChange, disabled }: {
  f: Field
  value: any
  onChange: (v: any) => void
  disabled?: boolean
}) {
  switch (f.type) {
    case "textarea":
      return <Input.TextArea rows={3} disabled={disabled} placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    case "number":
      return <InputNumber className="!w-full" disabled={disabled} placeholder={f.placeholder}
        value={value === "" || value == null ? null : Number(value)} onChange={(v) => onChange(v ?? "")} />
    case "date":
      return <DatePicker className="!w-full" disabled={disabled} onChange={(_d, ds) => onChange(Array.isArray(ds) ? ds[0] : ds)} />
    case "select":
      return <Select className="w-full" disabled={disabled} value={value || undefined} onChange={onChange} placeholder="请选择"
        options={(f.options || []).map((o) => ({ value: o, label: o }))} />
    case "radio":
      return (
        <Radio.Group disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
          {(f.options || []).map((o) => <Radio key={o} value={o}>{o}</Radio>)}
        </Radio.Group>
      )
    case "checkbox":
      return <Checkbox.Group disabled={disabled} options={f.options || []} value={Array.isArray(value) ? value : []} onChange={(v) => onChange(v as string[])} />
    case "switch":
      return <Switch disabled={disabled} checked={!!value} onChange={(v) => onChange(v)} />
    case "subform":
      return <SubFormControl f={f} value={value} onChange={onChange} disabled={disabled} />
    default:
      return <Input disabled={disabled} placeholder={f.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  }
}

/** 子表单：对象数组，可增删行；列 = children 字段 */
function SubFormControl({ f, value, onChange, disabled }: { f: Field; value: any; onChange: (v: any) => void; disabled?: boolean }) {
  const rows: any[] = Array.isArray(value) ? value : []
  const cols = f.children || []
  function patchRow(i: number, key: string, v: any) {
    const next = rows.map((r, j) => (j === i ? { ...r, [key]: v } : r))
    onChange(next)
  }
  function addRow() {
    const seed: any = {}
    for (const c of cols) seed[c.id] = c.type === "checkbox" ? [] : ""
    onChange([...rows, seed])
  }
  function delRow(i: number) { onChange(rows.filter((_r, j) => j !== i)) }

  if (cols.length === 0) {
    return <div className="text-xs text-zinc-400 dark:text-zinc-500 py-2">子表单还没有字段，请在右侧「子字段」里添加</div>
  }
  return (
    <div className="flex flex-col gap-2 w-full">
      {rows.map((r, i) => (
        <div key={i} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 flex flex-col gap-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, minmax(0,1fr))` }}>
            {cols.map((c) => (
              <div key={c.id} className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{c.label}</span>
                <FieldControl f={c} value={r?.[c.id]} onChange={(v) => patchRow(i, c.id, v)} disabled={disabled} />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="small" danger disabled={disabled} onClick={() => delRow(i)}>删除本行</Button>
          </div>
        </div>
      ))}
      <Button size="small" className="self-start" disabled={disabled} onClick={addRow}>＋ 添加一行</Button>
    </div>
  )
}
