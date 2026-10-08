"use client"

// 登录审计（超管专属 · /admin/login-audit）
//
// 为什么有这一页：修 SECRET_KEY 默认值漏洞时，最大的问题不是漏洞本身，而是
// **判断不了它有没有被利用过** —— 仓库里没有任何登录留痕。analytics_events 只记成功、
// IP 是加盐哈希（故意不可逆）、90 天就删，做不了取证。所以补了 login_audit 表 + 这一页。
//
// 边界：
// - **只读**。没有任何删除入口（清理由 LoginAuditScheduler 在 4:45 按 365 天保留期做）。
// - ⚠️ 它防的是**密码猜测 / 撞库**；防不住**伪造会话 token** 那一类攻击 ——
//    那种攻击不经过登录接口，这里不会有记录。会话/敏感操作要可追溯需另建操作审计表。
//
// 接口：GET /api/admin/ops/login-audit（受限前缀 /api/admin/ops，仅 super_admin）

import { useCallback, useEffect, useState } from "react"
import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Tag } from "antd"
import { RefreshCw } from "lucide-react"
import AdminPage from "@/components/admin/AdminPage"
import { DataTable } from "@/components/admin"
import { apiJson } from "@/lib/api"

type Row = {
  id: number
  ts: string
  app: string
  username: string
  user_id: number | null
  result: string
  ip: string
  ua: string | null
}

type Resp = {
  day: string
  page: number
  size: number
  total: number
  items: Row[]
  byResult: { result: string; n: number }[]
}

/** 结果码 → 展示口径（与后端 com.notelab.service.LoginAudit 的常量一一对应，只增不改） */
const META: Record<string, { label: string; color: string }> = {
  success: { label: "成功", color: "green" },
  bad_password: { label: "密码错误", color: "red" },
  no_such_user: { label: "账号不存在", color: "volcano" },
  disabled: { label: "账号已禁用", color: "orange" },
  rate_limited: { label: "被限流", color: "gold" },
  bad_request: { label: "参数缺失", color: "default" },
}

const RESULT_OPTIONS = [
  { value: "", label: "全部结果" },
  ...Object.entries(META).map(([value, m]) => ({ value, label: m.label })),
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 顶部概览固定看这几档：成功 + 三类失败信号（其余按需用筛选看） */
const HIGHLIGHT = ["success", "bad_password", "no_such_user", "rate_limited"]

export default function LoginAuditPage() {
  // 草稿 vs 生效：输入框改动**不**直接打接口（否则每敲一个字符发一次请求），点「查询」才生效
  const [draft, setDraft] = useState({ day: today(), result: "", ip: "", username: "" })
  const [day, setDay] = useState(draft.day)
  const [result, setResult] = useState("")
  const [ip, setIp] = useState("")
  const [username, setUsername] = useState("")

  const [page, setPage] = useState(1)
  const [size, setSize] = useState(50)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const qs = new URLSearchParams({ day, page: String(page), size: String(size) })
      if (result) qs.set("result", result)
      if (ip.trim()) qs.set("ip", ip.trim())
      if (username.trim()) qs.set("username", username.trim())
      setData(await apiJson<Resp>(`/api/admin/ops/login-audit?${qs.toString()}`))
    } catch (e) {
      setErr(String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }, [day, result, ip, username, page, size])

  useEffect(() => { void load() }, [load])

  const apply = () => {
    setPage(1)
    setDay(draft.day)
    setResult(draft.result)
    setIp(draft.ip)
    setUsername(draft.username)
  }

  const countOf = (k: string) => data?.byResult.find((x) => x.result === k)?.n ?? 0

  return (
    <AdminPage
      title="登录审计"
      description="每一次登录尝试的留痕（成功与失败都记）· 只读 · 明细保留 365 天"
      extra={
        <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      }
    >
      {err && <Alert type="error" showIcon className="mb-3" message={err} />}

      <Alert
        type="info"
        showIcon
        className="mb-3"
        message="这一页防的是「密码猜测 / 撞库」——失败尝试才是主要信号"
        description="它防不住「伪造会话 token」那类攻击：那种攻击根本不经过登录接口，这里不会有记录。IP 取自 X-Real-IP（客户端伪造 X-Forwarded-For 无效）。"
      />

      <Card size="small" className="mb-3">
        <Space wrap>
          <Input
            type="date"
            value={draft.day}
            max={today()}
            onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            style={{ width: 156 }}
          />
          <Button size="small" onClick={() => setDraft({ ...draft, day: today() })}>今天</Button>
          <Select
            value={draft.result}
            onChange={(v) => setDraft({ ...draft, result: v ?? "" })}
            options={RESULT_OPTIONS}
            style={{ width: 148 }}
          />
          <Input
            placeholder="IP（精确匹配）"
            value={draft.ip}
            onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
            onPressEnter={apply}
            allowClear
            style={{ width: 176 }}
          />
          <Input
            placeholder="用户名（精确匹配）"
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            onPressEnter={apply}
            allowClear
            style={{ width: 190 }}
          />
          <Button type="primary" onClick={apply}>查询</Button>
        </Space>
      </Card>

      <Row gutter={[12, 12]} className="mb-3">
        {HIGHLIGHT.map((k) => (
          <Col xs={12} md={6} key={k}>
            <Card size="small">
              <Statistic
                title={META[k].label}
                value={countOf(k)}
                valueStyle={k !== "success" && countOf(k) > 0 ? { color: "#cf1322" } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <DataTable<Row>
        columns={[
          {
            title: "时间", dataIndex: "ts", width: 172,
            render: (v: string) => <span className="font-mono text-xs">{v}</span>,
          },
          {
            title: "端", dataIndex: "app", width: 72,
            render: (v: string) => <Tag color={v === "b" ? "blue" : "cyan"}>{v === "b" ? "后台" : "C端"}</Tag>,
          },
          {
            title: "用户名", dataIndex: "username", width: 170,
            render: (v: string) => v || <span className="text-zinc-400 dark:text-zinc-500">（空）</span>,
          },
          {
            title: "结果", dataIndex: "result", width: 112,
            render: (v: string) => {
              const m = META[v] || { label: v, color: "default" }
              return <Tag color={m.color}>{m.label}</Tag>
            },
          },
          {
            title: "IP", dataIndex: "ip", width: 150,
            render: (v: string) => <span className="font-mono text-xs">{v}</span>,
          },
          {
            title: "User-Agent", dataIndex: "ua",
            render: (v: string | null) => (
              <span className="text-xs text-zinc-500 dark:text-zinc-400" title={v || ""}>
                {v ? (v.length > 64 ? v.slice(0, 64) + "…" : v) : "—"}
              </span>
            ),
          },
        ]}
        dataSource={data?.items || []}
        loading={loading}
        pagination={{
          current: page,
          pageSize: size,
          total: data?.total || 0,
          onChange: (p: number, s: number) => { setPage(p); setSize(s) },
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200],
          showTotal: (t: number) => `共 ${t} 条`,
        }}
      />
    </AdminPage>
  )
}
