"use client"
// 系统管理 → 模型用量（2026-10-20 接 DeepSeek 后加）
//
// 这一页回答两个问题：
//   ① 这些天烧了多少（token / 请求 / 失败数，按天、按模型、按 key 分开看）
//   ② 今天还能烧多少（每日限额 + 剩余 + provider 余额）
//
// 数据来源：/api/admin/llm-usage（仅超管）。账本是**我们自己记的**（表 llm_usage）——
// DeepSeek 只提供余额接口、没有按天用量历史，所以限额只能靠本地账本算。
// ⚠️ 限额保存是**整份替换**（enabled + dailyTokens + dailyRequests 三个字段一起写）。
import { useCallback, useEffect, useState } from "react"
import { Alert, Button, Card, Descriptions, InputNumber, Space, Statistic, Switch, Table, Tag, Tooltip } from "antd"
import { RefreshCw, Save } from "lucide-react"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type DayRow = { day: string; requests: number; tokens: number; failures: number }
type AggRow = { model?: string; key_mask?: string; requests: number; tokens: number }
type BalanceInfo = { currency?: string; total_balance?: string; granted_balance?: string; topped_up_balance?: string }
type Summary = {
  today: { tokens: number; requests: number }
  limits: { enabled: boolean; dailyTokens: number; dailyRequests: number }
  remainingTokens: number | null
  model: string
  keyMask: string
  keyCount: number
  days: DayRow[]
  byModel: AggRow[]
  byKey: AggRow[]
  balance: { ok: boolean; available?: boolean; infos?: BalanceInfo[]; reason?: string }
}

const fmt = (n?: number | null) => (n == null ? "-" : n.toLocaleString("zh-CN"))

export default function LlmUsagePage() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // 限额表单（与 data.limits 分离：编辑中不要被轮询覆盖）
  const [enabled, setEnabled] = useState(false)
  const [dailyTokens, setDailyTokens] = useState<number | null>(0)
  const [dailyRequests, setDailyRequests] = useState<number | null>(0)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    try {
      const j = await apiJson<Summary>(`/api/admin/llm-usage?days=${d}`)
      setData(j)
      // 首次加载 / 刷新后用服务端值填充表单
      setEnabled(!!j.limits?.enabled)
      setDailyTokens(j.limits?.dailyTokens ?? 0)
      setDailyRequests(j.limits?.dailyRequests ?? 0)
    } catch (e: any) {
      toast.error(`加载失败：${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(days) }, [days, load])

  async function save() {
    setSaving(true)
    try {
      await apiJson("/api/admin/llm-usage/limits", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, dailyTokens: dailyTokens ?? 0, dailyRequests: dailyRequests ?? 0 }),
      })
      toast.success("限额已保存（下一次大模型调用起生效）")
      await load(days)
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const usedPct = data && data.limits.dailyTokens > 0
    ? Math.min(100, Math.round((data.today.tokens / data.limits.dailyTokens) * 100))
    : 0
  const overLimit = !!(data?.limits.enabled && data.limits.dailyTokens > 0 && data.today.tokens >= data.limits.dailyTokens)

  const balanceText = (() => {
    const b = data?.balance
    if (!b) return "-"
    if (!b.ok) return `未知（${b.reason || "接口不可用"}）`
    const infos = b.infos || []
    if (!infos.length) return "未知"
    return infos.map((i) => `${i.total_balance ?? "?"} ${i.currency ?? ""}`).join(" / ")
  })()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-xl font-semibold">🔋 模型用量</h1>
        <p className="mt-1 mb-0 text-sm text-zinc-500">
          当前 provider：<b>{data?.model ?? "-"}</b>（key {data?.keyMask || "-"}
          {data && data.keyCount > 1 ? `，共 ${data.keyCount} 把轮换` : ""}）。
          用量是我们自己记的账（表 <code>llm_usage</code>）：DeepSeek 只给余额、没有按天用量接口。
        </p>
      </div>

      {overLimit && (
        <Alert type="error" showIcon
          message="今天的额度已用完 —— 大模型调用会被直接拒绝（判分/翻译会降级为本地实现）"
          description="要临时放开就把「每日 token 上限」调大或关掉限额；明天 0 点自动归零。" />
      )}

      <Space size={8} wrap>
        <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void load(days)}>刷新</Button>
        <span className="text-xs text-zinc-400">统计窗口</span>
        {[7, 14, 30].map((d) => (
          <Button key={d} size="small" type={days === d ? "primary" : "default"} onClick={() => setDays(d)}>{d} 天</Button>
        ))}
      </Space>

      <Card size="small">
        <Space size={48} wrap>
          <Statistic title="今日 tokens" value={data?.today.tokens ?? 0} formatter={(v) => fmt(Number(v))} />
          <Statistic title="今日请求" value={data?.today.requests ?? 0} formatter={(v) => fmt(Number(v))} />
          <Statistic title="每日上限" value={data?.limits.dailyTokens || 0}
            formatter={(v) => (Number(v) > 0 ? fmt(Number(v)) : "不限制")} />
          <Statistic title="剩余" value={data?.remainingTokens ?? -1}
            formatter={(v) => (Number(v) < 0 ? "不限制" : fmt(Number(v)))} />
          <Statistic title="用掉" value={usedPct} suffix="%" />
          <Statistic title="账户余额" value={balanceText} valueStyle={{ fontSize: 16 }} />
        </Space>
      </Card>

      <Card size="small" title="每日限额（整份替换，0 = 该维度不限制）">
        <Space size={24} wrap align="center">
          <Space size={8}>
            <span className="text-sm">启用限额</span>
            <Switch checked={enabled} onChange={setEnabled} />
            <Tooltip title="关掉后不做任何拦截（账本照记）">
              <span className="text-xs text-zinc-400">关掉 = 只记账不拦</span>
            </Tooltip>
          </Space>
          <Space size={8}>
            <span className="text-sm">每日 token 上限</span>
            <InputNumber min={0} step={10000} style={{ width: 160 }} value={dailyTokens ?? 0}
              onChange={(v) => setDailyTokens(typeof v === "number" ? v : 0)} />
          </Space>
          <Space size={8}>
            <span className="text-sm">每日请求上限</span>
            <InputNumber min={0} step={50} style={{ width: 140 }} value={dailyRequests ?? 0}
              onChange={(v) => setDailyRequests(typeof v === "number" ? v : 0)} />
          </Space>
          <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={() => void save()}>保存限额</Button>
        </Space>
        <div className="mt-2 text-xs text-zinc-400">
          超限时所有大模型调用会直接失败（异常里写明已用/上限）。之所以"直接失败"而不是静默降级：
          静默会让人以为模型坏了。
        </div>
      </Card>

      <Card size="small" title={`按天（最近 ${days} 天）`}>
        <Table<DayRow> size="small" rowKey="day" pagination={false} dataSource={data?.days || []}
          columns={[
            { title: "日期", dataIndex: "day", width: 140, render: (v) => String(v).slice(0, 10) },
            { title: "请求", dataIndex: "requests", width: 100, render: (v) => fmt(v) },
            { title: "tokens", dataIndex: "tokens", width: 140, render: (v) => fmt(v) },
            {
              title: "失败", dataIndex: "failures", width: 100,
              render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <span className="text-zinc-400">0</span>),
            },
          ]}
          locale={{ emptyText: "还没有用量记录（切到 DeepSeek 之后第一次调用才会有）" }} />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card size="small" title="按模型">
          <Table<AggRow> size="small" rowKey="model" pagination={false} dataSource={data?.byModel || []}
            columns={[
              { title: "模型", dataIndex: "model" },
              { title: "请求", dataIndex: "requests", width: 90, render: (v) => fmt(v) },
              { title: "tokens", dataIndex: "tokens", width: 120, render: (v) => fmt(v) },
            ]} />
        </Card>
        <Card size="small" title="按 key（掩码）">
          <Table<AggRow> size="small" rowKey="key_mask" pagination={false} dataSource={data?.byKey || []}
            columns={[
              { title: "key", dataIndex: "key_mask", render: (v) => <code>{v || "-"}</code> },
              { title: "请求", dataIndex: "requests", width: 90, render: (v) => fmt(v) },
              { title: "tokens", dataIndex: "tokens", width: 120, render: (v) => fmt(v) },
            ]} />
        </Card>
      </div>

      <Descriptions size="small" column={1} title="口径说明">
        <Descriptions.Item label="记什么">
          每次调用（成功/失败）一行：模型、key 掩码、token 用量、是否流式、HTTP 状态。
          key 只存掩码，不存明文 —— 否则这张表本身就是泄露源。
        </Descriptions.Item>
        <Descriptions.Item label="限额怎么算">
          只统计<b>今天成功</b>的调用（失败不消耗额度）。token 与请求两个维度取「先到者」。
        </Descriptions.Item>
        <Descriptions.Item label="余额">
          实时查 provider 的 <code>/user/balance</code>（缓存 5 分钟）；换 provider 时该接口可能不存在，页面显示"未知"。
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}
