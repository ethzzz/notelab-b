"use client"
// 低代码平台 · 数据模型（深化版）：字段带唯一 / 索引 / 关联，模型之间可互相引用
import { Button, Card, Checkbox, Input, Select, Table } from "antd"
import { DeleteOutlined } from "@ant-design/icons"
import { MODEL_TYPES, modelToSchema, modelToSql, type ModelField, type ModelPlan } from "../_lib/core"
import { CodeBlock, CopyBtn, SectionTitle } from "./ui"

export default function DataModeler({ plan, onPatch, allModels }: {
  plan: ModelPlan | null
  onPatch: (patch: Partial<ModelPlan>) => void
  /** 同库其它模型，用于「关联」下拉（引用别的模型的字段） */
  allModels: ModelPlan[]
}) {
  if (!plan) {
    return <Card size="small"><div className="text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center">请先在上方新建或选择一个数据模型</div></Card>
  }
  const fields: ModelField[] = plan.fields || []
  const table = plan.table || ""
  const setFields = (next: ModelField[]) => onPatch({ fields: next })
  function patch(i: number, p: Partial<ModelField>) {
    setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f)))
  }

  /** 关联候选：其它模型的字段，形如 orders.id */
  const refOptions = allModels
    .filter((m) => m.id !== plan.id && (m.table || m.name))
    .flatMap((m) => (m.fields || []).filter((f) => f.name.trim())
      .map((f) => ({ value: `${m.table || m.name}.${f.name}`, label: `${m.table || m.name}.${f.name}` })))

  const columns = [
    {
      title: "字段名", render: (_: any, f: ModelField, i: number) => (
        <Input size="small" placeholder="field_name" value={f.name} onChange={(e) => patch(i, { name: e.target.value })} />
      ),
    },
    {
      title: "类型", width: 120, render: (_: any, f: ModelField, i: number) => (
        <Select size="small" className="!w-full" value={f.type} onChange={(v) => patch(i, { type: v })}
          options={MODEL_TYPES.map((t) => ({ value: t, label: t }))} />
      ),
    },
    {
      title: "必填", width: 60, align: "center" as const, render: (_: any, f: ModelField, i: number) => (
        <Checkbox checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} />
      ),
    },
    {
      title: "唯一", width: 60, align: "center" as const, render: (_: any, f: ModelField, i: number) => (
        <Checkbox checked={!!f.unique} onChange={(e) => patch(i, { unique: e.target.checked, index: e.target.checked ? false : f.index })} />
      ),
    },
    {
      title: "索引", width: 60, align: "center" as const, render: (_: any, f: ModelField, i: number) => (
        <Checkbox checked={!!f.index} onChange={(e) => patch(i, { index: e.target.checked, unique: e.target.checked ? false : f.unique })} />
      ),
    },
    {
      title: "默认值", width: 120, render: (_: any, f: ModelField, i: number) => (
        <Input size="small" placeholder="可选" value={f.def} onChange={(e) => patch(i, { def: e.target.value })} />
      ),
    },
    {
      title: "关联", width: 150, render: (_: any, f: ModelField, i: number) => (
        <Select size="small" className="!w-full" allowClear placeholder="可选" value={f.ref || undefined}
          onChange={(v) => patch(i, { ref: v || "" })} options={refOptions} />
      ),
    },
    {
      title: "备注", render: (_: any, f: ModelField, i: number) => (
        <Input size="small" placeholder="字段说明" value={f.note} onChange={(e) => patch(i, { note: e.target.value })} />
      ),
    },
    {
      title: "", width: 50, align: "center" as const, render: (_: any, _f: ModelField, i: number) => (
        <Button size="small" danger onClick={() => setFields(fields.filter((_x, j) => j !== i))}>✕</Button>
      ),
    },
  ]

  const sql = modelToSql(table, fields)
  const schema = JSON.stringify(modelToSchema(table, fields), null, 2)

  return (
    <div className="flex gap-4 items-start">
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <SectionTitle>模型定义</SectionTitle>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">表名</span>
          <Input className="max-w-[200px]" size="small" placeholder="如 orders" value={table}
            onChange={(e) => onPatch({ table: e.target.value })} />
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">「唯一」与「索引」互斥，勾选其一即可</span>
          <Button size="small" className="ml-auto" onClick={() => setFields([...fields, { name: "", type: "string", required: false, def: "", note: "" }])}>＋ 添加字段</Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={fields.length === 0}
            onClick={() => setFields([])}>清空字段</Button>
        </div>
        {fields.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-10">点击「添加字段」开始定义数据模型</div>}
        {fields.length > 0 && (
          <Table rowKey={(_r, i) => String(i)} size="small" columns={columns as any} dataSource={fields} pagination={false} scroll={{ x: 900 }} />
        )}
      </Card>

      <div className="w-[40%] shrink-0 flex flex-col gap-4">
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 SQL DDL</SectionTitle>
            <CopyBtn text={sql} />
          </div>
          <CodeBlock text={sql} maxH="240px" />
        </Card>
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>生成 JSON Schema</SectionTitle>
            <CopyBtn text={schema} />
          </div>
          <CodeBlock text={schema} maxH="240px" />
        </Card>
      </div>
    </div>
  )
}
