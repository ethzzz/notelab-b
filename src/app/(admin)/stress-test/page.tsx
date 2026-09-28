"use client"
// 接口压测（服务端代理转发）：手动输入 API 地址 + 配置请求参数 + 并发/总量/时长/爬坡，
// 后端 /api/admin/stress-test 真正并发发请求并以 SSE 实时回传进度与汇总。
// 仅超级管理员可用（接口归受限前缀 /api/admin，普通角色既无菜单入口也无权限码）。
import { useCallback, useMemo, useRef, useState } from "react"
import {
  Alert, Button, Card, Collapse, Descriptions, Divider, Input, InputNumber, Progress,
  Segmented, Space, Statistic, Table, Tag, Typography,
} from "antd"
import { PlayCircle, Square } from "lucide-react"

const { Text, Paragraph } = Typography
const METHODS = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]

type KV = { key: string; value: string }
type Progress = { completed: number; success: number; failed: number; qps: number; elapsedMs: number }
type Summary = {
  total: number; success: number; failed: number; durationMs: number; qps: number; bytesReceived: number
  latency: Record<string, number>; statusCodes: Record<string, number>; errors: { ts: number; message: string }[]
}
type Event = { type: string; [k: string]: any }

function KVEditor({ title, value, onChange, placeholderKey, placeholderVal }: {
  title: string; value: KV[]; onChange: (v: KV[]) => void
  placeholderKey: string; placeholderVal: string
}) {
  function set(i: number, patch: Partial<KV>) {
    onChange(value.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  return (
    <div className="flex flex-col gap-2">
      <Text strong className="!text-zinc-600 dark:!text-zinc-300">{title}</Text>
      {value.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="!font-mono !text-xs flex-1" placeholder={placeholderKey} value={r.key}
            onChange={(e) => set(i, { key: e.target.value })} />
          <Input className="!font-mono !text-xs flex-1" placeholder={placeholderVal} value={r.value}
            onChange={(e) => set(i, { value: e.target.value })} />
          <Button size="small" danger type="text" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>✕</Button>
        </div>
      ))}
      <Button size="small" type="dashed" className="!w-fit" onClick={() => onChange([...value, { key: "", value: "" }])}>
        ＋ 添加一行
      </Button>
    </div>
  )
}

export default function StressTestPage() {
  const [url, setUrl] = useState("")
  const [method, setMethod] = useState("GET")
  const [headers, setHeaders] = useState<KV[]>([])
  const [query, setQuery] = useState<KV[]>([])
  const [body, setBody] = useState("")
  const [concurrency, setConcurrency] = useState(10)
  const [totalRequests, setTotalRequests] = useState(100)
  const [durationSec, setDurationSec] = useState(10)
  const [rampUpSec, setRampUpSec] = useState(0)
  const [stopMode, setStopMode] = useState<"total" | "duration">("total")

  const [running, setRunning] = useState(false)
  const [denied, setDenied] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [progress, setProgress] = useState<Progress | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string>("")

  const buildConfig = useCallback(() => {
    const clean = (rows: KV[]) => {
      const m: Record<string, string> = {}
      rows.forEach((r) => { if (r.key.trim()) m[r.key.trim()] = r.value })
      return m
    }
    const cfg: any = {
      url: url.trim(), method,
      headers: clean(headers), query: clean(query),
      body: method === "GET" || method === "HEAD" ? "" : body,
      concurrency: Number(concurrency) || 10,
      rampUpSec: Number(rampUpSec) || 0,
    }
    if (stopMode === "duration") { cfg.durationSec = Number(durationSec) || 0; cfg.totalRequests = 1 }
    else { cfg.totalRequests = Number(totalRequests) || 100; cfg.durationSec = 0 }
    return cfg
  }, [url, method, headers, query, body, concurrency, rampUpSec, durationSec, totalRequests, stopMode])

  const parseStream = useCallback(async (res: Response) => {
    if (res.status === 401) { setDenied(true); setRunning(false); return }
    if (res.status === 403) { setDenied(true); setRunning(false); return }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const line = frame.split("\n").find((l) => l.startsWith("data:"))
        if (!line) continue
        const json = line.slice(5).trim()
        if (!json) continue
        try {
          const ev: Event = JSON.parse(json)
          if (ev.type === "start") runIdRef.current = ev.runId
          else if (ev.type === "progress") setProgress({ completed: ev.completed, success: ev.success, failed: ev.failed, qps: ev.qps, elapsedMs: ev.elapsedMs })
          else if (ev.type === "done") { setSummary(ev as unknown as Summary); setRunning(false); abortRef.current = null }
          else if (ev.type === "error") { setErrorMsg(String(ev.message || "未知错误")); setRunning(false); abortRef.current = null }
        } catch { /* 忽略坏帧 */ }
      }
    }
  }, [])

  async function start() {
    if (!url.trim()) { setErrorMsg("请填写目标 API 地址"); return }
    if (!url.trim().startsWith("http://") && !url.trim().startsWith("https://")) {
      setErrorMsg("URL 必须以 http:// 或 https:// 开头"); return
    }
    setErrorMsg(""); setSummary(null); setProgress(null); setRunning(true)
    runIdRef.current = ""
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch("/api/admin/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfig()),
        credentials: "include",
        signal: ac.signal,
      })
      await parseStream(res)
    } catch (e: any) {
      if (e.name === "AbortError") { setErrorMsg("已手动停止"); }
      else { setErrorMsg(e.message || "请求失败"); }
      setRunning(false)
    }
  }

  async function stop() {
    const rid = runIdRef.current
    abortRef.current?.abort()
    abortRef.current = null
    setRunning(false)
    if (rid) {
      try { await fetch(`/api/admin/stress-test/${rid}/cancel`, { method: "POST", credentials: "include" }) } catch { /* ignore */ }
    }
  }

  const total = stopMode === "duration" ? Math.max(progress?.completed ?? 0, 1) : totalRequests
  const pct = progress ? Math.min(100, Math.round((progress.completed / Math.max(total, 1)) * 100)) : 0

  const statusRows = useMemo(() => Object.entries(summary?.statusCodes || {})
    .map(([code, n]) => ({ code, n, color: code.startsWith("2") ? "green" : code.startsWith("3") ? "blue" : code.startsWith("4") ? "gold" : "red" }))
    .sort((a, b) => a.code.localeCompare(b.code)), [summary])

  const errorCols = [
    { title: "相对时间(ms)", dataIndex: "ts", width: 130, render: (v: number) => <span className="font-mono text-xs">{v}</span> },
    { title: "错误信息", dataIndex: "message", render: (v: string) => <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 break-all">{v}</span> },
  ]

  if (denied) return <Card className="text-center text-zinc-500 dark:text-zinc-400 py-8">🔒 接口压测仅超级管理员可用（服务端代理发请求，存在 SSRF/DoS 风险）。</Card>

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold mb-0">接口压测</h1>
        <Tag color="volcano">🔥 仅超级管理员</Tag>
        <Tag color="blue">服务端代理转发（突破 CORS）</Tag>
      </div>
      <Paragraph className="!mb-0 !text-zinc-500 dark:!text-zinc-400 !text-sm">
        手动填写目标 API 地址并配置请求参数，由服务器真正并发发起请求，支持按总请求数或时长停止、并发爬坡。
        结果含 QPS、延迟分位（p50/p95/p99）、状态码分布与错误样本。
      </Paragraph>

      {errorMsg && <Alert type="error" showIcon message={errorMsg} closable onClose={() => setErrorMsg("")} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ---------------- 配置 ---------------- */}
        <Card size="small" title="压测配置">
          <div className="flex gap-2 mb-3">
            <Select value={method} onChange={setMethod} style={{ width: 110 }}
              options={METHODS.map((m) => ({ value: m, label: m }))} />
            <Input className="!font-mono !text-xs flex-1" placeholder="https://api.example.com/path" value={url}
              onChange={(e) => setUrl(e.target.value)} />
          </div>

          <Collapse size="small" className="!mb-3"
            items={[
              { key: "headers", label: "请求头 Headers", children: <KVEditor title="" value={headers} onChange={setHeaders} placeholderKey="Header-Name" placeholderVal="value" /> },
              { key: "query", label: "Query 参数", children: <KVEditor title="" value={query} onChange={setQuery} placeholderKey="key" placeholderVal="value" /> },
              { key: "body", label: "请求体 Body" + (method === "GET" || method === "HEAD" ? "（GET/HEAD 忽略）" : ""),
                children: <Input.TextArea className="!font-mono !text-xs" autoSize={{ minRows: 4, maxRows: 10 }} value={body}
                  onChange={(e) => setBody(e.target.value)} placeholder='JSON / form / 任意文本，仅 POST/PUT 生效' /> },
            ]}
          />

          <Divider className="!my-3" />
          <div className="flex items-center gap-2 mb-3">
            <Text strong className="!text-zinc-600 dark:!text-zinc-300">停止条件</Text>
            <Segmented value={stopMode} onChange={(v) => setStopMode(v as "total" | "duration")}
              options={[{ label: "按总请求数", value: "total" }, { label: "按时长", value: "duration" }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Text className="!text-xs !text-zinc-500">并发数 (1-200)</Text>
              <InputNumber min={1} max={200} value={concurrency} onChange={(v) => setConcurrency(v ?? 10)} className="!w-full" />
            </div>
            {stopMode === "total" ? (
              <div>
                <Text className="!text-xs !text-zinc-500">总请求数 (1-100000)</Text>
                <InputNumber min={1} max={100000} value={totalRequests} onChange={(v) => setTotalRequests(v ?? 100)} className="!w-full" />
              </div>
            ) : (
              <div>
                <Text className="!text-xs !text-zinc-500">时长（秒，1-600）</Text>
                <InputNumber min={1} max={600} value={durationSec} onChange={(v) => setDurationSec(v ?? 10)} className="!w-full" />
              </div>
            )}
            <div>
              <Text className="!text-xs !text-zinc-500">爬坡（秒，0=瞬时）</Text>
              <InputNumber min={0} max={600} value={rampUpSec} onChange={(v) => setRampUpSec(v ?? 0)} className="!w-full" />
            </div>
          </div>

          <Space className="!mt-4">
            <Button type="primary" icon={<PlayCircle size={16} />} loading={running} onClick={start}>开始压测</Button>
            <Button danger icon={<Square size={14} />} disabled={!running} onClick={stop}>停止</Button>
          </Space>
        </Card>

        {/* ---------------- 实时结果 ---------------- */}
        <Card size="small" title="实时结果">
          {!progress && !summary && <div className="text-sm text-zinc-400 py-8 text-center">尚未开始</div>}
          {progress && (
            <div className="flex flex-col gap-3">
              <Progress percent={stopMode === "duration" ? 0 : pct} status={running ? "active" : "normal"}
                format={() => stopMode === "duration" ? "时长模式" : `${pct}%`} />
              <div className="grid grid-cols-3 gap-2">
                <Statistic title="已完成" value={progress.completed} />
                <Statistic title="当前 QPS" value={progress.qps} precision={1} />
                <Statistic title="已用时" value={(progress.elapsedMs / 1000).toFixed(1)} suffix="s" />
                <Statistic title="成功" value={progress.success} valueStyle={{ color: "#52c41a" }} />
                <Statistic title="失败" value={progress.failed} valueStyle={{ color: "#ff4d4f" }} />
                <Statistic title="成功率" value={progress.completed ? ((progress.success / progress.completed) * 100).toFixed(1) : "0"} suffix="%" />
              </div>
            </div>
          )}
          {summary && (
            <div className="flex flex-col gap-3">
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="总请求">{summary.total}</Descriptions.Item>
                <Descriptions.Item label="QPS">{summary.qps}</Descriptions.Item>
                <Descriptions.Item label="成功"><span className="text-green-600">{summary.success}</span></Descriptions.Item>
                <Descriptions.Item label="失败"><span className="text-red-500">{summary.failed}</span></Descriptions.Item>
                <Descriptions.Item label="耗时">{(summary.durationMs / 1000).toFixed(2)} s</Descriptions.Item>
                <Descriptions.Item label="接收字节">{(summary.bytesReceived / 1024).toFixed(1)} KB</Descriptions.Item>
              </Descriptions>
              <Descriptions size="small" column={3} bordered title="延迟（ms）">
                <Descriptions.Item label="最小">{summary.latency.min}</Descriptions.Item>
                <Descriptions.Item label="平均">{summary.latency.avg}</Descriptions.Item>
                <Descriptions.Item label="最大">{summary.latency.max}</Descriptions.Item>
                <Descriptions.Item label="p50">{summary.latency.p50}</Descriptions.Item>
                <Descriptions.Item label="p95">{summary.latency.p95}</Descriptions.Item>
                <Descriptions.Item label="p99">{summary.latency.p99}</Descriptions.Item>
              </Descriptions>
              <div>
                <Text strong className="!text-zinc-600 dark:!text-zinc-300">状态码分布</Text>
                <div className="flex flex-wrap gap-2 mt-1">
                  {statusRows.length === 0 && <Text type="secondary">无</Text>}
                  {statusRows.map((r) => <Tag key={r.code} color={r.color}>{r.code} × {r.n}</Tag>)}
                </div>
              </div>
              {summary.errors && summary.errors.length > 0 && (
                <div>
                  <Text strong className="!text-zinc-600 dark:!text-zinc-300">错误样本（前 {summary.errors.length} 条）</Text>
                  <Table rowKey={(r, i) => String(i)} size="small" className="!mt-1" pagination={false}
                    columns={errorCols as any} dataSource={summary.errors} scroll={{ y: 180 }} />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
