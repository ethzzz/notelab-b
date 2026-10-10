"use client"
// 低代码平台 · CRUD 页面生成器：数据模型 → 列表页 / 表单页配置 → 导出 React + antd 代码
import { useEffect, useState } from "react"
import { Button, Card, Checkbox, Input, InputNumber, Select, Table, Tabs } from "antd"
import { toast } from "@/lib/toast"
import { ACTION_LABEL, PAGE_ACTIONS, type ModelPlan, type PagePlan } from "../_lib/core"
import { genPageCode } from "../_lib/codegen"
import { CodeBlock, CopyBtn, ExportModal, SectionTitle } from "./ui"

const QUERY_CONTROLS = [
  { value: "input", label: "输入框" },
  { value: "select", label: "下拉选择" },
  { value: "dateRange", label: "日期区间" },
  { value: "numberRange", label: "数值" },
]

export default function PageGenerator({ plan, onPatch, models }: {
  plan: PagePlan | null
  onPatch: (patch: Partial<PagePlan>) => void
  models: ModelPlan[]
}) {
  const [showExport, setShowExport] = useState(false)
  const [tab, setTab] = useState<"list" | "form">("list")

  const model = models.find((m) => m.id === plan?.modelId) || null
  const fields = (model?.fields || []).filter((f) => f.name.trim())

  // 切换模型 → 用该模型字段初始化三份配置（已有配置不覆盖，避免用户配到一半被重置）
  useEffect(() => {
    if (!plan || !model) return
    const names = fields.map((f) => f.name)
    const cols = plan.list?.columns || []
    const q = plan.list?.query || []
    const ff = plan.form?.fields || []
    const patch: Partial<PagePlan> = {}
    if (cols.length === 0 && names.length) {
      patch.list = {
        columns: names.map((n) => ({ name: n, title: n, sortable: false, ellipsis: false })),
        query: q, actions: plan.list?.actions || ["create", "edit", "delete"], pageSize: plan.list?.pageSize || 10,
      }
    }
    if (ff.length === 0 && names.length) patch.form = { fields: names, width: plan.form?.width || 520 }
    if (Object.keys(patch).length) onPatch(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.modelId, model?.fields?.length])

  if (!plan) {
    return <Card size="small"><div className="text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center">请先在上方新建或选择一个页面方案</div></Card>
  }

  function patchList(p: Partial<PagePlan["list"]>) {
    onPatch({ list: { columns: plan!.list?.columns || [], query: plan!.list?.query || [], actions: plan!.list?.actions || [], pageSize: plan!.list?.pageSize || 10, ...p } })
  }
  function patchForm(p: Partial<PagePlan["form"]>) {
    onPatch({ form: { fields: plan!.form?.fields || [], width: plan!.form?.width || 520, ...p } })
  }

  const columns = plan.list?.columns || []
  const queries = plan.list?.query || []
  const actions = plan.list?.actions || []
  const formFields = plan.form?.fields || []

  const code = genPageCode(plan, model)

  const colTable = [
    {
      title: "作为列", width: 70, align: "center" as const,
      render: (_: any, f: any) => {
        const on = columns.some((c) => c.name === f.name)
        return <Checkbox checked={on} onChange={(e) => {
          if (e.target.checked) patchList({ columns: [...columns, { name: f.name, title: f.note || f.name }] })
          else patchList({ columns: columns.filter((c) => c.name !== f.name) })
        }} />
      },
    },
    { title: "字段", width: 140, render: (_: any, f: any) => <span className="font-mono text-xs">{f.name}</span> },
    {
      title: "列标题", width: 160,
      render: (_: any, f: any) => {
        const c = columns.find((x) => x.name === f.name)
        if (!c) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
        return <Input size="small" value={c.title} onChange={(e) => patchList({ columns: columns.map((x) => (x.name === f.name ? { ...x, title: e.target.value } : x)) })} />
      },
    },
    {
      title: "宽度", width: 100,
      render: (_: any, f: any) => {
        const c = columns.find((x) => x.name === f.name)
        if (!c) return null
        return <InputNumber size="small" className="!w-16" placeholder="自适应" value={c.width ?? null}
          onChange={(v) => patchList({ columns: columns.map((x) => (x.name === f.name ? { ...x, width: v ?? undefined } : x)) })} />
      },
    },
    {
      title: "排序", width: 60, align: "center" as const,
      render: (_: any, f: any) => {
        const c = columns.find((x) => x.name === f.name)
        if (!c) return null
        return <Checkbox checked={!!c.sortable} onChange={(e) => patchList({ columns: columns.map((x) => (x.name === f.name ? { ...x, sortable: e.target.checked } : x)) })} />
      },
    },
    {
      title: "超长省略", width: 80, align: "center" as const,
      render: (_: any, f: any) => {
        const c = columns.find((x) => x.name === f.name)
        if (!c) return null
        return <Checkbox checked={!!c.ellipsis} onChange={(e) => patchList({ columns: columns.map((x) => (x.name === f.name ? { ...x, ellipsis: e.target.checked } : x)) })} />
      },
    },
  ]

  const queryTable = [
    {
      title: "查询项", width: 70, align: "center" as const,
      render: (_: any, f: any) => {
        const on = queries.some((q) => q.name === f.name)
        return <Checkbox checked={on} onChange={(e) => {
          if (e.target.checked) patchList({ query: [...queries, { name: f.name, label: f.note || f.name, control: f.type === "date" ? "dateRange" : f.type === "enum" ? "select" : "input" }] })
          else patchList({ query: queries.filter((q) => q.name !== f.name) })
        }} />
      },
    },
    { title: "字段", width: 140, render: (_: any, f: any) => <span className="font-mono text-xs">{f.name}</span> },
    {
      title: "标签", width: 150,
      render: (_: any, f: any) => {
        const q = queries.find((x) => x.name === f.name)
        if (!q) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
        return <Input size="small" value={q.label} onChange={(e) => patchList({ query: queries.map((x) => (x.name === f.name ? { ...x, label: e.target.value } : x)) })} />
      },
    },
    {
      title: "控件",
      render: (_: any, f: any) => {
        const q = queries.find((x) => x.name === f.name)
        if (!q) return null
        return <Select size="small" className="!w-32" value={q.control}
          onChange={(v) => patchList({ query: queries.map((x) => (x.name === f.name ? { ...x, control: v } : x)) })}
          options={QUERY_CONTROLS.map((c) => ({ value: c.value, label: c.label }))} />
      },
    },
  ]

  return (
    <div className="flex gap-4 items-start">
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">数据模型</span>
          <Select size="small" className="!w-64" placeholder="选择一个数据模型" value={plan.modelId || undefined}
            onChange={(id) => {
              const m = models.find((x) => x.id === id)
              onPatch({ modelId: id, modelName: m?.table || m?.name || "", list: { columns: [], query: [], actions: ["create", "edit", "delete"], pageSize: 10 }, form: { fields: [], width: 520 } })
            }}
            options={models.map((m) => ({ value: m.id, label: `${m.name}（${m.table || "未设表名"}）` }))} />
          <Button size="small" className="ml-auto" disabled={!model}
            onClick={() => {
              setShowExport(true)
              if (!model) toast.warning("请先选择数据模型")
            }}>📄 生成页面代码</Button>
        </div>

        {!model && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-10">先选一个数据模型，再从它的字段里挑列 / 查询项 / 表单字段</div>}

        {model && (
          <Tabs size="small" activeKey={tab} onChange={(v) => setTab(v as any)} items={[
            {
              key: "list", label: "列表页配置", children: (
                <div className="flex flex-col gap-4">
                  <div>
                    <SectionTitle>表格列（{columns.length}）</SectionTitle>
                    <Table rowKey="name" size="small" pagination={false} columns={colTable as any} dataSource={fields} />
                  </div>
                  <div>
                    <SectionTitle>查询条件（{queries.length}）</SectionTitle>
                    <Table rowKey="name" size="small" pagination={false} columns={queryTable as any} dataSource={fields} />
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">操作按钮</span>
                      <Checkbox.Group value={actions} onChange={(v) => patchList({ actions: v as string[] })}
                        options={PAGE_ACTIONS.map((a) => ({ value: a, label: ACTION_LABEL[a] }))} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">每页条数</span>
                      <InputNumber size="small" className="!w-20" min={5} max={100} value={plan.list?.pageSize || 10}
                        onChange={(v) => patchList({ pageSize: v || 10 })} />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "form", label: "表单页配置", children: (
                <div className="flex flex-col gap-3">
                  <SectionTitle>表单字段（{formFields.length}）</SectionTitle>
                  <Checkbox.Group value={formFields} onChange={(v) => patchForm({ fields: v as string[] })}
                    options={fields.map((f) => ({ value: f.name, label: f.note || f.name }))} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">弹窗宽度</span>
                    <InputNumber size="small" className="!w-24" min={360} max={1200} value={plan.form?.width || 520}
                      onChange={(v) => patchForm({ width: v || 520 })} />
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-0">
                    生成代码时按这里勾选的顺序渲染表单项；控件类型由模型的字段类型推导（number→数字框、boolean→开关、text→多行、date→日期、enum→下拉）。
                  </p>
                </div>
              ),
            },
          ]} />
        )}
      </Card>

      <Card size="small" className="w-[42%] shrink-0" styles={{ body: { padding: 12 } }}>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>生成的代码预览</SectionTitle>
          <div className="flex gap-2">
            <CopyBtn text={code} />
            <Button size="small" onClick={() => setShowExport(true)}>放大</Button>
          </div>
        </div>
        <CodeBlock text={code} maxH="70vh" />
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 mb-0">
          代码里的 <span className="font-mono">fetchList</span> / <span className="font-mono">saveRow</span> 是占位实现，
          替换成真实接口即可直接放进 B 端页面使用。
        </p>
      </Card>

      <ExportModal open={showExport} onClose={() => setShowExport(false)} title="生成的页面代码" text={code} width={900} />
    </div>
  )
}
