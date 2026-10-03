"use client"

// 摸金行动 · 掉落表（按稀有度分组的池子编辑器）
// 每个容器绑定一张表；抽取时先按容器权重抽"档"，再在该档的候选里按 weight 抽 1 件。
// ⚠️ 池子每个"档"至少要有 1 件候选，否则容器抽到该档时轮盘会空手（页面给提示，不阻断保存）。
import { useMemo } from "react"
import { Input, Select, Button, Tag, Card, Form, InputNumber, Popconfirm } from "antd"
import { Plus, Trash2 } from "lucide-react"
import { useLoot } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import {
  blankTable, RARITIES, RARITY_LABEL, RARITY_COLOR,
  type ItemDef, type Rarity, type TableDef,
} from "../_shared/model"

export default function LootTablesPage() {
  const { tables, setTables, items, containers, busy, save, dirty } = useLoot()

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const itemsByRarity = useMemo(() => {
    const m: Record<Rarity, ItemDef[]> = { common: [], uncommon: [], rare: [], epic: [], legendary: [] }
    for (const it of items) m[it.rarity].push(it)
    return m
  }, [items])

  /** 哪些表被容器引用（删除前提示） */
  const usedBy = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const c of containers) (m[c.tableId] ||= []).push(c.name)
    return m
  }, [containers])

  const patch = (tid: string, fn: (t: TableDef) => TableDef) =>
    setTables((l) => l.map((t) => (t.id === tid ? fn(t) : t)))

  const addItem = (tid: string, itemId: string) =>
    patch(tid, (t) => t.pool.some((p) => p.itemId === itemId) ? t : { ...t, pool: [...t.pool, { itemId, weight: 10 }] })

  const setWeight = (tid: string, itemId: string, w: number) =>
    patch(tid, (t) => ({ ...t, pool: t.pool.map((p) => (p.itemId === itemId ? { ...p, weight: w } : p)) }))

  const removeItem = (tid: string, itemId: string) =>
    patch(tid, (t) => ({ ...t, pool: t.pool.filter((p) => p.itemId !== itemId) }))

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🎰 掉落表"
        hint={`共 ${tables.length} 张表；按稀有度分组维护池子，每档至少 1 件候选，否则该档轮盘会空手`}
        onSave={save} saving={busy}
        extra={(<>
          {dirty && <span className="text-xs text-amber-500">保存后才会写入服务端</span>}
          <Button icon={<Plus size={14} />} onClick={() => setTables((l) => [...l, blankTable()])}>新建掉落表</Button>
        </>)}
      />

      {tables.map((t) => (
        <Card key={t.id} size="small" className="shadow-sm"
          title={<span className="text-sm font-medium">{t.name || t.id} <code className="ml-2 text-xs text-zinc-400">{t.id}</code></span>}
          extra={(
            <Popconfirm title="删除掉落表" description={usedBy[t.id]?.length
              ? `该表正被容器「${usedBy[t.id].join("、")}」引用，删除后这些容器将失去线索。确定删除？`
              : `删除「${t.name || t.id}」？`}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
              onConfirm={() => setTables((l) => l.filter((x) => x.id !== t.id))}>
              <Button size="small" type="text" danger icon={<Trash2 size={14} />}>删除</Button>
            </Popconfirm>
          )}>
          <Form layout="vertical">
            <Form.Item label="表名" className="!mb-3">
              <Input className="!max-w-sm" value={t.name} onChange={(e) => patch(t.id, (x) => ({ ...x, name: e.target.value }))} />
            </Form.Item>

            <div className="flex flex-col gap-3">
              {RARITIES.map((r) => {
                const entries = t.pool.filter((p) => byId.get(p.itemId)?.rarity === r)
                return (
                  <div key={r}>
                    <div className="mb-1 flex items-center gap-2">
                      <Tag color={RARITY_COLOR[r]} className="!m-0">{RARITY_LABEL[r]}</Tag>
                      {entries.length === 0
                        ? <span className="text-xs text-rose-500">该档无线索：抽到这一档时会空手</span>
                        : <span className="text-xs text-zinc-400">{entries.length} 件候选</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {entries.map((p) => (
                        <span key={p.itemId} className="inline-flex items-center gap-1 rounded-lg border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-2 py-1">
                          <span className="text-sm">{byId.get(p.itemId)?.emoji} {byId.get(p.itemId)?.name}</span>
                          <InputNumber size="small" min={0} max={999} className="!w-20" value={p.weight} title="权重"
                            onChange={(v) => setWeight(t.id, p.itemId, v ?? 0)} />
                          <Button size="small" type="text" danger onClick={() => removeItem(t.id, p.itemId)}>✕</Button>
                        </span>
                      ))}
                      <Select size="small" className="!w-52" placeholder="+ 添加该档物品…" value={undefined}
                        showSearch optionFilterProp="label"
                        onChange={(id) => addItem(t.id, id)}
                        options={itemsByRarity[r]
                          .filter((it) => !t.pool.some((p) => p.itemId === it.id))
                          .map((it) => ({ value: it.id, label: `${it.emoji} ${it.name}（💰${it.baseValue}）` }))} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Form>
        </Card>
      ))}
    </div>
  )
}
