"use client"
// 低代码平台（B 端 /admin/lowcode）
//
// 设计稿存后端（ui_config 的 lowcode 键，整包覆盖写），不再存 localStorage —— 换设备/多人都能用。
// ⚠️ 覆盖写 ⇒ 保存必须提交四类方案的完整列表；因此「保存」是页面顶部的一个全局按钮，
//   而不是每个 Tab 各存一次（各存一次会互相覆盖，同类方案在同一个数组里）。
import { useCallback, useEffect, useState } from "react"
import { Button, Card, Tabs, Tag } from "antd"
import { CloudUploadOutlined } from "@ant-design/icons"
import { toast } from "@/lib/toast"
import { emptyPlan, nowStamp, uid, type FormPlan, type ModelPlan, type PagePlan, type Plan } from "./_lib/core"
import { loadLowCode, saveLowCode, type LowCodeConfig, type PlanKind } from "./_lib/api"
import { PlanBar } from "./_components/ui"
import FormDesigner from "./_components/FormDesigner"
import FlowDesigner from "./_components/FlowDesigner"
import DataModeler from "./_components/DataModeler"
import PageGenerator from "./_components/PageGenerator"
import RuntimeRunner from "./_components/RuntimeRunner"

type TabKey = "form" | "flow" | "model" | "page" | "run"

const TAB_KIND: Record<TabKey, PlanKind | null> = {
  form: "forms", flow: "flows", model: "models", page: "pages", run: null,
}

/** 首次打开（库里四类全空）时的示例：一个表单 + 一个模型，避免面对全空页面不知道干嘛 */
function seedConfig(): LowCodeConfig {
  const form: FormPlan = {
    ...emptyPlan("示例：用户登记"),
    fields: [
      { id: uid("f"), type: "text", label: "姓名", placeholder: "请输入姓名", required: true, span: 1, rules: { minLen: 2, maxLen: 20 } },
      { id: uid("f"), type: "text", label: "手机号", placeholder: "11 位手机号", required: true, span: 1, rules: { pattern: "^1[3-9]\\d{9}$", message: "手机号格式不正确" } },
      { id: uid("f"), type: "select", label: "来源渠道", span: 1, options: ["官网", "朋友推荐", "广告"] },
      { id: uid("f"), type: "switch", label: "是否接收通知", span: 1 },
      { id: uid("f"), type: "textarea", label: "备注", span: 3 },
    ],
  }
  const model: ModelPlan = {
    ...emptyPlan("示例：orders"),
    table: "orders",
    fields: [
      { name: "title", type: "string", required: true, def: "", note: "订单标题" },
      { name: "amount", type: "number", required: true, def: "0", note: "金额" },
      { name: "status", type: "enum", required: false, def: "", note: "状态" },
      { name: "created_by", type: "string", required: false, def: "", note: "创建人", index: true },
    ],
  }
  return { forms: [form], flows: [], models: [model], pages: [] }
}

export default function LowCodePage() {
  const [cfg, setCfg] = useState<LowCodeConfig>({ forms: [], flows: [], models: [], pages: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<TabKey>("form")
  const [current, setCurrent] = useState<Record<PlanKind, string | null>>({ forms: null, flows: null, models: null, pages: null })

  useEffect(() => {
    loadLowCode()
      .then((d) => {
        const emptyAll = !d.forms.length && !d.flows.length && !d.models.length && !d.pages.length
        const next = emptyAll ? seedConfig() : d
        setCfg(next)
        setCurrent({
          forms: next.forms[0]?.id ?? null,
          flows: next.flows[0]?.id ?? null,
          models: next.models[0]?.id ?? null,
          pages: next.pages[0]?.id ?? null,
        })
      })
      .catch((e) => toast.error("加载失败：" + (e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  /** 修改某类里的某个方案：顺手更新 updated_at 并置 dirty */
  const patchKind = useCallback((kind: PlanKind, next: Plan[]) => {
    setCfg((prev) => ({ ...prev, [kind]: next }))
    setDirty(true)
  }, [])

  const patchPlan = useCallback((kind: PlanKind, id: string, patch: Record<string, any>) => {
    setCfg((prev) => {
      const list = (prev[kind] || []) as Plan[]
      return { ...prev, [kind]: list.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
    })
    setDirty(true)
  }, [])

  async function save() {
    setSaving(true)
    try {
      // updated_at 在保存时统一打戳：它是「上次保存时间」，不是「上次编辑时间」
      const stamped: LowCodeConfig = {
        forms: cfg.forms.map((p) => ({ ...p, updated_at: nowStamp() })),
        flows: cfg.flows.map((p) => ({ ...p, updated_at: nowStamp() })),
        models: cfg.models.map((p) => ({ ...p, updated_at: nowStamp() })),
        pages: cfg.pages.map((p) => ({ ...p, updated_at: nowStamp() })),
      }
      await saveLowCode(stamped)
      setCfg(stamped)
      setDirty(false)
      toast.success("已保存到服务器")
    } catch (e: any) {
      toast.error("保存失败：" + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const kind = TAB_KIND[tab]
  const planOf = (k: PlanKind) => ((cfg[k] || []) as Plan[]).find((p) => p.id === current[k]) || null

  const items = [
    {
      key: "form", label: "📋 表单设计器",
      children: <FormDesigner plan={planOf("forms") as FormPlan | null}
        onPatch={(p) => current.forms && patchPlan("forms", current.forms, p)} />,
    },
    {
      key: "flow", label: "🔀 流程编排",
      children: <FlowDesigner plan={planOf("flows") as any}
        onPatch={(p) => current.flows && patchPlan("flows", current.flows, p)} />,
    },
    {
      key: "model", label: "🗃️ 数据模型",
      children: <DataModeler plan={planOf("models") as ModelPlan | null}
        onPatch={(p) => current.models && patchPlan("models", current.models, p)}
        allModels={(cfg.models || []) as ModelPlan[]} />,
    },
    {
      key: "page", label: "🧩 页面生成器",
      children: <PageGenerator plan={planOf("pages") as PagePlan | null}
        onPatch={(p) => current.pages && patchPlan("pages", current.pages, p)}
        models={(cfg.models || []) as ModelPlan[]} />,
    },
    {
      key: "run", label: "▶️ 运行时",
      children: <RuntimeRunner forms={(cfg.forms || []) as FormPlan[]} />,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部：方案管理 + 保存 */}
      <Card size="small" styles={{ body: { padding: 12 } }}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[420px]">
            {kind ? (
              <PlanBar label={kind === "forms" ? "表单方案" : kind === "flows" ? "流程方案" : kind === "models" ? "数据模型" : "页面方案"}
                plans={(cfg[kind] || []) as Plan[]}
                currentId={current[kind]}
                onChange={(id) => setCurrent((prev) => ({ ...prev, [kind]: id }))}
                onPatch={(next) => patchKind(kind, next)} />
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 py-1.5">
                运行时直接用「表单设计器」里已保存的表单方案，提交结果存 lowcode_records 表。
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dirty && <Tag color="orange">有未保存的改动</Tag>}
            <Button type="primary" size="small" icon={<CloudUploadOutlined />} loading={saving} disabled={loading || !dirty} onClick={save}>
              保存到服务器
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card size="small"><div className="text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center">加载中…</div></Card>
      ) : (
        <Tabs activeKey={tab} onChange={(v) => setTab(v as TabKey)} items={items} />
      )}

      <div className="text-xs text-zinc-400 dark:text-zinc-500 -mt-1">
        可视化搭建 · 设计稿存服务端（ui_config.lowcode）· 表单提交记录存 lowcode_records 表 · 支持导出 JSON Schema / DDL / React 代码
      </div>
    </div>
  )
}
