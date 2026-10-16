"use client"
// 博客管理 → 部署状态（用户 2026-10-16 定：**单开一页**，不塞进文章列表）。
//
// 这一页回答三个问题：
//   ① 线上现在跑的是哪一版（最近一次部署的 commit / 状态 / 探活结果）
//   ② 现在能不能改文章（有构建在跑时改文章会被 409 拒 —— 那是刻意的互斥，见 java 侧 BlogDeployService）
//   ③ 上一次为什么失败（日志尾部就在库里，直接展开看，不用登服务器）
//
// 数据源：GET /api/blog/deploy（摘要 + 最近 20 条）、GET /api/blog/deploy/{id}（单条）、
//        POST /api/blog/deploy（手动触发 / 重试）。构建实测 69–80 秒，所以轮询 5 秒足够。
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Button, Card, Descriptions, Drawer, Space, Spin, Tag, Tooltip, Typography } from "antd"
import { Play, RefreshCw, RotateCw } from "lucide-react"
import { AdminPage, DataTable, actionColumn } from "@/components/admin"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

const { Text, Paragraph } = Typography

type Job = {
  id: number
  status: "queued" | "running" | "success" | "failed"
  trigger_kind: string
  trigger_by_name: string
  commit_hash: string
  verify_path: string
  exit_code: number | null
  probe_code: number | null
  duration_ms: number | null
  log_tail: string
  queued_at: string
  started_at: string | null
  finished_at: string | null
}

const STATUS: Record<string, { color: string; label: string }> = {
  queued: { color: "default", label: "排队中" },
  running: { color: "processing", label: "构建中" },
  success: { color: "success", label: "成功" },
  failed: { color: "error", label: "失败" },
}

function fmt(s?: string | null): string {
  if (!s) return "-"
  return String(s).replace("T", " ").slice(0, 19)
}

function secs(ms?: number | null): string {
  return ms ? `${(ms / 1000).toFixed(1)} 秒` : "-"
}

export default function BlogDeployPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [detail, setDetail] = useState<Job | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await apiJson<any>("/api/blog/deploy")
      setData(r)
    } catch (e) {
      toast.error(`加载失败：${(e as Error).message}`)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // 有构建在跑就 5 秒轮询一次；空闲时 20 秒——页面开着时能看到状态自己往前走
  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    const every = data?.active > 0 ? 5000 : 20000
    timer.current = setInterval(() => void load(), every)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [data?.active, load])

  async function trigger() {
    setBusy("trigger")
    try {
      const r = await postJson("/api/blog/deploy", {})
      toast.success(`已排队部署 #${r.jobId}（约 1 分钟）`)
      void load()
    } catch (e) {
      toast.warning((e as Error).message || "没能开始部署")
    } finally { setBusy("") }
  }

  const latest: Job | null = data?.latest || null
  const items: Job[] = data?.items || []

  const columns = useMemo(() => [
    {
      title: "时间", dataIndex: "queued_at", key: "queued_at", width: 170,
      render: (v: string) => <span className="text-xs text-zinc-500">{fmt(v)}</span>,
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 100,
      render: (v: string) => <Tag color={STATUS[v]?.color} className="!m-0">{STATUS[v]?.label || v}</Tag>,
    },
    {
      title: "触发", dataIndex: "trigger_kind", key: "trigger_kind", width: 110,
      render: (v: string, r: Job) => (
        <Tooltip title={`${v === "manual" ? "手动触发" : "发布后自动"} · ${r.trigger_by_name || "-"}`}>
          <span className="text-xs">{v === "manual" ? "手动" : "发布"}{r.trigger_by_name ? ` · ${r.trigger_by_name}` : ""}</span>
        </Tooltip>
      ),
    },
    {
      title: "commit", dataIndex: "commit_hash", key: "commit_hash", width: 100,
      render: (v: string) => v ? <Text code className="!text-xs">{v}</Text> : <span className="text-zinc-400">-</span>,
    },
    {
      title: "退出码 / 探活", key: "codes", width: 130,
      render: (_: unknown, r: Job) => (
        <span className="text-xs">
          <Text type={r.exit_code === 0 ? undefined : "danger"}>{r.exit_code ?? "-"}</Text>
          {" / "}
          <Text type={r.probe_code === 200 ? "success" : r.probe_code == null ? "secondary" : "danger"}>
            {r.probe_code ?? "未取到"}
          </Text>
        </span>
      ),
    },
    { title: "耗时", dataIndex: "duration_ms", key: "duration_ms", width: 100, render: (v: number) => <span className="text-xs">{secs(v)}</span> },
    actionColumn((_: unknown, r: Job) => (
      <Button size="small" type="text" onClick={() => setDetail(r)}>日志</Button>
    ), 80),
  ], [])

  return (
    <AdminPage
      level={1}
      title="🚀 部署状态"
      description="博客是静态站：文章写进博客仓后要构建一次才会上线。这一页看构建进度、结果与失败原因。"
      extra={
        <Space>
          <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void load()}>刷新</Button>
          <Button type="primary" icon={<Play size={14} />} loading={busy === "trigger"}
            disabled={(data?.active ?? 0) > 0} onClick={() => void trigger()}>
            立即部署
          </Button>
        </Space>
      }
    >
      {loading && !data ? (
        <div className="py-10 text-center"><Spin /></div>
      ) : (
        <>
          {data?.active > 0 && (
            <Alert
              type="info" showIcon
              message="正在构建（约 1 分钟）"
              description="构建期间改文章会被拒绝（409）—— 构建脚本要读整个工作区快照，与提交并发会互相踩。等它结束即可继续编辑。"
            />
          )}

          <Card size="small" title="最近一次">
            {!latest ? (
              <Paragraph type="secondary" className="!mb-0">还没有部署记录。点右上角「立即部署」跑一次。</Paragraph>
            ) : (
              <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS[latest.status]?.color} className="!m-0">{STATUS[latest.status]?.label || latest.status}</Tag>
                  {latest.status === "failed" && (
                    <Button size="small" type="link" icon={<RotateCw size={12} />} onClick={() => void trigger()}>重试</Button>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="commit">{latest.commit_hash ? <Text code>{latest.commit_hash}</Text> : "-"}</Descriptions.Item>
                <Descriptions.Item label="耗时">{secs(latest.duration_ms)}</Descriptions.Item>
                <Descriptions.Item label="退出码">
                  <Text type={latest.exit_code === 0 ? undefined : "danger"}>{latest.exit_code ?? "-"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="探活">
                  {latest.verify_path || "/blog/"} → <Text type={latest.probe_code === 200 ? "success" : "danger"}>{latest.probe_code ?? "未取到"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="触发">{latest.trigger_by_name || "-"}（{latest.trigger_kind === "manual" ? "手动" : "发布后自动"}）</Descriptions.Item>
                <Descriptions.Item label="开始">{fmt(latest.started_at)}</Descriptions.Item>
                <Descriptions.Item label="结束">{fmt(latest.finished_at)}</Descriptions.Item>
                <Descriptions.Item label="排队">{fmt(latest.queued_at)}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          <Card size="small" title="配置">
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="部署脚本"><Text code className="!text-xs">{data?.script || "-"}</Text></Descriptions.Item>
              <Descriptions.Item label="发布后自动部署">
                {data?.autoDeploy ? <Tag color="green" className="!m-0">开</Tag> : <Tag className="!m-0">关（BLOG_AUTO_DEPLOY=0）</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="博客仓当前 HEAD">
                {data?.headCommit ? <Text code>{data.headCommit}</Text> : "-"}
                {data?.headCommit && latest?.commit_hash && data.headCommit !== latest.commit_hash && (
                  <Text type="warning" className="ml-2 !text-xs">与最近一次部署的 commit 不同 —— 仓里还有没发布的改动</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="同时只跑一个">构建很吃 CPU（这台机器 2 核），并发会互相覆盖产物。</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={`历史（最近 ${items.length} 次）`}>
            <DataTable
              size="middle" rowKey="id" columns={columns as never} dataSource={items}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </Card>
        </>
      )}

      <Drawer
        open={!!detail} onClose={() => setDetail(null)} width={760}
        title={detail ? `部署 #${detail.id}（${STATUS[detail.status]?.label || detail.status}）` : ""}
      >
        {detail && (
          <div className="flex flex-col gap-3">
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="commit">{detail.commit_hash || "-"}</Descriptions.Item>
              <Descriptions.Item label="耗时">{secs(detail.duration_ms)}</Descriptions.Item>
              <Descriptions.Item label="退出码">{detail.exit_code ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="探活">{detail.verify_path || "/blog/"} → {detail.probe_code ?? "未取到"}</Descriptions.Item>
            </Descriptions>
            <div className="text-sm text-zinc-500">
              下面是脚本的输出尾部（最多 8000 字符，落库的就是这些 —— 失败原因不用登服务器看）。
            </div>
            <pre className="max-h-[62vh] overflow-auto rounded bg-black/5 dark:bg-white/5 p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {detail.log_tail || "（没有输出）"}
            </pre>
          </div>
        )}
      </Drawer>
    </AdminPage>
  )
}
