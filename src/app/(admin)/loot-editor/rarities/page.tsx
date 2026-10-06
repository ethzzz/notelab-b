"use client"

// 摸金行动 · 稀有度配置（**档位可增删**）
//
// 这一页是"稀有度"这个维度本身的编辑器：有几档、每档叫什么、染什么色、每格值多少。
// 其它四页（物品/掉落表/容器/地图）里的稀有度下拉、配色、定价提示，全部读这里。
//
// ⚠️ 三条硬约束，改这页时必须知道：
//   ① **数组顺序 = 稀有度由低到高**。比大小（降档、保底、档位染色、背包排序）一律按数组下标，
//      不按 unitValue、也不按 key 字面量 —— 所以「上移/下移」就是改强弱。
//   ② **key 是引用锚点**。物品的 rarity、容器的 rarityWeights / pity.minRarity 都存 key 字符串。
//      所以已有档位的 key **不允许编辑**（改了等于把所有引用打断 → 那些物品会被净化丢弃）；
//      要换 key 就新建一档 + 把物品逐个改过去。
//   ③ **删档会连带丢东西**。sanitizeItem 要求 rarity ∈ order，删掉一档后属于它的物品会在
//      保存时被整条丢弃（静默）。所以删除前先看清"影响 N 件物品"，页面给红色确认。
//   ④ **颜色存色板 key，不存十六进制**。Tailwind v4 只生成源码里字面量出现的类名，
//      `border-${color}-400` 这种拼接在产物 CSS 里不存在 —— 见 model.ts 的 PALETTE。
import { useMemo } from "react"
import { Input, Select, Button, Tag, Card, InputNumber, Alert, Popconfirm } from "antd"
import { Plus, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useLoot } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankRarity, DEFAULT_RARITIES, PALETTE, PALETTE_KEYS, paletteOf, sanitizeRarities,
  type RarityDef,
} from "../_shared/model"

export default function LootRaritiesPage() {
  const { rarities, setRarities, items, containers, busy, save, dirty } = useLoot()

  /** 每个档位被引用了多少（删除前要看清影响面） */
  const usage = useMemo(() => {
    const m: Record<string, { items: number; weights: number; pity: number }> = {}
    for (const r of rarities) m[r.key] = { items: 0, weights: 0, pity: 0 }
    for (const it of items) {
      if (!m[it.rarity]) m[it.rarity] = { items: 0, weights: 0, pity: 0 }
      m[it.rarity].items++
    }
    for (const c of containers) {
      for (const r of rarities) if ((c.rarityWeights[r.key] || 0) > 0) m[r.key].weights++
      if (c.pity?.minRarity && m[c.pity.minRarity]) m[c.pity.minRarity].pity++
    }
    return m
  }, [rarities, items, containers])

  const set = (list: RarityDef[]) => setRarities(list)

  const patch = (key: string, p: Partial<RarityDef>) =>
    set(rarities.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rarities.length) return
    const n = [...rarities]
    const [x] = n.splice(i, 1)
    n.splice(j, 0, x)
    set(n)
  }

  const add = () => {
    const r = blankRarity()
    r.label = `新档位 ${rarities.length + 1}`
    r.key = `r${rarities.length + 1}`
    // 单位价值取上一档的 3 倍（档位间的价格梯度大致就是这个量级）
    const prev = rarities[rarities.length - 1]
    r.unitValue = prev ? Math.round((prev.unitValue || 100) * 3) : 100
    r.color = PALETTE_KEYS[Math.min(PALETTE_KEYS.length - 1, rarities.length)]
    if (rarities.some((x) => x.key === r.key)) { toast.warning(`key「${r.key}」已存在，请先改掉同名档位`); return }
    set([...rarities, r])
  }

  const remove = (key: string) => {
    const u = usage[key]
    set(rarities.filter((r) => r.key !== key))
    toast.warning(`已删除档位「${key}」，${u?.items ?? 0} 件物品将在保存时被丢弃，请去「物品配置」页把它们改到别的档`)
  }

  const resetDefault = () => {
    set(sanitizeRarities(null))
    toast.info("已恢复为内置五档")
  }

  const columns = [
    {
      title: "顺序", dataIndex: "key", width: 110,
      render: (key: string, _: RarityDef, i: number) => (
        <span className="flex items-center gap-1">
          <span className="w-6 text-center text-xs text-zinc-400">{i + 1}</span>
          <Button size="small" type="text" disabled={i === 0} title="上移（变弱）"
            onClick={() => move(i, -1)}><ArrowUp size={12} /></Button>
          <Button size="small" type="text" disabled={i === rarities.length - 1} title="下移（变强）"
            onClick={() => move(i, 1)}><ArrowDown size={12} /></Button>
        </span>
      ),
    },
    {
      title: "档位", dataIndex: "label", width: 200,
      render: (label: string, r: RarityDef) => (
        <span className="flex items-center gap-2">
          <Tag color={paletteOf(r.color).tag}>{label || r.key}</Tag>
          <code className="text-xs text-zinc-400">{r.key}</code>
        </span>
      ),
    },
    {
      title: "颜色", dataIndex: "color", width: 180,
      render: (c: string, r: RarityDef) => (
        <Select size="small" className="!w-44" value={c}
          onChange={(v) => patch(r.key, { color: v || "slate" })}
          options={PALETTE_KEYS.map((k) => ({
            value: k,
            label: (
              <span className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-sm ${PALETTE[k].swatch}`} />
                {PALETTE[k].label}
              </span>
            ),
          }))} />
      ),
    },
    {
      title: "每格基准价", dataIndex: "unitValue", width: 140,
      render: (v: number, r: RarityDef) => (
        <InputNumber size="small" min={0} max={9999999} className="!w-28" value={v}
          onChange={(x) => patch(r.key, { unitValue: x ?? 0 })} />
      ),
    },
    {
      title: "被引用", dataIndex: "key", width: 190,
      render: (key: string) => {
        const u = usage[key] || { items: 0, weights: 0, pity: 0 }
        return (
          <span className="text-xs text-zinc-500">
            {u.items} 件物品 · {u.weights} 个容器权重{u.pity ? ` · ${u.pity} 个保底` : ""}
          </span>
        )
      },
    },
    {
      title: "名称", dataIndex: "label", width: 180,
      render: (label: string, r: RarityDef) => (
        <Input size="small" className="!w-36" value={label} placeholder={r.key}
          onChange={(e) => patch(r.key, { label: e.target.value })} />
      ),
    },
    actionColumn((_: any, r: RarityDef) => (
      <Popconfirm
        title={`删除档位「${r.label || r.key}」？`}
        description={`${usage[r.key]?.items ?? 0} 件物品属于这一档，保存后会被整条丢弃（静默）。建议先去「物品配置」页把它们改到别的档。`}
        okText="仍然删除" cancelText="取消" okButtonProps={{ danger: true }}
        onConfirm={() => remove(r.key)}>
        <Button size="small" type="text" danger>删除</Button>
      </Popconfirm>
    ), 80),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🌈 稀有度配置"
        hint="档位可增删：数组顺序 = 稀有度由低到高；颜色决定前台染色，每格基准价是物品面值的定价锚点"
        onSave={save} saving={busy}
        extra={(
          <>
            {dirty && <span className="text-xs text-amber-500">保存后才会写入服务端</span>}
            <Button icon={<Plus size={14} />} onClick={resetDefault}>恢复内置五档</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={add}>新增档位</Button>
          </>
        )}
      />

      <Alert type="info" showIcon className="!text-xs"
        message="顺序即强弱：越靠下越稀有。降档、保底、容器染色、背包排序全部按这里的下标比大小，不按价格。"
        description="颜色存的是色板 key 而不是色值 —— 动态拼接的 Tailwind 类名（如 border-${color}-400）在生产 CSS 里不存在，会全变成无色。" />

      <Card size="small" className="shadow-sm">
        <DataTable size="middle" columns={columns as any} dataSource={rarities} pagination={false}
          rowKey="key"
          locale={{ emptyText: emptyHint("没有档位了 —— 点右上角「恢复内置五档」或「新增档位」") }} />
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
          <span>内置五档：{DEFAULT_RARITIES.map((r) => `${r.label}(${Math.round(r.unitValue)})`).join(" → ")}</span>
          <span>定价锚点：物品面值 ≈ 该档每格基准价 × 占格数（「物品配置」页会提示偏离）</span>
        </div>
      </Card>
    </div>
  )
}
