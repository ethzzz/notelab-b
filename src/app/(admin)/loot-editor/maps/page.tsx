"use client"

// 摸金行动 · 地图配置（CRUD + 容器配比 + 进图门槛 + EV 预览）
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import { blankMap, sanitizeMap, evalMap, type MapDef } from "../_shared/model"

export default function LootMapsPage() {
  const { maps, setMaps, containers, tables, items, balance, busy, save, dirty } = useLoot()
  const [draft, setDraft] = useState<MapDef | null>(null)

  const evByMap = useMemo(() => {
    const m: Record<string, ReturnType<typeof evalMap>> = {}
    for (const mp of maps) m[mp.id] = evalMap(mp, containers, tables, items, balance)
    return m
  }, [maps, containers, tables, items, balance])

  const ctnOptions = useMemo(() => containers.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}（${c.id}）` })), [containers])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeMap(draft)
    if (!clean) { toast.warning("地图不合法：需要 id 与名称"); return }
    setMaps((l) => {
      const i = l.findIndex((e) => e.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const setCtn = (idx: number, patch: Partial<{ containerId: string; count: number }>) =>
    setDraft((d) => d ? { ...d, containers: d.containers.map((c, j) => j === idx ? { ...c, ...patch } : c) } : d)

  const columns = [
    { title: "地图", dataIndex: "name", render: (_: any, m: MapDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">🗺️ {m.name}</span> },
    { title: "容器数", dataIndex: "containers", width: 100, render: (c: MapDef["containers"]) => `${c.reduce((s, x) => s + x.count, 0)} 个` },
    { title: "时限", dataIndex: "timeLimitSec", width: 90, render: (v: number) => `${v}s` },
    { title: "风险上限", dataIndex: "riskLimit", width: 100 },
    { title: "价值倍率", dataIndex: "valueMult", width: 100 },
    { title: "门槛", dataIndex: "entry", width: 170, render: (e: MapDef["entry"]) => (
      <span className="text-xs">💰{e.coins}{e.minExtracts ? ` · 撤离${e.minExtracts}次` : ""}{e.groups.length ? ` · 组${e.groups.length}` : ""}</span>
    ) },
    { title: "EV 倍率", dataIndex: "id", width: 130, render: (id: string) => {
      const ev = evByMap[id]
      if (!ev) return null
      const color = ev.level === "reject" ? "red" : ev.level === "warn" ? "orange" : "green"
      return <Tag color={color}>{ev.ratio.toFixed(2)}×</Tag>
    } },
    actionColumn((_: any, m: MapDef) => actBtns(
      () => setDraft(JSON.parse(JSON.stringify(m))),
      () => setMaps((l) => l.filter((x) => x.id !== m.id)),
      m.name,
    ), 140),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🗺️ 地图配置"
        hint={`共 ${maps.length} 张图；EV 倍率 = 期望收益 ÷ 门槛，建议落在 1.5–3.5，超标在「全局参数」页会被拒绝保存`}
        onSave={save} saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-sm text-zinc-500">容器需先在「容器配置」页建好，这里按 id + 数量摆放</span>
          <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankMap())}>新建地图</Button>
        </div>
        <DataTable size="middle" columns={columns as any} dataSource={maps} pagination={false}
          locale={{ emptyText: emptyHint("暂无地图，点右上角「新建地图」开始配置") }} />
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`🗺️ ${maps.some((e) => e.id === draft.id) ? "编辑" : "新建"}地图`} width={760}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-3 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="时限（秒）"><InputNumber min={30} max={3600} className="!w-full" value={draft.timeLimitSec} onChange={(v) => setDraft({ ...draft, timeLimitSec: v ?? 300 })} /></Form.Item>
              <Form.Item label="风险上限"><InputNumber min={1} max={999} className="!w-full" value={draft.riskLimit} onChange={(v) => setDraft({ ...draft, riskLimit: v ?? 20 })} /></Form.Item>
              <Form.Item label="价值倍率"><InputNumber min={0.01} max={100} step={0.05} className="!w-full" value={draft.valueMult} onChange={(v) => setDraft({ ...draft, valueMult: v ?? 0.35 })} /></Form.Item>
              <Form.Item label="稀有度加成 tierBoost"><InputNumber min={0} max={10} step={0.1} className="!w-full" value={draft.tierBoost} onChange={(v) => setDraft({ ...draft, tierBoost: v ?? 0 })} /></Form.Item>
              <Form.Item label="撤离点数量"><InputNumber min={1} max={9} className="!w-full" value={draft.extractPoints} onChange={(v) => setDraft({ ...draft, extractPoints: v ?? 2 })} /></Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="门槛金币"><InputNumber min={0} className="!w-full" value={draft.entry.coins} onChange={(v) => setDraft({ ...draft, entry: { ...draft.entry, coins: v ?? 0 } })} /></Form.Item>
              <Form.Item label="门槛：最少已撤离次数"><InputNumber min={0} className="!w-full" value={draft.entry.minExtracts} onChange={(v) => setDraft({ ...draft, entry: { ...draft.entry, minExtracts: v ?? 0 } })} /></Form.Item>
            </div>

            <Form.Item label="容器配比（id + 数量）">
              <div className="flex flex-col gap-2">
                {draft.containers.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select className="!w-72" value={c.containerId || undefined} placeholder="选择容器…" options={ctnOptions}
                      onChange={(v) => setCtn(i, { containerId: v })} />
                    <InputNumber min={0} max={99} addonAfter="个" value={c.count} onChange={(v) => setCtn(i, { count: v ?? 1 })} />
                    <Button size="small" type="text" danger onClick={() => setDraft({ ...draft, containers: draft.containers.filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
                <Button size="small" icon={<Plus size={12} />} onClick={() => setDraft({ ...draft, containers: [...draft.containers, { containerId: "", count: 1 }] })}>添加容器</Button>
              </div>
            </Form.Item>

            <div className="rounded-lg bg-black/[0.02] dark:bg-white/[0.04] p-3 text-xs text-zinc-500">
              {(() => {
                const ev = evalMap(draft, containers, tables, items, balance)
                const color = ev.level === "reject" ? "text-rose-500" : ev.level === "warn" ? "text-amber-500" : "text-emerald-600"
                return <>当前 EV 倍率：<b className={color}>{ev.ratio.toFixed(2)}×</b>（全摸满毛收益约 {ev.gross} 面值；门槛 {draft.entry.coins}）</>
              })()}
            </div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
