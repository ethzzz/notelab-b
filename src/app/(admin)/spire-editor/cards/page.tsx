"use client"

// 爬塔工坊 · 卡片制作（原「名片制作」Tab，已独立成页）
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Table, Modal, Form, InputNumber, Checkbox } from "antd"
import { Plus } from "lucide-react"
import { SpireCardView, CATEGORY_LABEL, RARITY_NAME } from "@/components/SpireCardView"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankCard, catColor, sanitizeCard, cardDesc,
  CATEGORIES, EFFECT_TYPES, EFFECT_TYPE_LABEL,
  type CardDef, type CardEffect, type CardCategory, type EffectType,
} from "../_shared/model"

export default function SpireCardsPage() {
  const { cards, setCards, busy, save, dirty } = useSpire()
  const [q, setQ] = useState("")
  const [fCat, setFCat] = useState("all")
  const [draft, setDraft] = useState<CardDef | null>(null)

  const list = useMemo(() => cards.filter((c) =>
    (fCat === "all" || c.category === fCat) &&
    (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.id.includes(q.trim()))
  ), [cards, q, fCat])

  /** 效果列表里改一条 */
  const setEff = (i: number, patch: Partial<CardEffect>) => {
    if (!draft) return
    setDraft({ ...draft, effects: draft.effects.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeCard(draft)
    if (!clean) { toast.warning("卡片不合法：需要名称与至少一条有效效果"); return }
    setCards((l) => {
      const i = l.findIndex((c) => c.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const columns = [
    { title: "卡片", dataIndex: "name", render: (_: any, c: CardDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.icon} {c.name}</span> },
    { title: "类型", dataIndex: "category", width: 90, render: (v: CardCategory) => <Tag color={catColor[v]}>{CATEGORY_LABEL[v]}</Tag> },
    { title: "费用", dataIndex: "cost", width: 70 },
    { title: "稀有度", dataIndex: "rarity", width: 90, render: (v: number) => <Tag>{RARITY_NAME[v]}</Tag> },
    { title: "效果描述", dataIndex: "id", render: (_: any, c: CardDef) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{cardDesc(c)}</span> },
    { title: "抽取池", dataIndex: "spawnOnly", width: 100, render: (v: boolean) => v ? <Tag>仅生成</Tag> : <Tag color="green">可抽取</Tag> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CardDef) => actBtns(
        () => setDraft(JSON.parse(JSON.stringify(c))),
        () => setCards((l) => l.filter((x) => x.id !== c.id)),
        c.name,
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🎴 卡片制作"
        hint={`共 ${cards.length} 张自定义卡；内置卡在下方"基础卡"之外不可编辑（此处只列自定义卡）`}
        onSave={save}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Input.Search placeholder="搜索卡片名称 / ID…" allowClear className="!w-60"
          value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
        <Select className="w-32" value={fCat} onChange={setFCat}
          options={[{ value: "all", label: "全部类型" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} />
        <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankCard())}>新建卡片</Button>
      </div>
      <Table rowKey="id" size="middle" columns={columns as any} dataSource={list} pagination={false}
        locale={{ emptyText: emptyHint("暂无自定义卡片，点右上角「新建卡片」开始制作") }} />

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`🎴 ${cards.some((c) => c.id === draft.id) ? "编辑" : "新建"}卡片`} width={680}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="插画 emoji"><Input value={draft.icon || ""} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="能量消耗"><InputNumber min={0} max={9} className="!w-full" value={draft.cost} onChange={(v) => setDraft({ ...draft, cost: v ?? 0 })} /></Form.Item>
              <Form.Item label="类型">
                <Select value={draft.category} onChange={(v) => setDraft({ ...draft, category: v as CardCategory })}
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
              </Form.Item>
              <Form.Item label="稀有度">
                <Select value={draft.rarity} onChange={(v) => setDraft({ ...draft, rarity: v as 0 | 1 | 2 })}
                  options={[{ value: 0, label: "普通" }, { value: 1, label: "稀有" }, { value: 2, label: "史诗" }]} />
              </Form.Item>
              <Form.Item label="可被抽取" extra="关闭后仅能通过技能生成，不会在战斗/奖励中出现">
                <Checkbox checked={!draft.spawnOnly} onChange={(e) => setDraft({ ...draft, spawnOnly: !e.target.checked })}>进入抽取池</Checkbox>
              </Form.Item>
            </div>

            <Form.Item label={(
              <span className="flex items-center gap-3">效果列表（按序结算）
                <Button size="small" icon={<Plus size={12} />}
                  onClick={() => setDraft({ ...draft, effects: [...draft.effects, { type: "damage", amount: 5, target: "enemy", scope: { kind: "single" } }] })}>添加效果</Button>
              </span>
            )}>
              <div className="flex flex-col gap-2">
                {draft.effects.map((e, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_70px_96px_32px] items-center gap-1.5">
                    <Select size="small" value={e.type} onChange={(v) => setEff(i, { type: v as EffectType })}
                      options={EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_TYPE_LABEL[t] }))} />
                    <InputNumber size="small" min={0} max={99} title="数值" value={e.amount} onChange={(v) => setEff(i, { amount: v ?? 0 })} />
                    {e.type === "damage"
                      ? <InputNumber size="small" min={1} max={9} title="段数" value={e.hits ?? 1} onChange={(v) => setEff(i, { hits: v ?? 1 })} />
                      : <span className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">—</span>}
                    <Select size="small" value={e.target === "self" ? "self" : "enemy"} onChange={(v) => setEff(i, { target: v as "self" | "enemy" })}
                      options={[{ value: "enemy", label: "敌方" }, { value: "self", label: "自身" }]} />
                    <Button size="small" type="text" danger
                      onClick={() => setDraft({ ...draft, effects: draft.effects.filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
              </div>
            </Form.Item>

            <div className="flex items-center gap-4">
              <SpireCardView def={sanitizeCard(draft) || draft} small />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">实时预览：卡面样式与游戏内一致</span>
            </div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
