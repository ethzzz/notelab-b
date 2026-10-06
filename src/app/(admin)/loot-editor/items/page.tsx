"use client"

// 摸金行动 · 物品配置（CRUD）
// 内置物品由后端懒 seed 下发，出现在列表里即可直接编辑；新建走 it- 前缀 id。
//
// ⚠️ 2026-10-06：物品多了「形状」和「图片」两个维度 ——
//   形状决定它占背包几格，面值应该 ≈ 该稀有度的每格基准价 × 占格数（见 suggestValue）。
//   价配高了/低了这里会给提示，但不拦保存（数值裁决交给「全局参数」页的 EV 守卫）。
import { useEffect, useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber, Alert } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { apiJson } from "@/lib/api"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankItem, sanitizeItem, suggestValue, shapeSize, SHAPES, labelMap, tagColorMap,
  type ItemDef, type Rarity,
} from "../_shared/model"

/** 图片候选：后端扫 C 端 public/loot 目录下发（B 端浏览器读不到 C 端仓库，只能让后端扫） */
function useLootImages() {
  const [files, setFiles] = useState<string[]>([])
  useEffect(() => {
    apiJson("/api/loot-assets")
      .then((j: any) => setFiles(Array.isArray(j?.files) ? j.files : []))
      .catch(() => setFiles([]))   // 接口没起来就只用 emoji，不报错打扰配置
  }, [])
  return files
}

export default function LootItemsPage() {
  const { rarities, items, setItems, order, busy, save, dirty } = useLoot()
  const [q, setQ] = useState("")
  const [rarityFilter, setRarityFilter] = useState<Rarity | "">("")
  const [draft, setDraft] = useState<ItemDef | null>(null)
  const images = useLootImages()

  const LABEL = useMemo(() => labelMap({ rarities }), [rarities])
  const TAG = useMemo(() => tagColorMap({ rarities }), [rarities])
  const rarityOptions = useMemo(() => rarities.map((r) => ({ value: r.key, label: r.label })), [rarities])

  const list = useMemo(() => items.filter((it) => {
    if (rarityFilter && it.rarity !== rarityFilter) return false
    const s = q.trim().toLowerCase()
    return !s || it.name.toLowerCase().includes(s) || it.id.toLowerCase().includes(s)
  }), [items, q, rarityFilter])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeItem(draft, order)
    if (!clean) { toast.warning("物品不合法：需要 id、名称与合法稀有度"); return }
    if (items.some((x) => x.id === clean.id && x !== draft)) { toast.warning(`id「${clean.id}」已存在`); return }
    setItems((l) => {
      const i = l.findIndex((e) => e.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  /** 定价提示：与该稀有度 × 该形状的"应该值多少"偏离过大时提醒 */
  const priceHint = (it: ItemDef) => {
    const want = suggestValue({ rarities }, it.rarity, it.shape)
    if (!want) return null
    const ratio = it.baseValue / want
    if (ratio >= 0.6 && ratio <= 1.6) return null
    const cells = shapeSize(it.shape)
    return {
      want,
      text: `同档同形状的建议面值 ≈ ${want}（${LABEL[it.rarity] ?? it.rarity} 每格 ${Math.round(want / cells)} × ${cells} 格），当前 ${it.baseValue}`,
      level: ratio > 3 || ratio < 0.34 ? "error" : "warning",
    } as const
  }

  const columns = [
    { title: "物品", dataIndex: "name", render: (_: any, it: ItemDef) => (
      <span className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-100">
        {it.image
          ? <img src={it.image} alt={it.name} className="h-4 w-4 object-contain" />
          : <span>{it.emoji}</span>}
        {it.name}
      </span>
    ) },
    { title: "稀有度", dataIndex: "rarity", width: 90, render: (r: Rarity) => <Tag color={TAG[r]}>{LABEL[r] ?? r}</Tag> },
    { title: "形状", dataIndex: "shape", width: 100, render: (s: string) => {
      const def = SHAPES.find((x) => x.id === s)
      return <span className="text-xs text-zinc-600 dark:text-zinc-300">{def?.label ?? "1×1 单格"}<span className="ml-1 text-zinc-400">（{shapeSize(s)}格）</span></span>
    } },
    { title: "面值", dataIndex: "baseValue", width: 100, render: (v: number, it: ItemDef) => {
      const h = priceHint(it)
      return <span className={h ? "text-amber-600 dark:text-amber-400" : ""}>💰 {v}{h ? " ⚠" : ""}</span>
    } },
    { title: "回收价", dataIndex: "recycleValue", width: 90, render: (v: number | null) => v == null ? <span className="text-zinc-400">按比例</span> : <>{v}</> },
    { title: "堆叠", dataIndex: "stack", width: 60 },
    { title: "标签", dataIndex: "tags", render: (t: string[]) => (t || []).map((x) => <Tag key={x}>{x}</Tag>) },
    { title: "id", dataIndex: "id", width: 120, render: (v: string) => <code className="text-xs text-zinc-400">{v}</code> },
    actionColumn((_: any, it: ItemDef) => actBtns(
      () => setDraft(JSON.parse(JSON.stringify(it))),
      () => setItems((l) => l.filter((x) => x.id !== it.id)),
      it.name,
    ), 140),
  ]

  const hint = draft ? priceHint(draft) : null

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="💎 物品配置"
        hint={`共 ${items.length} 件物品；形状决定占背包几格，面值建议 = 稀有度每格基准价 × 占格数`}
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
              options={rarityOptions} />
            <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankItem())}>新建物品</Button>
          </div>
          <DataTable size="middle" columns={columns as any} dataSource={list} pagination={false}
            locale={{ emptyText: emptyHint("暂无物品，点右上角「新建物品」开始配置") }} />
        </div>
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`💎 ${items.some((e) => e.id === draft.id) ? "编辑" : "新建"}物品`} width={680}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            {hint && (
              <Alert className="mb-3" type={hint.level === "error" ? "error" : "warning"} showIcon
                message={`面值偏离建议值（${hint.text}）`} />
            )}
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="稀有度">
                <Select value={draft.rarity} onChange={(r) => { if (r) setDraft({ ...draft, rarity: r }) }}
                  options={rarityOptions} />
              </Form.Item>
              <Form.Item label="形状（占背包几格）">
                <Select value={draft.shape} onChange={(v) => setDraft({ ...draft, shape: v || "1x1" })}
                  options={SHAPES.map((s) => ({ value: s.id, label: `${s.label} · ${s.cells.length} 格` }))} />
              </Form.Item>
              <Form.Item label="面值（1-9999999）"><InputNumber min={1} max={9999999} className="!w-full" value={draft.baseValue} onChange={(v) => setDraft({ ...draft, baseValue: v ?? 50 })} /></Form.Item>
              <Form.Item label="图标 emoji（没图片时显示）"><Input value={draft.emoji} maxLength={4} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} /></Form.Item>
              <Form.Item label="图片（留空则用 emoji）">
                <Select allowClear showSearch placeholder={images.length ? "选择图片…" : "暂无图片（把图放到 C 端 public/loot/）"}
                  value={draft.image || undefined} options={images.map((f) => ({ value: f, label: f }))}
                  onChange={(v) => setDraft({ ...draft, image: typeof v === "string" ? v : "" })} />
              </Form.Item>
              <Form.Item label="回收价覆盖（留空 = 按比例）">
                <InputNumber min={0} max={9999999} className="!w-full" placeholder="留空即可"
                  value={draft.recycleValue ?? undefined}
                  onChange={(v) => setDraft({ ...draft, recycleValue: v == null ? null : v })} />
              </Form.Item>
              <Form.Item label="堆叠上限（1-99）"><InputNumber min={1} max={99} className="!w-full" value={draft.stack} onChange={(v) => setDraft({ ...draft, stack: v ?? 1 })} /></Form.Item>
            </div>
            {draft.image && (
              <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
                <img src={draft.image} alt="" className="h-8 w-8 rounded border border-black/10 object-contain" />
                <code>{draft.image}</code>
              </div>
            )}
            <Form.Item label="标签（逗号分隔）">
              <Input value={draft.tags.join(",")} placeholder="如 junk,treasure"
                onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Form.Item>
            <Form.Item label="描述"><Input.TextArea rows={2} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} /></Form.Item>
            <div className="text-xs text-zinc-400">
              id：<code>{draft.id}</code>（内置物品同 id 覆盖；自定义请保持 <code>it-</code> 前缀）
              {hint ? ` · 建议面值 ≈ ${hint.want}` : ""}
            </div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
