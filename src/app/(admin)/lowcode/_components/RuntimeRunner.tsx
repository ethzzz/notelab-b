"use client"
// 低代码平台 · 运行时：把设计好的表单真的渲染出来、提交入库、查看提交记录
//
// ⚠️ 渲染与校验必须与 FormDesigner 的「实时预览」共用同一套代码（FieldControl + validateField），
// 否则会出现「预览能过、运行时报错」的口径分裂。
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, Card, Col, Empty, Modal, Row, Select, Space, Table, Tag, Tooltip } from "antd"
import { DownloadOutlined } from "@ant-design/icons"
import { toast } from "@/lib/toast"
import { isVisible, validateField, type Field, type FormPlan } from "../_lib/core"
import { deleteRecord, exportRecordsUrl, loadRecords, submitRecord, type RecordItem } from "../_lib/api"
import { CodeBlock, SectionTitle } from "./ui"
import { FieldControl } from "./FieldControl"
import PublishPanel from "./PublishPanel"

function spanToCol(span: number | undefined): number {
  return span === 1 ? 8 : span === 2 ? 16 : 24
}

/** 单次导出条数上限，须与后端 LowCodeController.EXPORT_MAX_ROWS 一致（超出只会导出最近这些） */
const EXPORT_MAX = 5000

export default function RuntimeRunner({ forms, onPatch }: {
  forms: FormPlan[]
  /** 改发布态（published/slug/intro/submitText）；由页面统一置 dirty */
  onPatch: (id: string, patch: Record<string, any>) => void
}) {
  const [formId, setFormId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [total, setTotal] = useState(0)
  const [publicTotal, setPublicTotal] = useState(0)
  /** 记录表按来源过滤：空 = 全部 */
  const [srcFilter, setSrcFilter] = useState<"" | "admin" | "public">("")
  const [loadingRec, setLoadingRec] = useState(false)
  const [detail, setDetail] = useState<RecordItem | null>(null)

  const plan = useMemo(() => forms.find((f) => f.id === formId) || null, [forms, formId])
  const fields: Field[] = plan?.fields || []

  useEffect(() => {
    if (!formId && forms.length) setFormId(forms[0].id)
  }, [forms, formId])

  const reload = useCallback(() => {
    if (!formId) { setRecords([]); setTotal(0); setPublicTotal(0); return }
    setLoadingRec(true)
    // ⚠️ public_total 是**不区分来源过滤**的公开提交总数（后端固定按 source=public 统计），
    //    所以它不会因为这里切了 srcFilter 而变 —— 运营要的是「这个表单总共收回多少份」。
    loadRecords(formId, 50, srcFilter)
      .then((d) => { setRecords(d.items || []); setTotal(d.total || 0); setPublicTotal(d.public_total || 0) })
      .catch((e) => toast.error(String(e.message || e)))
      .finally(() => setLoadingRec(false))
  }, [formId, srcFilter])

  useEffect(() => { reload() }, [reload])

  // 切换表单 → 清空填写内容与错误（不同表单字段 id 不同，留着会串）
  useEffect(() => { setValues({}); setErrors({}) }, [formId])

  async function submit() {
    if (!plan) return
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (!isVisible(f.visibleWhen, values)) continue
      const e = validateField(f, values[f.id])
      if (e) errs[f.id] = e
    }
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.warning(`有 ${Object.keys(errs).length} 项校验未通过`)
      return
    }
    setBusy(true)
    try {
      await submitRecord(plan.id, plan.name, values)
      toast.success("已提交")
      setValues({})
      reload()
    } catch (e: any) {
      toast.error(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(r: RecordItem) {
    try {
      await deleteRecord(r.id)
      toast.success("已删除")
      reload()
    } catch (e: any) {
      toast.error(String(e?.message || e))
    }
  }

  // 宽度是算过的：卡片内宽约 550~630，固定列合计别超过 470，否则「内容摘要」会被挤到几个像素，
  // 中文就逐字竖排（时间列也会被压成「2026-10-12」换行）。宁可让内容摘要省略号，也不让它变形。
  const recColumns = [
    { title: "ID", dataIndex: "id", width: 56 },
    {
      title: "来源", dataIndex: "source", width: 68, align: "center" as const,
      render: (v: string) => (v === "public"
        ? <Tag color="blue">公开</Tag>
        : <Tag>内部</Tag>),
    },
    { title: "提交人", dataIndex: "created_by_name", width: 84, ellipsis: true, render: (v: string) => v || <span className="text-zinc-400">匿名</span> },
    {
      title: "内容摘要", ellipsis: { showTitle: false }, render: (_: any, r: RecordItem) => {
        let d: any = {}
        try { d = JSON.parse(r.data || "{}") } catch { d = {} }
        const keys = Object.keys(d).slice(0, 3)
        const txt = keys.map((k) => `${k}=${String(d[k] ?? "")}`).join(" · ")
        return (
          <Tooltip title={txt || "（空）"} placement="topLeft">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{txt || "（空）"}</span>
          </Tooltip>
        )
      },
    },
    { title: "时间", dataIndex: "created_at", width: 148 },
    {
      title: "操作", width: 104, align: "center" as const, render: (_: any, r: RecordItem) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => setDetail(r)}>详情</Button>
          <Button size="small" type="link" danger onClick={() => remove(r)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 对外发布：整行宽度，链接较长，塞进右侧窄栏会折行 */}
      <Card size="small" styles={{ body: { padding: 12 } }}>
        <PublishPanel plan={plan} onPatch={(p) => plan && onPatch(plan.id, p)} publicTotal={publicTotal} />
      </Card>

      <div className="flex gap-4 items-start">
        {/* 表单 */}
        <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">选择表单</span>
            <Select size="small" className="!w-64" placeholder="选择要运行的表单" value={formId ?? undefined}
              onChange={(v) => setFormId(v ?? null)}
              options={forms.map((f) => ({ value: f.id, label: f.name }))} />
            <Tag className="ml-1">{(plan?.fields || []).length} 字段</Tag>
          </div>

          {forms.length === 0 && <Empty description="还没有表单方案，先去「表单设计器」建一个" />}
          {plan && fields.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-8 text-center">这个表单还没有字段</div>}

          {plan && fields.length > 0 && (
            <>
              <Row gutter={[12, 12]}>
                {fields.map((f) => {
                  if (!isVisible(f.visibleWhen, values)) return null
                  const err = errors[f.id]
                  return (
                    <Col key={f.id} span={spanToCol(f.span)}>
                      <div className="flex flex-col gap-1.5 mb-1">
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
              <div className="mt-3 flex gap-2 items-center">
                <Button type="primary" loading={busy} onClick={submit}>提交</Button>
                <Button onClick={() => { setValues({}); setErrors({}) }}>重置</Button>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  这里提交记为「内部」来源；外部用户走上面的公开链接
                </span>
              </div>
            </>
          )}
        </Card>

        {/* 提交记录 */}
        <Card size="small" className="w-[50%] shrink-0" styles={{ body: { padding: 12 } }}>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>提交记录（共 {total} 条）</SectionTitle>
            <Space size={4}>
              <Select size="small" className="!w-24" value={srcFilter}
                onChange={(v) => setSrcFilter(v ?? "")}
                options={[{ value: "", label: "全部来源" }, { value: "admin", label: "仅内部" }, { value: "public", label: "仅公开" }]} />
              {/* 导出跟随当前筛选：运营要的通常就是「这个表单收上来的公开提交」，不是全库混在一起 */}
              <Tooltip title={total > EXPORT_MAX
                ? `当前 ${total} 条，超出单次上限，只会导出最近 ${EXPORT_MAX} 条`
                : "导出为 CSV（列名取表单字段，可直接用 Excel 打开）"}>
                <Button size="small" icon={<DownloadOutlined />} disabled={!formId}
                  onClick={() => window.location.assign(exportRecordsUrl(formId || "", srcFilter))}>
                  导出 CSV
                </Button>
              </Tooltip>
              <Button size="small" onClick={reload} loading={loadingRec}>刷新</Button>
            </Space>
          </div>
          {/* scroll.x 给个下限：窗口变窄时让表格横向滚动，而不是把列压成竖排文字 */}
          <Table rowKey="id" size="small" pagination={false} loading={loadingRec}
            dataSource={records} columns={recColumns as any} scroll={{ x: 560, y: 420 }} />

          <Modal open={!!detail} onCancel={() => setDetail(null)} title="提交详情" width={640}
            footer={[<Button key="c" onClick={() => setDetail(null)}>关闭</Button>]}>
            {detail && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>#{detail.id} · {detail.form_name} · {detail.created_by_name || "匿名"} · {detail.created_at}</span>
                  <Tag color={detail.source === "public" ? "blue" : "default"}>{detail.source === "public" ? "公开链接" : "后台内部"}</Tag>
                </div>
                <CodeBlock text={(() => { try { return JSON.stringify(JSON.parse(detail.data || "{}"), null, 2) } catch { return detail.data || "{}" } })()} maxH="50vh" />
              </div>
            )}
        </Modal>
        </Card>
      </div>
    </div>
  )
}
