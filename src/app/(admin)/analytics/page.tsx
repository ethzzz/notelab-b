"use client"

// 数据看板（PRD-P0 §6.2 · /admin/analytics）
//
// 设计取舍：
// - **不引图表库**：折线图手写 SVG（60–80 行，零依赖）。C 端永远不加图表库；
//   B 端以后嫌累可引 recharts，这一版先按 PRD 要求手画。
// - 指标口径全部来自后端 /api/analytics/*（服务端同一时区算 day），前端只负责画。
// - 「无 Cookie 同意横幅」的说明直接写在页面上（用户有权知道，PRD §4.5.4）。
//
// ⚠️ LLM 依赖：无 —— key 全挂时本页照常出数。

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, Col, Row, Segmented, Select, Spin, Statistic, Table, Tabs, Tag, Tooltip, Button } from "antd"
import AdminPage from "@/components/admin/AdminPage"
import { apiJson } from "@/lib/api"

type Point = { day: string; n?: number; dau?: number; events?: number }
type RetentionRow = { day: string; cohort: number; retained: number }
type Rate = { cohort: number; retained: number; rate: number | null } | null
type Overview = {
  days: number; from: string; to: string
  dau: number; newUsers: number; events: number; wau: number; mau: number
  activeSeries: Point[]; newSeries: Point[]
  retentionD1: Rate; retentionD7: Rate
  retentionD1Matrix: RetentionRow[]; retentionD7Matrix: RetentionRow[]
}
type TopItem = { event: string; count: number; users: number; pct: number; prev: number; delta: number | null }
type FunnelStep = { key: string; label: string; count: number; fromPrev: number | null }
type PageItem = { path: string; pv: number; p50: number | null; p95: number | null }

const RANGES = [
  { label: "7 天", value: 7 },
  { label: "30 天", value: 30 },
  { label: "90 天", value: 90 },
]

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [top, setTop] = useState<{ total: number; items: TopItem[] }>({ total: 0, items: [] })
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  // 折线图指标：DAU / 新用户 / 事件量
  const [metric, setMetric] = useState<"dau" | "new" | "events">("dau")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, tp, fn, pg] = await Promise.all([
        apiJson<{ data: Overview }>(`/api/analytics/overview?days=${days}`),
        apiJson<{ data: { total: number; items: TopItem[] } }>(`/api/analytics/top?days=${days}&limit=20`),
        apiJson<{ data: { steps: FunnelStep[] } }>(`/api/analytics/funnel?days=${days}`),
        apiJson<{ data: { items: PageItem[] } }>(`/api/analytics/pages?days=${days}`),
      ])
      setOverview(ov.data)
      setTop(tp.data)
      setFunnel(fn.data?.steps || [])
      setPages(pg.data?.items || [])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { void load() }, [load])

  /** 折线图序列：按天对齐（后端只返回有数据的天，缺的天要补 0 才能画成等距时间轴） */
  const series = useMemo(() => {
    if (!overview) return []
    const byDay = new Map<string, number>()
    if (metric === "new") for (const p of overview.newSeries) byDay.set(String(p.day).slice(0, 10), Number(p.n || 0))
    else for (const p of overview.activeSeries) byDay.set(String(p.day).slice(0, 10), Number(metric === "dau" ? p.dau : p.events) || 0)
    const out: { day: string; value: number | null }[] = []
    const start = new Date(overview.from + "T00:00:00")
    for (let i = 0; i < overview.days; i++) {
      const d = new Date(start.getTime() + i * 86400000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      // 无数据的天给 null → 折线断开（PRD §6.2：别连成穿地的斜线）
      out.push({ day: key, value: byDay.has(key) ? byDay.get(key)! : null })
    }
    return out
  }, [overview, metric])

  const exportCsv = useCallback(() => {
    const rows: string[][] = [["类型", "键", "值1", "值2"]]
    for (const p of overview?.activeSeries || []) rows.push(["日活", String(p.day), String(p.dau ?? ""), String(p.events ?? "")])
    for (const t of top.items) rows.push(["事件", t.event, String(t.count), String(t.pct)])
    for (const pg of pages) rows.push(["页面", pg.path, String(pg.pv), String(pg.p50 ?? "")])
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `analytics-${days}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [overview, top, pages, days])

  return (
    <AdminPage
      title="数据看板"
      description="全站埋点（PRD-P0）· 只写 localStorage/sessionStorage，不写 Cookie、不引第三方统计脚本，因此无需 Cookie 同意横幅"
      extra={
        <>
          <Segmented options={RANGES} value={days} onChange={(v) => setDays(Number(v))} />
          <Button onClick={exportCsv}>导出 CSV</Button>
        </>
      }
    >
      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card size="small"><Statistic title="DAU（今日）" value={overview?.dau ?? 0} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small"><Statistic title="新用户（今日）" value={overview?.newUsers ?? 0} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="次日留存" value={overview?.retentionD1?.rate ?? 0} suffix="%" precision={1} />
              <div className="mt-1 text-xs text-zinc-400">
                {overview?.retentionD1 ? `${overview.retentionD1.retained}/${overview.retentionD1.cohort} 人` : "—"}
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="7 日留存" value={overview?.retentionD7?.rate ?? 0} suffix="%" precision={1} />
              <div className="mt-1 text-xs text-zinc-400">
                {overview?.retentionD7 ? `${overview.retentionD7.retained}/${overview.retentionD7.cohort} 人` : "—"}
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          size="small"
          className="mt-3"
          title="趋势"
          extra={
            <Select
              size="small"
              value={metric}
              onChange={(v) => setMetric(v ?? "dau")}
              style={{ width: 120 }}
              options={[
                { value: "dau", label: "日活 DAU" },
                { value: "new", label: "新用户" },
                { value: "events", label: "事件量" },
              ]}
            />
          }
        >
          <LineChart points={series} />
          <div className="mt-2 text-xs text-zinc-400">
            WAU {overview?.wau ?? 0} · MAU {overview?.mau ?? 0} · 区间事件总量 {overview?.events ?? 0}
          </div>
        </Card>

        <Card size="small" className="mt-3">
          <Tabs
            items={[
              {
                key: "top",
                label: "功能使用",
                children: (
                  <Table<TopItem>
                    size="small"
                    rowKey="event"
                    pagination={false}
                    dataSource={top.items}
                    columns={[
                      { title: "事件", dataIndex: "event" },
                      { title: "次数", dataIndex: "count", width: 100, sorter: (a, b) => a.count - b.count },
                      { title: "触达人数", dataIndex: "users", width: 110 },
                      { title: "占比", dataIndex: "pct", width: 100, render: (v: number) => `${v}%` },
                      {
                        title: "环比", dataIndex: "delta", width: 110,
                        render: (v: number | null) =>
                          v == null ? <span className="text-zinc-400">—</span>
                            : <Tag color={v >= 0 ? "green" : "red"}>{v >= 0 ? "+" : ""}{v}%</Tag>,
                      },
                    ]}
                  />
                ),
              },
              {
                key: "funnel",
                label: "漏斗",
                children: (
                  <div className="flex flex-col gap-2">
                    {funnel.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-zinc-500">{s.label}</span>
                        <div className="h-5 flex-1 rounded bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-5 rounded bg-sky-500"
                            style={{ width: `${funnel[0]?.count ? Math.max(2, (s.count / funnel[0].count) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-sm tabular-nums">{s.count}</span>
                        <span className="w-20 text-right text-xs text-zinc-400">
                          {i === 0 ? "" : s.fromPrev == null ? "—" : `${s.fromPrev}%`}
                        </span>
                      </div>
                    ))}
                    {!funnel.length && <span className="text-sm text-zinc-400">区间内暂无漏斗数据</span>}
                  </div>
                ),
              },
              {
                key: "retention",
                label: "留存",
                children: (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <RetentionTable title="次日留存（按活跃日）" rows={overview?.retentionD1Matrix || []} />
                    </Col>
                    <Col xs={24} md={12}>
                      <RetentionTable title="7 日留存（按活跃日）" rows={overview?.retentionD7Matrix || []} />
                    </Col>
                  </Row>
                ),
              },
              {
                key: "pages",
                label: "页面",
                children: (
                  <Table<PageItem>
                    size="small"
                    rowKey="path"
                    pagination={false}
                    dataSource={pages}
                    columns={[
                      { title: "路径", dataIndex: "path" },
                      { title: "PV", dataIndex: "pv", width: 90, sorter: (a, b) => a.pv - b.pv },
                      { title: "停留 p50", dataIndex: "p50", width: 120, render: ms },
                      { title: "停留 p95", dataIndex: "p95", width: 120, render: ms },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Spin>
    </AdminPage>
  )
}

function ms(v: number | null): string {
  if (v == null) return "—"
  if (v < 1000) return `${v} ms`
  return `${(v / 1000).toFixed(1)} s`
}

function RetentionTable({ title, rows }: { title: string; rows: RetentionRow[] }) {
  return (
    <>
      <div className="mb-2 text-sm text-zinc-500">{title}</div>
      <Table<RetentionRow>
        size="small"
        rowKey="day"
        pagination={false}
        scroll={{ y: 240 }}
        dataSource={rows}
        columns={[
          { title: "活跃日", dataIndex: "day", render: (v: string) => String(v).slice(0, 10) },
          { title: "人数", dataIndex: "cohort", width: 80 },
          { title: "留存", dataIndex: "retained", width: 80 },
          {
            title: "留存率", width: 100,
            render: (_: unknown, r: RetentionRow) =>
              r.cohort ? `${Math.round((r.retained / r.cohort) * 1000) / 10}%` : "—",
          },
        ]}
      />
    </>
  )
}

/**
 * 手写 SVG 折线（PRD §6.2 的要点都在这里）：
 * - viewBox 固定 0 0 800 240，外层宽度 100% 自适应；
 * - y 轴取 0 ~ max*1.1，x 轴等距；
 * - 面积填充用 linearGradient；hover 提示只用 <title>（不引 tooltip 库）；
 * - **空值必须断线**（重新起笔 M），否则会连成一条穿地的斜线，把「那天没人来」画成「那天有人来」。
 */
function LineChart({ points }: { points: { day: string; value: number | null }[] }) {
  const W = 800, H = 240, PAD_L = 46, PAD_R = 12, PAD_T = 16, PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  if (!points.length) return <div className="py-10 text-center text-sm text-zinc-400">区间内暂无数据</div>

  const max = Math.max(1, ...points.map((p) => p.value ?? 0))
  const yMax = max * 1.1
  const xOf = (i: number) => PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yOf = (v: number) => PAD_T + innerH - (v / yMax) * innerH

  // 分段：null 处断开，每段一条折线 + 一块面积
  const segments: { i: number; v: number }[][] = []
  let cur: { i: number; v: number }[] = []
  points.forEach((p, i) => {
    if (p.value == null) { if (cur.length) segments.push(cur); cur = []; return }
    cur.push({ i, v: p.value })
  })
  if (cur.length) segments.push(cur)

  const lineOf = (seg: { i: number; v: number }[]) => "M" + seg.map((s) => `${xOf(s.i)},${yOf(s.v)}`).join("L")
  const areaOf = (seg: { i: number; v: number }[]) =>
    seg.length === 1 ? "" : `${lineOf(seg)}L${xOf(seg[seg.length - 1].i)},${PAD_T + innerH}L${xOf(seg[0].i)},${PAD_T + innerH}Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))
  // x 轴最多 6 个日期刻度
  const step = Math.max(1, Math.ceil(points.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label="趋势折线图">
      <defs>
        <linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t, k) => (
        <g key={k}>
          <line x1={PAD_L} y1={yOf(t)} x2={W - PAD_R} y2={yOf(t)} stroke="currentColor" strokeOpacity="0.12" />
          <text x={PAD_L - 6} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.5">{t}</text>
        </g>
      ))}
      {segments.map((seg, k) => (
        <g key={k}>
          {areaOf(seg) && <path d={areaOf(seg)} fill="url(#an-area)" />}
          <path d={lineOf(seg)} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinejoin="round" />
          {seg.map((s) => (
            <circle key={s.i} cx={xOf(s.i)} cy={yOf(s.v)} r="2.5" fill="#0ea5e9">
              <title>{`${points[s.i].day}：${s.v}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {points.map((p, i) =>
        i % step === 0 ? (
          <text key={p.day} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5">
            {p.day.slice(5)}
          </text>
        ) : null,
      )}
      <Tooltip title="" />{/* 占位：保持 antd 依赖一致，实际 hover 用 <title> */}
    </svg>
  )
}
