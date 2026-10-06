"use client"

// 摸金行动 · 容器配置（CRUD + 网格尺寸 + 稀有度权重 + 保底）
//
// ⚠️ 2026-10-06：容器从「N 个线性槽」改成「cols×rows 网格」，尺寸是**区间** —— 开局按 seed 掷。
//    这就是玩家看到的"物资箱几×几是随机的"。fillRate 决定每格有东西的概率（< 1 才会有摸空的格子）。
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber, Checkbox } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankContainer, sanitizeContainer, DEFAULT_WEIGHTS, labelMap, tagColorMap, containerTier,
  type ContainerDef, type Rarity,
} from "../_shared/model"

/** 网格区间的展示：2-3 × 2-2 → "2~3 × 2~2"，相同时简写成 "3 × 2" */
const gridText = (c: ContainerDef) => {
  const w = c.colsMin === c.colsMax ? `${c.colsMin}` : `${c.colsMin}~${c.colsMax}`
  const h = c.rowsMin === c.rowsMax ? `${c.rowsMin}` : `${c.rowsMin}~${c.rowsMax}`
  return `${w} × ${h}`
}

export default function LootContainersPage() {
  const { rarities, containers, setContainers, tables, items, order, busy, save, dirty } = useLoot()
  const [draft, setDraft] = useState<ContainerDef | null>(null)

  const LABEL = useMemo(() => labelMap({ rarities }), [rarities])
  const TAG = useMemo(() => tagColorMap({ rarities }), [rarities])
  const rarityOptions = useMemo(() => rarities.map((r) => ({ value: r.key, label: r.label })), [rarities])

  const tableOptions = useMemo(() => tables.map((t) => ({ value: t.id, label: `${t.name}（${t.id}）` })), [tables])

  /**
   * 有权重、但掉落表里**没有该档候选**的档位。
   * ⚠️ 这类配置下引擎会「降档找最近的有货档」——权重表看着正常，实际出货不是那个分布。
   */
  const missingTiers = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const out: Record<string, Rarity[]> = {}
    for (const c of containers) {
      const t = tables.find((x) => x.id === c.tableId)
      const miss = order.filter((r) => {
        if ((c.rarityWeights[r] || 0) <= 0) return false
        if (!t || !t.pool.length) return true
        return !t.pool.some((p) => itemById.get(p.itemId)?.rarity === r)
      })
      if (miss.length) out[c.id] = miss
    }
    return out
  }, [containers, tables, items, order])

  /** 保底目标档在池子里没有候选 → 触发时只能退档（引擎兜住不会白等，但要去补候选） */
  const pityUncovered = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const out: Record<string, boolean> = {}
    for (const c of containers) {
      if (!c.pity) continue
      const t = tables.find((x) => x.id === c.tableId)
      const from = order.indexOf(c.pity.minRarity)
      const covered = !!t && t.pool.some((p) => {
        const it = itemById.get(p.itemId)
        return !!it && order.indexOf(it.rarity) >= from
      })
      if (!covered) out[c.id] = true
    }
    return out
  }, [containers, tables, items, order])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeContainer(draft, order)
    if (!clean) { toast.warning("容器不合法：需要 id/名称/掉落表，且稀有度权重各档齐全、总和 > 0"); return }
    setContainers((l) => {
      const i = l.findIndex((e) => e.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const setW = (r: Rarity, v: number) =>
    setDraft((d) => d ? { ...d, rarityWeights: { ...d.rarityWeights, [r]: v } } : d)

  const columns = [
    { title: "容器", dataIndex: "name", render: (_: any, c: ContainerDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.emoji} {c.name}</span> },
    { title: "档位", dataIndex: "id", width: 84, render: (_: any, c: ContainerDef) => {
      const t = containerTier(c, order)
      return <Tag color={TAG[t]} className="!m-0">{LABEL[t] ?? t}</Tag>
    } },
    { title: "网格（随机）", dataIndex: "id", width: 110, render: (_: any, c: ContainerDef) => (
      <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{gridText(c)}</span>
    ) },
    { title: "填充率", dataIndex: "fillRate", width: 80, render: (v: number) => `${Math.round((v ?? 0.75) * 100)}%` },
    { title: "单格耗时", dataIndex: "slotMs", width: 90, render: (v: number) => `${(v / 1000).toFixed(1)}s` },
    { title: "风险成本", dataIndex: "riskCost", width: 80 },
    { title: "保底", dataIndex: "pity", width: 180, render: (p: ContainerDef["pity"], c: ContainerDef) => p
      ? <span className="flex flex-wrap items-center gap-1">
          <Tag color="geekblue">{p.afterRuns} 次未出 → 必出 {LABEL[p.minRarity] ?? p.minRarity}</Tag>
          {pityUncovered[c.id] && <Tag color="red">池内无该档</Tag>}
        </span>
      : <span className="text-zinc-400">无</span> },
    { title: "掉落表", dataIndex: "tableId", width: 200, render: (id: string, c: ContainerDef) => {
      const ok = tables.some((t) => t.id === id)
      const miss = missingTiers[c.id]
      return <span className="flex flex-wrap items-center gap-1">
        <code className="text-xs">{id}</code>
        {!ok && <Tag color="red">表不存在</Tag>}
        {ok && miss && miss.length > 0 && (
          <Tag color="orange">缺 {miss.map((r) => LABEL[r] ?? r).join("/")} 候选</Tag>
        )}
      </span>
    } },
    actionColumn((_: any, c: ContainerDef) => actBtns(
      () => setDraft(JSON.parse(JSON.stringify(c))),
      () => setContainers((l) => l.filter((x) => x.id !== c.id)),
      c.name,
    ), 140),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="📦 容器配置"
        hint={`共 ${containers.length} 种容器；网格尺寸给区间（开局随机掷），权重决定稀有度轮盘`}
        onSave={save} saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-500">掉落表需先在「掉落表」页建好，这里按 id 引用</span>
            <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankContainer(order))}>新建容器</Button>
          </div>
          <DataTable size="middle" columns={columns as any} dataSource={containers} pagination={false}
            locale={{ emptyText: emptyHint("暂无容器，点右上角「新建容器」开始配置") }} />
        </div>
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`📦 ${containers.some((e) => e.id === draft.id) ? "编辑" : "新建"}容器`} width={760}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="外观 emoji"><Input value={draft.emoji} maxLength={4} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} /></Form.Item>
            </div>

            {/* 网格：列/行各给一个区间，开局按 seed 掷一个值 */}
            <Form.Item label="网格尺寸（列 1-8 / 行 1-8；给区间则开局随机掷）">
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">列 最小</span>
                  <InputNumber min={1} max={8} className="!w-full" value={draft.colsMin}
                    onChange={(v) => setDraft({ ...draft, colsMin: v ?? 1, colsMax: Math.max(v ?? 1, draft.colsMax) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">列 最大</span>
                  <InputNumber min={draft.colsMin} max={8} className="!w-full" value={draft.colsMax}
                    onChange={(v) => setDraft({ ...draft, colsMax: Math.max(draft.colsMin, v ?? draft.colsMin) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">行 最小</span>
                  <InputNumber min={1} max={8} className="!w-full" value={draft.rowsMin}
                    onChange={(v) => setDraft({ ...draft, rowsMin: v ?? 1, rowsMax: Math.max(v ?? 1, draft.rowsMax) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">行 最大</span>
                  <InputNumber min={draft.rowsMin} max={8} className="!w-full" value={draft.rowsMax}
                    onChange={(v) => setDraft({ ...draft, rowsMax: Math.max(draft.rowsMin, v ?? draft.rowsMin) })} />
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                当前 {gridText(draft)}（{draft.colsMin === draft.colsMax && draft.rowsMin === draft.rowsMax
                  ? "固定尺寸"
                  : `随机范围，格子数 ${draft.colsMin * draft.rowsMin} ~ ${draft.colsMax * draft.rowsMax}`}）
                {draft.colsMax < 2 && " · ⚠ 列最大 < 2 时，占 2 格以上的物品永远放不进来"}
              </div>
            </Form.Item>

            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="填充率（每格有东西的概率，< 100% 才会摸到空格）">
                <InputNumber min={0} max={1} step={0.05} className="!w-full" value={draft.fillRate}
                  onChange={(v) => setDraft({ ...draft, fillRate: v == null ? 0.75 : Math.min(1, Math.max(0, v)) })} />
              </Form.Item>
              <Form.Item label="单格耗时 ms（100-10000）"><InputNumber min={100} max={10000} step={100} className="!w-full" value={draft.slotMs} onChange={(v) => setDraft({ ...draft, slotMs: v ?? 800 })} /></Form.Item>
              <Form.Item label="风险成本（0-10，首次搜刮一次性加）"><InputNumber min={0} max={10} className="!w-full" value={draft.riskCost} onChange={(v) => setDraft({ ...draft, riskCost: v ?? 1 })} /></Form.Item>
              <Form.Item label="绑定掉落表" required>
                <Select value={draft.tableId || undefined} placeholder="选择掉落表…" options={tableOptions}
                  onChange={(v) => { if (typeof v === "string") setDraft({ ...draft, tableId: v }) }} />
              </Form.Item>
            </div>

            <Form.Item label="稀有度权重（各档齐全，总和须 > 0）">
              <div className="flex flex-wrap gap-2">
                {order.map((r) => (
                  <div key={r} className="flex w-24 flex-col gap-1">
                    <Tag color={TAG[r]} className="!m-0 !text-center">{LABEL[r] ?? r}</Tag>
                    <InputNumber min={0} max={999} className="!w-full" value={draft.rarityWeights[r] ?? 0}
                      onChange={(v) => setW(r, v ?? 0)} />
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                合计 {Object.values(draft.rarityWeights).reduce((s, v) => s + (Number(v) || 0), 0)}；
                <Button size="small" type="link" onClick={() => setDraft({ ...draft, rarityWeights: DEFAULT_WEIGHTS(order) })}>恢复默认</Button>
              </div>
            </Form.Item>

            <Form.Item label="保底">
              <div className="flex items-center gap-3">
                <Checkbox checked={!!draft.pity}
                  onChange={(e) => setDraft({ ...draft, pity: e.target.checked ? { afterRuns: 12, minRarity: order[order.length - 2] ?? order[0] } : null })}>
                  启用保底
                </Checkbox>
                {draft.pity && (
                  <>
                    <InputNumber min={2} max={50} addonBefore="连续" addonAfter="次未出" value={draft.pity.afterRuns}
                      onChange={(v) => setDraft({ ...draft, pity: { ...draft.pity!, afterRuns: v ?? 12 } })} />
                    <span className="text-sm">则必出</span>
                    <Select className="!w-28" value={draft.pity.minRarity}
                      onChange={(v) => { if (v) setDraft({ ...draft, pity: { ...draft.pity!, minRarity: v } }) }}
                      options={rarityOptions} />
                  </>
                )}
              </div>
            </Form.Item>
            <div className="text-xs text-zinc-400">id：<code>{draft.id}</code>（内置容器同 id 覆盖；自定义请保持 <code>ct-</code> 前缀）</div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
