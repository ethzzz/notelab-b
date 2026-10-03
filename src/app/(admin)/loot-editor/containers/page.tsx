"use client"

// 摸金行动 · 容器配置（CRUD + 稀有度权重 + 保底）
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber, Checkbox } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankContainer, sanitizeContainer, DEFAULT_WEIGHTS,
  RARITIES, RARITY_LABEL, RARITY_COLOR,
  type ContainerDef, type Rarity,
} from "../_shared/model"

export default function LootContainersPage() {
  const { containers, setContainers, tables, items, busy, save, dirty } = useLoot()
  const [draft, setDraft] = useState<ContainerDef | null>(null)

  const tableOptions = useMemo(() => tables.map((t) => ({ value: t.id, label: `${t.name}（${t.id}）` })), [tables])

  /**
   * 有权重、但掉落表里**没有该档候选**的档位。
   * ⚠️ 这类配置下引擎会「降档找最近的有货档」——权重表看着正常，实际出货不是那个分布。
   *    （旧实现只判了"整表为空"，等于没查，跑出来的分布偏差反而找不到原因。）
   */
  const missingTiers = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const out: Record<string, Rarity[]> = {}
    for (const c of containers) {
      const t = tables.find((x) => x.id === c.tableId)
      const miss = RARITIES.filter((r) => {
        if ((c.rarityWeights[r] || 0) <= 0) return false
        if (!t || !t.pool.length) return true
        return !t.pool.some((p) => itemById.get(p.itemId)?.rarity === r)
      })
      if (miss.length) out[c.id] = miss
    }
    return out
  }, [containers, tables, items])

  /** 保底目标档在池子里没有候选 → 触发时只能退档（引擎兜住不会白等，但要去补候选） */
  const pityUncovered = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const out: Record<string, boolean> = {}
    for (const c of containers) {
      if (!c.pity) continue
      const t = tables.find((x) => x.id === c.tableId)
      const from = RARITIES.indexOf(c.pity.minRarity)
      const covered = !!t && t.pool.some((p) => {
        const it = itemById.get(p.itemId)
        return !!it && RARITIES.indexOf(it.rarity) >= from
      })
      if (!covered) out[c.id] = true
    }
    return out
  }, [containers, tables, items])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeContainer(draft)
    if (!clean) { toast.warning("容器不合法：需要 id/名称/掉落表，且稀有度权重五档齐全、总和 > 0"); return }
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
    { title: "槽位", dataIndex: "slots", width: 70 },
    { title: "单格耗时", dataIndex: "slotMs", width: 100, render: (v: number) => `${(v / 1000).toFixed(1)}s` },
    { title: "风险成本", dataIndex: "riskCost", width: 90 },
    { title: "保底", dataIndex: "pity", width: 190, render: (p: ContainerDef["pity"], c: ContainerDef) => p
      ? <span className="flex flex-wrap items-center gap-1">
          <Tag color="purple">{p.afterRuns} 次未出 → 必出 {RARITY_LABEL[p.minRarity]}</Tag>
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
          <Tag color="orange">缺 {miss.map((r) => RARITY_LABEL[r]).join("/")} 候选</Tag>
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
        hint={`共 ${containers.length} 种容器；权重决定稀有度轮盘，保底在连续未出目标档后强制出货`}
        onSave={save} saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-500">掉落表需先在「掉落表」页建好，这里按 id 引用</span>
            <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankContainer())}>新建容器</Button>
          </div>
          <DataTable size="middle" columns={columns as any} dataSource={containers} pagination={false}
            locale={{ emptyText: emptyHint("暂无容器，点右上角「新建容器」开始配置") }} />
        </div>
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`📦 ${containers.some((e) => e.id === draft.id) ? "编辑" : "新建"}容器`} width={720}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="外观 emoji"><Input value={draft.emoji} maxLength={4} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} /></Form.Item>
              <Form.Item label="槽位数（1-6）"><InputNumber min={1} max={6} className="!w-full" value={draft.slots} onChange={(v) => setDraft({ ...draft, slots: v ?? 1 })} /></Form.Item>
              <Form.Item label="单格耗时 ms（100-10000）"><InputNumber min={100} max={10000} step={100} className="!w-full" value={draft.slotMs} onChange={(v) => setDraft({ ...draft, slotMs: v ?? 800 })} /></Form.Item>
              <Form.Item label="风险成本（0-10，开容器一次性加）"><InputNumber min={0} max={10} className="!w-full" value={draft.riskCost} onChange={(v) => setDraft({ ...draft, riskCost: v ?? 1 })} /></Form.Item>
              <Form.Item label="绑定掉落表" required>
                <Select value={draft.tableId || undefined} placeholder="选择掉落表…" options={tableOptions}
                  onChange={(v) => { if (typeof v === "string") setDraft({ ...draft, tableId: v }) }} />
              </Form.Item>
            </div>

            <Form.Item label="稀有度权重（五档，总和须 > 0）">
              <div className="grid grid-cols-5 gap-2">
                {RARITIES.map((r) => (
                  <div key={r} className="flex flex-col gap-1">
                    <Tag color={RARITY_COLOR[r]} className="!m-0 !text-center">{RARITY_LABEL[r]}</Tag>
                    <InputNumber min={0} max={999} className="!w-full" value={draft.rarityWeights[r]}
                      onChange={(v) => setW(r, v ?? 0)} />
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                合计 {Object.values(draft.rarityWeights).reduce((s, v) => s + v, 0)}；
                <Button size="small" type="link" onClick={() => setDraft({ ...draft, rarityWeights: DEFAULT_WEIGHTS() })}>恢复默认</Button>
              </div>
            </Form.Item>

            <Form.Item label="保底">
              <div className="flex items-center gap-3">
                <Checkbox checked={!!draft.pity}
                  onChange={(e) => setDraft({ ...draft, pity: e.target.checked ? { afterRuns: 12, minRarity: "epic" } : null })}>
                  启用保底
                </Checkbox>
                {draft.pity && (
                  <>
                    <InputNumber min={2} max={50} addonBefore="连续" addonAfter="次未出" value={draft.pity.afterRuns}
                      onChange={(v) => setDraft({ ...draft, pity: { ...draft.pity!, afterRuns: v ?? 12 } })} />
                    <span className="text-sm">则必出</span>
                    <Select className="!w-28" value={draft.pity.minRarity}
                      onChange={(v) => { if (v) setDraft({ ...draft, pity: { ...draft.pity!, minRarity: v } }) }}
                      options={RARITIES.map((r) => ({ value: r, label: RARITY_LABEL[r] }))} />
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
