"use client"

// 爬塔工坊 · 地图生成
//
// 产物是**自包含的节点配置 JSON**（不是参数）：一整套含各幕的 nodes + next，
// C 端读到后直接建图，不再自己 roll —— 见 notelab-c/lib/spire-content.ts 与 app/spire/page.tsx。
//
// 生成器在 @/lib/spire-mapgen（从 C 端引擎移植为纯函数 + 带种子可复现），
// 生成后**必过一遍硬约束自校验**：概率性生成器"看着像对的"说明不了任何事。
import { useMemo, useState } from "react"
import {
  Alert, Button, Card, Empty, Input, InputNumber, Popconfirm, Radio, Space, Table, Tag, Tooltip,
} from "antd"
import { Dices, Play, Plus, Wand2 } from "lucide-react"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import type { SpireMapPack } from "@/lib/spire-content"
import {
  DEFAULT_PARAMS, LIMITS, TYPE_LABEL, generateVerified, sanitizeParams,
  type ActMap, type MapGenParams, type NodeType, type RollType, type Violation,
} from "@/lib/spire-mapgen"

const ROLL_TYPES: RollType[] = ["enemy", "elite", "shop", "rest", "random", "event"]

/** 与 C 端 SpireMap 的 TYPE_STYLE 取色一致，预览与实际盘面观感一致 */
const NODE_COLOR: Record<NodeType, string> = {
  enemy: "#a6aec4", elite: "#d8b45c", boss: "#d4717b",
  rest: "#82b47c", shop: "#cda05f", event: "#ab9fd4", random: "#c9a6ff",
}

const newSeed = () => Math.floor(Math.random() * 1_000_000) + 1

/** 单幕地图预览：第 0 层在下方、层号向上递增（与 C 端盘面同向） */
function MapPreview({ act }: { act: ActMap | null }) {
  if (!act) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有可预览的地图" />
  const L = act.layers
  const byRow = new Map<number, typeof act.nodes>()
  for (const n of act.nodes) {
    if (!byRow.has(n.row)) byRow.set(n.row, [])
    byRow.get(n.row)!.push(n)
  }
  const maxCount = Math.max(...[...byRow.values()].map((v) => v.length))
  const COL_W = 56, ROW_H = 34, PAD = 26
  const W = maxCount * COL_W + PAD * 2
  const H = L * ROW_H + PAD * 2
  // 行 r 的 y：第 0 层在最下
  const yOf = (r: number) => PAD + (L - 1 - r) * ROW_H + ROW_H / 2
  const xOf = (row: number, col: number) => {
    const count = byRow.get(row)?.length || 1
    const offset = (maxCount - count) / 2
    return PAD + (col + offset) * COL_W + COL_W / 2
  }
  const byId = new Map(act.nodes.map((n) => [n.id, n] as const))
  const R = 9

  return (
    <div className="overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
      <svg width={W} height={H} className="block">
        {act.nodes.flatMap((n) =>
          n.next.map((id) => {
            const m = byId.get(id)!
            return <line key={`${n.id}->${id}`} x1={xOf(n.row, n.col)} y1={yOf(n.row)}
              x2={xOf(m.row, m.col)} y2={yOf(m.row)} stroke="#8b93a6" strokeWidth={1.2} opacity={0.45} />
          })
        )}
        {act.nodes.map((n) => (
          <g key={n.id}>
            <circle cx={xOf(n.row, n.col)} cy={yOf(n.row)} r={R}
              fill={NODE_COLOR[n.type]} stroke="rgba(0,0,0,.35)" strokeWidth={1} />
            <title>{`${n.id} · ${TYPE_LABEL[n.type]} · 第 ${n.row} 层`}</title>
          </g>
        ))}
        {/* 层号（左侧） */}
        {Array.from({ length: L }, (_, r) => (
          <text key={`t${r}`} x={2} y={yOf(r) + 3} fontSize={8} fill="currentColor" opacity={0.35}>{r}</text>
        ))}
      </svg>
    </div>
  )
}

export default function SpireMapPage() {
  const { maps, setMaps, busy, saveQuiet, dirty } = useSpire()

  const [params, setParams] = useState<MapGenParams>(DEFAULT_PARAMS)
  const [seed, setSeed] = useState<number>(newSeed)
  const [preview, setPreview] = useState<ActMap[] | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [previewAct, setPreviewAct] = useState(1)
  const [packName, setPackName] = useState("")

  const packs = maps.packs
  const activePackId = maps.defaultId || packs[0]?.id || ""
  const activePack = packs.find((p) => p.id === activePackId) || null

  /** 预览源：刚生成的优先，否则看选中的已存方案 */
  const shown: ActMap[] | null = preview ?? (activePack ? (activePack.acts as ActMap[]) : null)
  const shownAct = shown?.find((a) => a.act === previewAct) ?? shown?.[0] ?? null

  const patch = (p: Partial<MapGenParams>) => setParams((prev) => sanitizeParams({ ...prev, ...p }))

  const doGenerate = () => {
    const p = sanitizeParams(params)
    setParams(p)
    const r = generateVerified(p, seed)
    setPreview(r.acts)
    setViolations(r.violations)
    const total = r.acts.reduce((s, a) => s + a.nodes.length, 0)
    if (r.violations.length === 0) {
      toast.success(`已生成 ${r.acts.length} 幕 / 共 ${total} 个节点，硬约束全部通过`)
    } else {
      toast.error(`生成结果有 ${r.violations.length} 处违反硬约束，请勿保存（可换个种子重试）`)
    }
  }

  const saveAsPack = async () => {
    if (!preview) { toast.warning("先点「生成预览」再保存"); return }
    if (violations.length) { toast.error("生成结果未通过硬约束校验，拒绝保存"); return }
    const name = packName.trim() || `方案 ${packs.length + 1}`
    const pack: SpireMapPack = {
      id: `mappack_${Date.now().toString(36)}`,
      name,
      params: { ...params, seed } as unknown as Record<string, unknown>,
      acts: preview.map((a) => ({ act: a.act, layers: a.layers, nodes: a.nodes })),
      createdAt: new Date().toISOString(),
    }
    setMaps((prev) => ({ defaultId: prev.defaultId || pack.id, packs: [...prev.packs, pack] }))
    setPackName("")
    if (await saveQuiet()) toast.success(`已保存方案「${name}」（还需「发布到 C 端」才对玩家生效）`)
  }

  const removePack = (id: string) => setMaps((prev) => {
    const rest = prev.packs.filter((p) => p.id !== id)
    return { defaultId: prev.defaultId === id ? rest[0]?.id : prev.defaultId, packs: rest }
  })

  const renamePack = (id: string, name: string) => setMaps((prev) => ({
    ...prev, packs: prev.packs.map((p) => (p.id === id ? { ...p, name } : p)),
  }))

  /** 把已存方案的参数回填到表单，便于在其基础上微调 */
  const loadParams = (p: SpireMapPack) => {
    if (!p.params) { toast.warning("该方案没有记录参数（可能是早期数据）"); return }
    setParams(sanitizeParams(p.params))
    if (typeof (p.params as any).seed === "number") setSeed((p.params as any).seed)
    toast.success(`已回填「${p.name}」的生成参数`)
  }

  const packColumns = useMemo(() => [
    {
      title: "默认", width: 70,
      render: (_: any, p: SpireMapPack) => (
        <Radio checked={p.id === activePackId}
          onChange={() => setMaps((prev) => ({ ...prev, defaultId: p.id }))} />
      ),
    },
    {
      title: "方案名", dataIndex: "name",
      render: (v: string, p: SpireMapPack) => (
        <Input size="small" value={v} onChange={(e) => renamePack(p.id, e.target.value)} className="!w-56" />
      ),
    },
    { title: "幕数", width: 80, render: (_: any, p: SpireMapPack) => `${p.acts.length}` },
    {
      title: "节点数", width: 90,
      render: (_: any, p: SpireMapPack) => p.acts.reduce((s, a) => s + a.nodes.length, 0),
    },
    {
      title: "创建时间", width: 170,
      render: (_: any, p: SpireMapPack) => <span className="text-xs text-zinc-500">{p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}</span>,
    },
    {
      title: "操作", align: "right" as const, width: 190,
      render: (_: any, p: SpireMapPack) => (
        <Space size={4}>
          <Button size="small" type="text" onClick={() => { setPreview(null); setViolations([]); setMaps((prev) => ({ ...prev, defaultId: p.id })) }}>预览</Button>
          <Button size="small" type="text" onClick={() => loadParams(p)}>参数</Button>
          <Popconfirm title="删除方案" description={`删除「${p.name}」？`} okText="删除" cancelText="取消"
            okButtonProps={{ danger: true }} onConfirm={() => removePack(p.id)}>
            <Button size="small" type="text" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [activePackId, setMaps])

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="🗺️ 地图生成"
        hint="生成的是节点配置 JSON（一次一整套，含各幕）。C 端优先读已发布的地图；没有已发布方案时回落本地随机生成"
        onSave={saveQuiet}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">有未保存改动</span> : null}
      />

      {packs.length === 0 && (
        <Alert type="warning" showIcon
          message="当前没有任何已保存的地图方案"
          description={<span className="text-xs">
            此状态下发布后 C 端 <b>仍按内置生成器现场生成</b>（每局地图都不同）。想让玩家跑固定图，就生成一套并保存、发布。
          </span>} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* ---------------- 参数区 ---------------- */}
        <Card size="small" title="生成参数">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">每幕层数</span>
                <InputNumber size="small" min={LIMITS.layers[0]} max={LIMITS.layers[1]}
                  value={params.layers} onChange={(v) => patch({ layers: v ?? DEFAULT_PARAMS.layers })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">幕数</span>
                <InputNumber size="small" min={LIMITS.acts[0]} max={LIMITS.acts[1]}
                  value={params.acts} onChange={(v) => patch({ acts: v ?? DEFAULT_PARAMS.acts })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">最大列数</span>
                <InputNumber size="small" min={LIMITS.maxColumns[0]} max={LIMITS.maxColumns[1]}
                  value={params.maxColumns} onChange={(v) => patch({ maxColumns: v ?? DEFAULT_PARAMS.maxColumns })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">开局安全层数</span>
                <InputNumber size="small" min={0} max={8}
                  value={params.earlySafeLayers} onChange={(v) => patch({ earlySafeLayers: v ?? 0 })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">主干条数下限</span>
                <InputNumber size="small" min={LIMITS.pathCount[0]} max={LIMITS.pathCount[1]}
                  value={params.pathCount[0]} onChange={(v) => patch({ pathCount: [v ?? 1, params.pathCount[1]] })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">主干条数上限</span>
                <InputNumber size="small" min={LIMITS.pathCount[0]} max={LIMITS.pathCount[1]}
                  value={params.pathCount[1]} onChange={(v) => patch({ pathCount: [params.pathCount[0], v ?? 1] })} />
              </label>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              主干条数会被「最大列数」夹住：两者相等或后者更小时这个区间看不出差别（默认 4 夹住 5~6）。
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium">类型权重与最早层</div>
              <div className="flex flex-col gap-1.5">
                {ROLL_TYPES.map((t) => (
                  <div key={t} className="grid grid-cols-[1fr_78px_78px] items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[t as NodeType] }} />
                      {TYPE_LABEL[t as NodeType]}
                    </span>
                    <InputNumber size="small" className="!w-full" min={LIMITS.weight[0]} max={LIMITS.weight[1]}
                      addonBefore="权重" value={params.weights[t]}
                      onChange={(v) => patch({ weights: { ...params.weights, [t]: v ?? 0 } })} />
                    <InputNumber size="small" className="!w-full" min={LIMITS.minLayer[0]} max={LIMITS.minLayer[1]}
                      addonBefore="层" value={params.minLayer[t]}
                      onChange={(v) => patch({ minLayer: { ...params.minLayer, [t]: v ?? 0 } })} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium">未揭示节点（random）踏入时的揭示池</div>
              <div className="grid grid-cols-2 gap-2">
                {(["normal", "elite", "shop", "rest"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-xs">
                    <span className="w-14 text-zinc-500 dark:text-zinc-400">{TYPE_LABEL[k === "normal" ? "enemy" : (k as NodeType)]}</span>
                    <InputNumber size="small" className="!w-full" min={0} max={999}
                      value={params.revealPool[k]} onChange={(v) => patch({ revealPool: { ...params.revealPool, [k]: v ?? 0 } })} />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">随机种子（同种子 = 同一张图，可复现）</span>
                <InputNumber className="!w-full" value={seed} onChange={(v) => setSeed(v ?? 1)} />
              </label>
              <Tooltip title="换一个种子">
                <Button icon={<Dices size={14} />} onClick={() => setSeed(newSeed())}>换种子</Button>
              </Tooltip>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="primary" icon={<Wand2 size={14} />} onClick={doGenerate} block>生成预览</Button>
              <div className="flex items-center gap-2">
                <Input placeholder="方案名（如：默认三幕）" value={packName} onChange={(e) => setPackName(e.target.value)} />
                <Tooltip title={preview ? "把当前预览存为一套方案" : "先点「生成预览」"}>
                  <Button icon={<Plus size={14} />} disabled={!preview || violations.length > 0} onClick={saveAsPack} loading={busy}>
                    保存为方案
                  </Button>
                </Tooltip>
              </div>
            </div>

            <Button size="small" onClick={() => { setParams(DEFAULT_PARAMS); setSeed(newSeed()); toast.success("参数已恢复默认") }}>
              参数恢复默认
            </Button>
          </div>
        </Card>

        {/* ---------------- 预览区 ---------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {preview ? "预览（未保存）" : activePack ? `预览：${activePack.name}` : "预览"}
            </span>
            {shown && shown.length > 1 && (
              <Radio.Group size="small" value={previewAct} onChange={(e) => setPreviewAct(e.target.value)}
                options={shown.map((a) => ({ value: a.act, label: `第 ${a.act} 幕` }))} optionType="button" />
            )}
            {shownAct && (
              <Tag>{shownAct.layers} 层 · {shownAct.nodes.length} 节点</Tag>
            )}
            {preview && (
              <Button size="small" icon={<Play size={12} />} onClick={() => { setPreview(null); setViolations([]) }}>
                丢弃预览
              </Button>
            )}
          </div>

          {violations.length > 0 && (
            <Alert type="error" showIcon
              message={`生成结果违反 ${violations.length} 条硬约束，已禁止保存`}
              description={
                <div className="max-h-40 overflow-auto text-xs">
                  {violations.slice(0, 12).map((v, i) => (
                    <div key={i}>幕{v.act} [{v.rule}] {v.detail}</div>
                  ))}
                  {violations.length > 12 && <div>… 另有 {violations.length - 12} 条</div>}
                </div>
              } />
          )}
          {preview && violations.length === 0 && (
            <Alert type="success" showIcon message="硬约束校验全部通过（不交叉 / 无死路 / 全覆盖 / 唯一 BOSS / 开局安全 / 商店营地不相邻 / BOSS 前一层补给）" />
          )}

          <MapPreview act={shownAct} />

          {shownAct && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {(Object.keys(NODE_COLOR) as NodeType[]).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[t] }} />
                  {TYPE_LABEL[t]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- 已保存方案 ---------------- */}
      <Card size="small" title={`已保存方案（${packs.length}）`}
        extra={<span className="text-xs text-zinc-500">选中「默认」的那套会在发布时下发给 C 端</span>}>
        {packs.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有方案，先生成一套并保存" />
        ) : (
          <Table rowKey="id" size="small" columns={packColumns as any} dataSource={packs} pagination={false} />
        )}
      </Card>

      <Alert type="info" showIcon
        message="关于「保存」与「发布」"
        description={<span className="text-xs">
          保存只写入服务端配置；点顶栏<b>「发布到 C 端」</b>才会把当前内容（含选为默认的那套地图）
          快照给 C 端。C 端按幕取对应地图，某幕缺失或数据非法时**只回落那一幕**为本地生成，不会整局崩掉。
        </span>} />
    </div>
  )
}
