"use client"
// 系统管理 → 模型与平台（2026-10-20 加）
//
// 这一页只做三件事：① 看有哪些平台（**key 只显示掩码**，明文永远不出现在响应里）；
// ② 探测某平台真实可用的模型（仅候选参考）；③ 改「别名 → 平台+模型」与「可选模型清单」。
//
// ⚠️ 平台的 baseUrl / protocol / API key **不在页面里改**：它们在服务器环境变量里，改要动
//    /root/Notelab/notelab-java/.env 并重启。页面只读展示，避免"页面上改了半天其实没生效"。
// ⚠️ 保存会立刻生效（ModelRegistry 缓存失效），影响的是**全站**默认模型与用户可选项。
import { useEffect, useState } from "react"
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Tooltip } from "antd"
import { Save, ScanSearch } from "lucide-react"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type Provider = {
  name: string; label: string; protocol: string; baseUrl: string
  enabled: boolean; keyCount: number; maskedKey: string
}
type Alias = { provider: string; id: string }
type Data = {
  providers: Provider[]
  aliases: Record<string, Alias>
  defaultAlias: string
  catalog: Record<string, string[]>
  models: string[]
  defaultModel: string
}

type AliasRow = { key: string; provider: string; id: string }

export default function LlmPlatformsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [rows, setRows] = useState<AliasRow[]>([])
  const [defaultAlias, setDefaultAlias] = useState("chat")
  const [catalogText, setCatalogText] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState<string>("")
  const [probeResult, setProbeResult] = useState<Record<string, string[]>>({})

  function apply(d: Data) {
    setData(d)
    setRows(Object.entries(d.aliases).map(([key, v]) => ({ key, provider: v.provider, id: v.id })))
    setDefaultAlias(d.defaultAlias || "")
    const ct: Record<string, string> = {}
    for (const [p, ids] of Object.entries(d.catalog || {})) ct[p] = (ids || []).join(", ")
    setCatalogText(ct)
  }

  async function load() {
    setLoading(true)
    try { apply(await apiJson<Data>("/api/admin/llm-platforms")) }
    catch (e: any) { toast.error(`加载失败：${e?.message || e}`) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function probe(p: string) {
    setProbing(p)
    try {
      const r = await apiJson<any>("/api/admin/llm-platforms/probe", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: p }),
      })
      if (r?.ok) { setProbeResult((s) => ({ ...s, [p]: r.models || [] })); toast.success(`${p} 探测到 ${(r.models || []).length} 个模型`) }
      else toast.error(`探测失败：${r?.reason || "未知原因"}`)
    } catch (e: any) { toast.error(`探测失败：${e?.message || e}`) }
    finally { setProbing("") }
  }

  async function save() {
    setSaving(true)
    try {
      const aliases: Record<string, Alias> = {}
      for (const r of rows) if (r.key.trim()) aliases[r.key.trim()] = { provider: r.provider, id: r.id.trim() }
      const catalog: Record<string, string[]> = {}
      for (const [p, txt] of Object.entries(catalogText)) {
        const ids = txt.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
        if (ids.length) catalog[p] = ids
      }
      const d = await apiJson<Data>("/api/admin/llm-platforms", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ aliases, defaultAlias, catalog }),
      })
      apply(d)
      toast.success("已保存（立即生效）")
    } catch (e: any) { toast.error(`保存失败：${e?.message || e}`) }
    finally { setSaving(false) }
  }

  const providers = data?.providers || []
  const providerNames = providers.map((p) => p.name)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-xl font-semibold">🧩 模型与平台</h1>
        <p className="mt-1 mb-0 text-sm text-zinc-500">
          平台（网关地址 / 协议 / API key）来自服务器环境变量，这里<b>只读</b>；能改的是
          <b>别名映射</b>（代码里写的 chat / reasoning / fast 指向哪个平台哪个模型）与
          <b>可选模型清单</b>（用户在聊天页/竞技场能选到的厂商模型名）。
        </p>
      </div>

      <Alert type="info" showIcon
        message="API key 只在服务器上，页面永远拿不到明文"
        description={<>这里只显示「几把 key + 掩码尾部」。要换 key / 加平台：改
          <code> /root/Notelab/notelab-java/.env</code> 的 <code>LLM_PROVIDERS</code> 与
          <code> LLM_&lt;平台&gt;_*</code>，然后 <code>sync-deploy.sh notelab-java</code>。</>} />

      <Card size="small" title="平台" loading={loading}>
        <Table<Provider> size="small" rowKey="name" pagination={false} dataSource={providers}
          columns={[
            { title: "平台", dataIndex: "name", width: 120, render: (v, r) => <Space><b>{v}</b><span className="text-zinc-400 text-xs">{r.label}</span></Space> },
            { title: "协议", dataIndex: "protocol", width: 100, render: (v) => <Tag>{v}</Tag> },
            { title: "网关地址", dataIndex: "baseUrl", ellipsis: true },
            {
              title: "API key", dataIndex: "maskedKey", width: 200,
              render: (v: string, r: Provider) => (
                <Tooltip title="只显示掩码；明文只在服务器环境变量里">
                  <span>{r.keyCount} 把 · <code>{v || "-"}</code></span>
                </Tooltip>
              ),
            },
            { title: "启用", dataIndex: "enabled", width: 80, render: (v) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>) },
            {
              title: "操作", key: "op", width: 220,
              render: (_: any, r: Provider) => (
                <Space direction="vertical" size={2}>
                  <Button size="small" icon={<ScanSearch size={12} />} loading={probing === r.name} onClick={() => void probe(r.name)}>
                    探测可用模型
                  </Button>
                  {(probeResult[r.name] || []).length > 0 && (
                    <Space wrap size={4}>
                      {probeResult[r.name].map((id) => <Tag key={id} color="blue">{id}</Tag>)}
                    </Space>
                  )}
                </Space>
              ),
            },
          ]} />
      </Card>

      <Card size="small" title="别名（代码里的意图 → 具体平台与模型）"
        extra={<Button type="primary" icon={<Save size={14} />} loading={saving} onClick={() => void save()}>保存</Button>}>
        <Table<AliasRow> size="small" rowKey="key" pagination={false} dataSource={rows}
          columns={[
            { title: "别名", dataIndex: "key", width: 140, render: (v: string) => <code>{v}</code> },
            {
              title: "平台", dataIndex: "provider", width: 180,
              render: (v: string, r: AliasRow, i) => (
                <Select value={v} style={{ width: 150 }} options={providerNames.map((p) => ({ value: p, label: p }))}
                  onChange={(nv) => setRows((s) => s.map((x, j) => (j === i ? { ...x, provider: nv } : x)))} />
              ),
            },
            {
              title: "厂商模型名", dataIndex: "id",
              render: (v: string, r: AliasRow, i) => (
                <Input value={v} placeholder="如 deepseek-flash"
                  onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
              ),
            },
          ]} />
        <Space className="mt-3" size={8}>
          <span className="text-sm">默认别名</span>
          <Select value={defaultAlias} style={{ width: 160 }} options={rows.map((r) => ({ value: r.key, label: r.key }))}
            onChange={setDefaultAlias} />
          <span className="text-xs text-zinc-400">前端默认选中它指向的模型；代码里不写别名的调用也都用它</span>
        </Space>
      </Card>

      <Card size="small" title="可选模型清单（用户能在下拉里看到的厂商模型名）">
        <div className="flex flex-col gap-3">
          {providerNames.map((p) => (
            <Space key={p} size={8} align="start">
              <span className="text-sm w-24 inline-block pt-1">{p}</span>
              <Input.TextArea rows={2} style={{ width: 520 }} value={catalogText[p] || ""}
                placeholder="逗号或空格分隔，如：deepseek-flash, deepseek-v4-pro"
                onChange={(e) => setCatalogText((s) => ({ ...s, [p]: e.target.value }))} />
            </Space>
          ))}
          <div className="text-xs text-zinc-400">
            不在清单里的模型名会被<b>本地拒绝</b>（不会转发给平台换一个 400）——
            这也是"老会话存着旧模型名"不再报错的原因：页面会自动回落到清单里第一个可用模型。
          </div>
        </div>
      </Card>

      <Card size="small" title="当前生效">
        <Space size={16} wrap>
          <span>默认别名：<b>{data?.defaultAlias || "-"}</b></span>
          <span>默认模型：<b>{data?.defaultModel || "-"}</b></span>
          <span>可选模型：<b>{(data?.models || []).join(" / ") || "-"}</b></span>
        </Space>
      </Card>
    </div>
  )
}
