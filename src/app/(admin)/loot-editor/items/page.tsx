"use client"

// 摸金行动 · 物品配置（CRUD）
// 内置 24 件由后端懒 seed 下发，出现在列表里即可直接编辑；新建走 it- 前缀 id。
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankItem, sanitizeItem, RARITIES, RARITY_LABEL, RARITY_COLOR,
  type ItemDef, type Rarity,
} from "../_shared/model"

export default function LootItemsPage() {
  const { items, setItems, busy, save, dirty } = useLoot()
  const [q, setQ] = useState("")
  const [rarityFilter, setRarityFilter] = useState<Rarity | "">("")
  const [draft, setDraft] = useState<ItemDef | null>(null)

  const list = useMemo(() => items.filter((it) => {
    if (rarityFilter && it.rarity !== rarityFilter) return false
    const s = q.trim().toLowerCase()
    return !s || it.name.toLowerCase().includes(s) || it.id.toLowerCase().includes(s)
  }), [items, q, rarityFilter])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeItem(draft)
    if (!clean) { toast.warning("物品不合法：需要 id、名称与合法稀有度"); return }
    if (items.some((x) => x.id === clean.id && x !== draft)) { toast.warning(`id「${clean.id}」已存在`); return }
    setItems((l) => {
      const i = l.findIndex((e) => e.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const columns = [
    { title: "物品", dataIndex: "name", render: (_: any, it: ItemDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{it.emoji} {it.name}</span> },
    { title: "稀有度", dataIndex: "rarity", width: 100, render: (r: Rarity) => <Tag color={RARITY_COLOR[r]}>{RARITY_LABEL[r]}</Tag> },
    { title: "面值", dataIndex: "baseValue", width: 100, render: (v: number) => <>💰 {v}</> },
    { title: "回收价", dataIndex: "recycleValue", width: 100, render: (v: number | null, it: ItemDef) => v == null ? <span className="text-zinc-400">按比例</span> : <>{v}</> },
    { title: "堆叠", dataIndex: "stack", width: 70 },
    { title: "标签", dataIndex: "tags", render: (t: string[]) => (t || []).map((x) => <Tag key={x}>{x}</Tag>) },
    { title: "id", dataIndex: "id", width: 130, render: (v: string) => <code className="text-xs text-zinc-400">{v}</code> },
    actionColumn((_: any, it: ItemDef) => actBtns(
      () => setDraft(JSON.parse(JSON.stringify(it))),
      () => setItems((l) => l.filter((x) => x.id !== it.id)),
      it.name,
    ), 140),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="💎 物品配置"
        hint={`共 ${items.length} 件物品；面值决定结算展示，回收价留空 = 按全局 recycleRate 计算`}
        onSave={save} saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input.Search placeholder="搜索名称或 id…" allowClear className="!w-60"
              value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
            <Select className="!w-36" allowClear placeholder="全部稀有度" value={rarityFilter || undefined}
              onChange={(v) => setRarityFilter((v || "") as Rarity | "")}
              options={RARITIES.map((r) => ({ value: r, label: RARITY_LABEL[r] }))} />
            <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankItem())}>新建物品</Button>
          </div>
          <DataTable size="middle" columns={columns as any} dataSource={list} pagination={false}
            locale={{ emptyText: emptyHint("暂无物品，点右上角「新建物品」开始配置") }} />
        </div>
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`💎 ${items.some((e) => e.id === draft.id) ? "编辑" : "新建"}物品`} width={620}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="图标 emoji"><Input value={draft.emoji} maxLength={4} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} /></Form.Item>
              <Form.Item label="稀有度">
                <Select value={draft.rarity} onChange={(r) => setDraft({ ...draft, rarity: r })}
                  options={RARITIES.map((r) => ({ value: r, label: RARITY_LABEL[r] }))} />
              </Form.Item>
              <Form.Item label="面值（1-9999999）"><InputNumber min={1} max={9999999} className="!w-full" value={draft.baseValue} onChange={(v) => setDraft({ ...draft, baseValue: v ?? 50 })} /></Form.Item>
              <Form.Item label="回收价覆盖（留空 = 按比例）">
                <InputNumber min={0} max={9999999} className="!w-full" placeholder="留空即可"
                  value={draft.recycleValue ?? undefined}
                  onChange={(v) => setDraft({ ...draft, recycleValue: v == null ? null : v })} />
              </Form.Item>
              <Form.Item label="堆叠上限（1-99）"><InputNumber min={1} max={99} className="!w-full" value={draft.stack} onChange={(v) => setDraft({ ...draft, stack: v ?? 1 })} /></Form.Item>
            </div>
            <Form.Item label="标签（逗号分隔）">
              <Input value={draft.tags.join(",")} placeholder="如 junk,treasure"
                onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Form.Item>
            <Form.Item label="描述"><Input.TextArea rows={2} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} /></Form.Item>
            <div className="text-xs text-zinc-400">id：<code>{draft.id}</code>（内置物品同 id 覆盖；自定义请保持 <code>it-</code> 前缀）</div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
