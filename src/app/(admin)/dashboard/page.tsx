"use client"
// 仪表盘（落地页）：欢迎卡片 + 资产指标卡 + 数据可视化（echarts）+ 功能入口。
//
// 数据全部来自 /api/dashboard/stats：超管返回 scope=full，普通角色 scope=basic
// （经营 / 安全两块直接是 null）—— 前端按 scope 决定渲不渲染，而不是把 null 画成空图。
//
// ⚠️ 「功能入口」刻意不包含练习实践：它已有左侧菜单入口，且是低频写作工具，
// 不适合占落地页的位置。侧边栏菜单本身不动（那是 Layout 的事）。
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, Col, Row, Spin, Typography } from "antd"
import type { EChartsCoreOption } from "echarts/core"
import { apiJson } from "@/lib/api"
import { useTheme } from "@/components/AntdProvider"
import Chart from "@/components/dashboard/chart"
import {
  CHART_HEIGHT,
  PALETTE,
  categoryAxis,
  gridStyle,
  legendStyle,
  tooltipStyle,
  valueAxis,
} from "@/components/dashboard/palette"

type Asset = { key: string; label: string; value: number; unit: string; path: string; hint?: string }
type DayRow = Record<string, string | number>
type Stats = {
  scope: "full" | "basic"
  days: number
  from: string
  to: string
  assets: Asset[]
  contentTrend: DayRow[]
  practice: { byType: { type: string; n: number }[]; published: number; total: number }
  activeTrend: DayRow[] | null
  loginTrend: DayRow[] | null
}

/** 指标卡小图标：按 key 映射，省得后端为一个 emoji 多传一个字段 */
const ICONS: Record<string, string> = {
  bUsers: "👤", cUsers: "🧑", notes: "📝", documents: "📄",
  canvas: "🎨", practice: "🧪", lowcode: "🧩", practiceImages: "🖼",
}

export default function DashboardPage() {
  const { mode } = useTheme()
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)
  const [menu, setMenu] = useState<any[]>([])
  const [pages, setPages] = useState<string[] | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    apiJson("/api/me").then(setUser).catch(() => {})
    apiJson("/api/menu").then((m) => {
      setMenu(m.menu || [])
      setPages(Array.isArray(m.pages) ? m.pages : null)
    }).catch(() => {})
    apiJson("/api/dashboard/stats").then((r) => setStats(r.data)).catch(() => setFailed(true))
  }, [])

  // 功能入口：去掉仪表盘自己（path 为 "/"）与练习实践（前缀 /practice）。
  //
  // ⚠️ 这个列表**实际渲染 0 张卡**，而且不是 bug：/api/menu 顶层是「分组 + 叶子」混排，
  // 这里只看顶层叶子。实测顶层叶子只有两项 —— 仪表盘（/）与练习实践（/practice），
  // 其余 8 个全是分组（带 children）。也就是说原来的仪表盘上就只有那一张练习实践卡，
  // 这正是它看起来空的原因。保留这段是因为它对任何菜单结构都成立：
  // 将来顶层若新增叶子会自动出现在这里；而要让分组里的功能也铺开成入口，
  // 得递归展开 children —— 那是另一种产品选择（仪表盘会变成第二份侧边栏），没做。
  const ready = menu.filter((m) => m.ready && m.path !== "/" && !String(m.path || "").startsWith("/practice"))

  // 指标卡按当前账号实际可进的页面过滤；pages 缺失（后端抖动 / 旧后端）时不过滤，别把卡片全藏了
  const assets = (stats?.assets || []).filter((a) => !pages || pages.includes(a.path))

  const contentOption = useMemo<EChartsCoreOption>(() => {
    const rows = stats?.contentTrend || []
    return {
      color: PALETTE,
      tooltip: { trigger: "axis", ...tooltipStyle(mode) },
      legend: legendStyle(mode),
      grid: gridStyle(),
      xAxis: categoryAxis(mode, rows.map((r) => String(r.day))),
      yAxis: valueAxis(mode),
      series: [
        lineSeries("笔记", rows.map((r) => Number(r.notes))),
        lineSeries("文档", rows.map((r) => Number(r.documents))),
        lineSeries("练习记录", rows.map((r) => Number(r.practice))),
      ],
    }
  }, [stats, mode])

  const activeOption = useMemo<EChartsCoreOption>(() => {
    const rows = stats?.activeTrend || []
    return {
      color: PALETTE,
      tooltip: { trigger: "axis", ...tooltipStyle(mode) },
      legend: legendStyle(mode),
      grid: gridStyle(),
      xAxis: categoryAxis(mode, rows.map((r) => String(r.day))),
      yAxis: valueAxis(mode),
      series: [
        lineSeries("活跃用户", rows.map((r) => Number(r.dau))),
        lineSeries("事件量", rows.map((r) => Number(r.events))),
      ],
    }
  }, [stats, mode])

  const loginOption = useMemo<EChartsCoreOption>(() => {
    const rows = stats?.loginTrend || []
    return {
      tooltip: { trigger: "axis", ...tooltipStyle(mode) },
      legend: legendStyle(mode),
      grid: gridStyle(),
      // 柱子要有间隔感，boundaryGap 与折线相反
      xAxis: { ...categoryAxis(mode, rows.map((r) => String(r.day))), boundaryGap: true },
      yAxis: valueAxis(mode),
      series: [
        barSeries("成功", rows.map((r) => Number(r.ok)), "#10b981"),
        barSeries("失败", rows.map((r) => Number(r.fail)), "#f43f5e"),
      ],
    }
  }, [stats, mode])

  const practiceOption = useMemo<EChartsCoreOption>(() => {
    const raw = stats?.practice.byType || []
    // 题型能有十几项，环形图塞不下：取前 6，其余并成「其他」（否则图例比圆还高）
    const top = raw.slice(0, 6)
    const rest = raw.slice(6).reduce((s, x) => s + x.n, 0)
    const items = rest > 0 ? [...top, { type: "其他", n: rest }] : top
    return {
      tooltip: { trigger: "item", ...tooltipStyle(mode) },
      legend: { ...legendStyle(mode), type: "scroll", orient: "vertical", right: 0, top: "middle" },
      series: [{
        type: "pie",
        radius: ["52%", "74%"],
        center: ["34%", "50%"],
        avoidLabelOverlap: true,
        // 扇区之间留白（底色随主题），比挨着的色块清爽
        itemStyle: { borderColor: mode === "dark" ? "#1f1f1f" : "#ffffff", borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        labelLine: { show: false },
        data: items.map((t, i) => ({ name: t.type, value: t.n, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      }],
    }
  }, [stats, mode])

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 欢迎卡片 */}
      <Card styles={{ body: { padding: "20px 24px" } }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          你好{user ? `，${user.username}` : ""} 👋
        </Typography.Title>
        <Typography.Text type="secondary">
          欢迎来到 NoteLab —— AI 试验台与管理后台，左侧菜单进入各功能模块。
        </Typography.Text>
      </Card>

      {!stats && !failed && (
        <Card styles={{ body: { padding: "56px 0", textAlign: "center" } }}>
          <Spin />
        </Card>
      )}
      {failed && !stats && (
        <Card styles={{ body: { padding: "20px 24px" } }}>
          <Typography.Text type="secondary">仪表盘数据加载失败，刷新页面重试。</Typography.Text>
        </Card>
      )}

      {stats && (
        <>
          {/* 资产指标卡 */}
          <Row gutter={[12, 12]}>
            {assets.map((a) => (
              <Col key={a.key} xs={12} sm={8} xl={6}>
                <Link href={a.path}>
                  <Card hoverable size="small" styles={{ body: { padding: "14px 16px" } }}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-base dark:bg-indigo-500/15">
                        {ICONS[a.key] || "📦"}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{a.label}</div>
                        <div className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-100">
                          {a.value.toLocaleString()}
                          <span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">{a.unit}</span>
                        </div>
                        {a.hint && <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{a.hint}</div>}
                      </div>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>

          {/* 内容产出趋势 + 练习实践构成 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={16}>
              <Card
                size="small"
                title={`近 ${stats.days} 天内容产出`}
                extra={<span className="text-xs text-zinc-400 dark:text-zinc-500">按创建时间</span>}
              >
                <Chart
                  option={contentOption}
                  height={CHART_HEIGHT}
                  empty={stats.contentTrend.every((r) => !r.notes && !r.documents && !r.practice)}
                  emptyText="这段时间还没有新内容"
                />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card
                size="small"
                title="练习实践构成"
                extra={
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    共 {stats.practice.total} 条 · 已发布 {stats.practice.published}
                  </span>
                }
              >
                <Chart option={practiceOption} height={CHART_HEIGHT} empty={!stats.practice.byType.length} />
              </Card>
            </Col>
          </Row>

          {/* 经营 / 安全两块：仅超管（后端 scope=basic 时字段为 null，这里整段不渲染） */}
          {stats.scope === "full" && (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={16}>
                <Card
                  size="small"
                  title={`C 端活跃（近 ${stats.days} 天）`}
                  extra={<span className="text-xs text-zinc-400 dark:text-zinc-500">仅超管可见</span>}
                >
                  <Chart option={activeOption} height={CHART_HEIGHT} empty={!stats.activeTrend?.length} />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card size="small" title="近 7 天登录情况">
                  <Chart option={loginOption} height={CHART_HEIGHT} empty={!stats.loginTrend?.length} />
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* 功能入口 */}
      <Row gutter={[16, 16]}>
        {ready.map((m) => (
          <Col key={m.key} xs={24} sm={12} xl={8} xxl={6}>
            <Link href={m.path}>
              <Card hoverable size="small" styles={{ body: { padding: "14px 16px" } }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-lg">{m.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100 truncate">{m.name}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">点击进入</div>
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  )
}

/** 折线系列：平滑 + 隐藏数据点 + 极淡面积（不抢主色，只用来托一下趋势） */
function lineSeries(name: string, data: number[]) {
  return {
    name,
    type: "line" as const,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2 },
    areaStyle: { opacity: 0.08 },
    data,
  }
}

/** 堆叠柱系列：登录成功/失败共用一根柱子 */
function barSeries(name: string, data: number[], color: string) {
  return {
    name,
    type: "bar" as const,
    stack: "login",
    barMaxWidth: 16,
    itemStyle: { color },
    data,
  }
}
