"use client"

// 运维看板（超管专属）
//
// 为什么要有它：部署后的人工验证一直是"ssh 手敲一串命令"（pm2 list / 各端口 curl / df free /
// git rev-parse），而且几类事故只能靠人记：保存了没发布、构建了没重启、服务器副本落后远端、
// 改了启动配置没 pm2 save。这里把**只读**信息聚成一页，并把发布后的验证固化成一份可判定清单。
//
// 边界：本页只做读取。重启/拉代码/构建仍然走 ssh —— 不把部署的写能力暴露到 Web 页面上。
// 接口在受限前缀 /api/admin/ops（PermGuard 仅放行 super_admin），非超管拿到 403 时给出明确提示。
import { useCallback, useEffect, useState } from "react"
import { Alert, Button, Card, Progress, Space, Spin, Switch, Table, Tag, Tooltip } from "antd"
import { Activity, PlayCircle, RefreshCw } from "lucide-react"
import AdminPage from "@/components/admin/AdminPage"
import { apiJson } from "@/lib/api"

interface GitInfo {
  commit: string | null
  subject?: string
  date?: string
  dirty?: number
  ahead?: number
  behind?: number
}

interface SvcRow {
  key: string
  name: string
  port: number
  dir: string
  probe: string
  http: { code: number; ms: number }
  up: boolean
  git: GitInfo
}

interface ProcRow {
  name: string
  pid?: number
  status?: string
  restarts?: number
  memMb?: number
  cpu?: number
  startedAt?: number
}

interface StatusResp {
  generatedAt: number
  host: {
    diskTotal?: string
    diskUsed?: string
    diskAvail?: string
    diskPercent?: number
    memTotalMb?: number
    memUsedMb?: number
    memPercent?: number
    uptime?: string
  }
  pm2: { ok: boolean; warning?: string; procs: ProcRow[] }
  services: SvcRow[]
}

interface VerifyItem { level: "ok" | "warn" | "fail"; name: string; detail: string }
interface VerifyResp {
  items: VerifyItem[]
  summary: { ok: number; warn: number; fail: number; ms: number; generatedAt: number }
}

const fmtAgo = (ms?: number) => {
  if (!ms) return "—"
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s} 秒前启动`
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前启动`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前启动`
  return `${Math.floor(s / 86400)} 天 ${Math.floor((s % 86400) / 3600)} 小时前启动`
}

const LEVEL_TAG: Record<VerifyItem["level"], { color: string; text: string }> = {
  ok: { color: "green", text: "通过" },
  warn: { color: "orange", text: "注意" },
  fail: { color: "red", text: "失败" },
}

export default function OpsPage() {
  const [st, setSt] = useState<StatusResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [verify, setVerify] = useState<VerifyResp | null>(null)
  const [vBusy, setVBusy] = useState(false)
  const [auto, setAuto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await apiJson<StatusResp>("/api/admin/ops/status")
      setSt(j)
      setErr(null)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  const runVerify = useCallback(async () => {
    setVBusy(true)
    try {
      setVerify(await apiJson<VerifyResp>("/api/admin/ops/verify"))
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setVBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 自动刷新：只在开关打开时轮询，关掉立即停 —— 避免离开页面还在打接口
  useEffect(() => {
    if (!auto) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [auto, load])

  if (err && !st) {
    return (
      <AdminPage title="🩺 运维看板" description="只读展示部署状态与发布自检">
        <Alert type="error" showIcon message="拿不到运维数据"
          description={<span className="text-xs">
            {err}
            <br />本页与 <code>/api/admin/ops/*</code> 均为<b>超级管理员专属</b>；若你是超管仍报 403，
            说明 PermGuard 的受限前缀未放行（见 <code>PermGuard.RESTRICTED_PREFIXES</code>）。
          </span>} />
      </AdminPage>
    )
  }

  const procs = new Map<string, ProcRow>((st?.pm2.procs || []).map((p) => [String(p.name), p]))
  const host = st?.host || {}

  return (
    <AdminPage
      title="🩺 运维看板"
      description="只读：进程 / 端口探活 / 各仓代码副本 / 主机资源，外加一份「发布自检」清单。重启与构建仍走 ssh。"
      extra={
        <>
          <Space size={4} className="mr-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">自动刷新</span>
            <Switch size="small" checked={auto} onChange={setAuto} />
          </Space>
          <Button size="small" icon={<RefreshCw size={14} />} loading={loading} onClick={load}>刷新</Button>
          <Button size="small" type="primary" icon={<PlayCircle size={14} />} loading={vBusy} onClick={runVerify}>
            运行发布自检
          </Button>
        </>
      }
    >
      {loading && !st ? (
        <div className="py-10 text-center"><Spin /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {st?.pm2.ok === false && (
            <Alert type="warning" showIcon className="!text-xs"
              message={`pm2 进程信息不可用：${st.pm2.warning || "未知原因"}（下方端口探活仍可判断服务是否在监听）`} />
          )}

          {/* 主机资源：部署前先看一眼，避免构建到一半磁盘满 */}
          <Card size="small" title="主机资源" className="shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">磁盘</span>
                  <span>{host.diskUsed || "—"} / {host.diskTotal || "—"}（可用 {host.diskAvail || "—"}）</span>
                </div>
                <Progress percent={host.diskPercent ?? 0}
                  status={host.diskPercent && host.diskPercent >= 85 ? "exception" : undefined} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">内存</span>
                  <span>{host.memUsedMb ?? "—"} MB / {host.memTotalMb ?? "—"} MB</span>
                </div>
                <Progress percent={host.memPercent ?? 0}
                  status={host.memPercent && host.memPercent >= 90 ? "exception" : undefined} />
              </div>
              <div className="flex flex-col justify-center text-xs text-zinc-500 dark:text-zinc-400">
                <span className="line-clamp-2">{host.uptime || "—"}</span>
                {st?.generatedAt && (
                  <span className="mt-1">采集于 {new Date(st.generatedAt).toLocaleTimeString("zh-CN")}</span>
                )}
              </div>
            </div>
          </Card>

          {/* 服务状态：进程 + 端口 + 代码副本（三列对齐，能一眼看出"构建没重启"或"忘了 pull"） */}
          <Card size="small" title="服务状态" className="shadow-sm">
            <Table<SvcRow>
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={st?.services || []}
              columns={[
                {
                  title: "服务", dataIndex: "name", key: "name", width: 140,
                  render: (_, r) => (
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{r.name}</span>
                      <code className="text-[10px] text-zinc-400 dark:text-zinc-500">{r.key}</code>
                    </div>
                  ),
                },
                {
                  title: "进程（pm2）", key: "proc", width: 200,
                  render: (_, r) => {
                    const p = procs.get(r.key)
                    if (!p) return <span className="text-xs text-zinc-400 dark:text-zinc-500">未托管 / 不在 pm2 列表</span>
                    const online = p.status === "online"
                    return (
                      <div className="flex flex-col gap-0.5 text-xs">
                        <Space size={4}>
                          <Tag color={online ? "green" : "red"} className="!mr-0 !text-[10px]">{p.status}</Tag>
                          <span className="text-zinc-500 dark:text-zinc-400">pid {p.pid ?? "—"}</span>
                        </Space>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {p.memMb ?? 0} MB · 重启 {p.restarts ?? 0} 次 · {fmtAgo(p.startedAt)}
                        </span>
                      </div>
                    )
                  },
                },
                {
                  title: "端口探活", key: "http", width: 150,
                  render: (_, r) => (
                    <div className="flex flex-col gap-0.5 text-xs">
                      <Space size={4}>
                        <Tag color={r.up ? "green" : "red"} className="!mr-0 !text-[10px]">
                          {r.up ? `HTTP ${r.http.code}` : "连不上"}
                        </Tag>
                        <span className="text-zinc-400 dark:text-zinc-500">{r.http.ms}ms</span>
                      </Space>
                      <code className="text-[10px] text-zinc-400 dark:text-zinc-500">127.0.0.1:{r.port}{r.probe}</code>
                    </div>
                  ),
                },
                {
                  title: "代码副本（服务器工作目录）", key: "git",
                  render: (_, r) => {
                    const g = r.git || {}
                    if (!g.commit) return <span className="text-xs text-zinc-400 dark:text-zinc-500">目录不存在 / 非 git 仓库</span>
                    const dirty = g.dirty || 0
                    const behind = g.behind || 0
                    const ahead = g.ahead || 0
                    return (
                      <div className="flex flex-col gap-0.5">
                        <Space size={4} wrap>
                          <code className="text-xs">{g.commit}</code>
                          {dirty > 0 && <Tooltip title="有未提交改动：本地 sync-from-server 覆盖时会丢"><Tag color="orange" className="!mr-0 !text-[10px]">脏 {dirty}</Tag></Tooltip>}
                          {behind > 0 && <Tooltip title="服务器副本落后远端：还没 pull"><Tag color="red" className="!mr-0 !text-[10px]">落后 {behind}</Tag></Tooltip>}
                          {ahead > 0 && <Tag color="blue" className="!mr-0 !text-[10px]">领先 {ahead}</Tag>}
                        </Space>
                        <span className="line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {g.date ? `${g.date} · ` : ""}{g.subject || ""}
                        </span>
                      </div>
                    )
                  },
                },
              ]}
            />
          </Card>

          {/* 发布自检：把"部署后人工做的那几项"固化成清单，fail 必须处理，warn 需人工确认 */}
          <Card size="small" title="发布自检"
            className="shadow-sm"
            extra={verify ? (
              <Space size={4}>
                <Tag color="green" className="!mr-0">通过 {verify.summary.ok}</Tag>
                <Tag color="orange" className="!mr-0">注意 {verify.summary.warn}</Tag>
                <Tag color="red" className="!mr-0">失败 {verify.summary.fail}</Tag>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{verify.summary.ms}ms</span>
              </Space>
            ) : <span className="text-[11px] text-zinc-400 dark:text-zinc-500">点右上角「运行发布自检」</span>}
          >
            {!verify ? (
              <div className="flex items-center gap-2 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                <Activity size={14} />
                自检会检查：各服务端口探活、后端鉴权是否生效、C 端内容是否已发布、B 端页面引用的构建号与磁盘是否一致、
                各仓与远端是否对齐、磁盘/内存阈值、pm2 开机快照新鲜度。
              </div>
            ) : (
              <Table<VerifyItem>
                size="small" rowKey="name" pagination={false} dataSource={verify.items}
                columns={[
                  {
                    title: "结果", dataIndex: "level", key: "level", width: 80,
                    render: (v: VerifyItem["level"]) => <Tag color={LEVEL_TAG[v].color} className="!mr-0 !text-[10px]">{LEVEL_TAG[v].text}</Tag>,
                  },
                  { title: "检查项", dataIndex: "name", key: "name", width: 220 },
                  { title: "详情", dataIndex: "detail", key: "detail", render: (v: string) => <span className="text-xs">{v}</span> },
                ]}
              />
            )}
          </Card>
        </div>
      )}
    </AdminPage>
  )
}
