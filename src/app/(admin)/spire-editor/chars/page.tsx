"use client"

// 爬塔工坊 · 角色制作（原「角色制作」Tab，已独立成页）
// 依赖同工坊的「技能制作」：可从技能库把主动/被动模板**拷贝**进当前角色（改模板不回改已套用的角色）
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Table, Modal, Form, InputNumber } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
// CATEGORY_LABEL（卡牌类型中文名）只定义在卡面组件里，各页就地取用（与 cards/page.tsx 一致），
// 不在 _shared/model 再造一份 —— 否则两处标签会各自漂移
import { CATEGORY_LABEL } from "@/components/SpireCardView"
import {
  blankChar, sanitizeCharacter,
  CARDS, PASSIVE_KINDS, PASSIVE_KIND_LABEL, SKILL_KINDS, SKILL_KIND_LABEL,
  type CharacterDef, type PassiveKind, type SkillKind,
} from "../_shared/model"

export default function SpireCharsPage() {
  const { chars, setChars, skills, busy, save, dirty } = useSpire()
  const [q, setQ] = useState("")
  const [draft, setDraft] = useState<CharacterDef | null>(null)

  const list = useMemo(() => chars.filter((c) =>
    !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())
  ), [chars, q])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeCharacter(draft, CARDS)
    if (!clean) { toast.warning("角色不合法：需要名称"); return }
    setChars((l) => {
      const i = l.findIndex((c) => c.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const columns = [
    { title: "角色", dataIndex: "name", render: (_: any, c: CharacterDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.icon} {c.name}</span> },
    { title: "生命上限", dataIndex: "maxHp", width: 100, render: (v: number) => <>❤️ {v}</> },
    { title: "被动技能", dataIndex: "passives", render: (ps: CharacterDef["passives"]) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{ps.map((p) => `${p.icon}${p.name}`).join("、") || "—"}</span> },
    { title: "主动技能", dataIndex: "skill", render: (s: CharacterDef["skill"]) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.icon} {s.name}</span> },
    { title: "初始卡组", dataIndex: "startDeck", width: 100, render: (d: string[]) => `${d.length} 张` },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CharacterDef) => actBtns(
        () => setDraft(JSON.parse(JSON.stringify(c))),
        () => setChars((l) => l.filter((x) => x.id !== c.id)),
        c.name,
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🧙 角色制作"
        hint={`共 ${chars.length} 个自定义角色；新增角色要能被玩家选到，还需在「角色授权」页勾给对应用户组`}
        onSave={save}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Input.Search placeholder="搜索角色名称…" allowClear className="!w-60"
          value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
        <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankChar())}>新建角色</Button>
      </div>
      <Table rowKey="id" size="middle" columns={columns as any} dataSource={list} pagination={false}
        locale={{ emptyText: emptyHint("暂无自定义角色，点右上角「新建角色」开始制作") }} />

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`🧙 ${chars.some((c) => c.id === draft.id) ? "编辑" : "新建"}角色`} width={680}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="形象 emoji"><Input value={draft.icon} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="生命上限（30-200）"><InputNumber min={30} max={200} className="!w-full" value={draft.maxHp} onChange={(v) => setDraft({ ...draft, maxHp: v ?? 80 })} /></Form.Item>
              <Form.Item label="简介"><Input value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} /></Form.Item>
            </div>

            <Form.Item label={(
              <span className="flex items-center gap-3">被动技能
                {skills.filter((s) => s.stype === "passive").length > 0 && (
                  <Select size="small" className="w-44" value="" placeholder="📚 从技能库添加…" onChange={(id) => {
                    const t = skills.find((s) => s.id === id)
                    if (t) setDraft({ ...draft, passives: [...draft.passives, { kind: t.kind as PassiveKind, name: t.name, icon: t.icon, desc: t.desc, value: t.value }] })
                  }} options={skills.filter((s) => s.stype === "passive").map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }))} />
                )}
                <Button size="small" icon={<Plus size={12} />}
                  onClick={() => setDraft({ ...draft, passives: [...draft.passives, { kind: "atk-bonus", name: "新被动", icon: "✨", desc: "", value: 1 }] })}>添加</Button>
              </span>
            )}>
              <div className="flex flex-col gap-2">
                {draft.passives.map((p, i) => (
                  <div key={i} className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2">
                    <div className="grid grid-cols-[1fr_110px_70px_32px] items-center gap-1.5">
                      <Select size="small" value={p.kind} onChange={(v) => {
                        setDraft({ ...draft, passives: draft.passives.map((x, j) => j === i ? { ...x, kind: v as PassiveKind, name: x.name || PASSIVE_KIND_LABEL[v as PassiveKind].split("（")[0] } : x) })
                      }} options={PASSIVE_KINDS.map((k) => ({ value: k, label: PASSIVE_KIND_LABEL[k] }))} />
                      <Input size="small" value={p.name} title="被动名" onChange={(e) => setDraft({ ...draft, passives: draft.passives.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                      <InputNumber size="small" min={0} max={99} title="数值 N" value={p.value} onChange={(v) => setDraft({ ...draft, passives: draft.passives.map((x, j) => j === i ? { ...x, value: v ?? 0 } : x) })} />
                      <Button size="small" type="text" danger onClick={() => setDraft({ ...draft, passives: draft.passives.filter((_, j) => j !== i) })}>✕</Button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-[64px_1fr] gap-1.5">
                      <Input size="small" value={p.icon} title="图标" maxLength={4} onChange={(e) => setDraft({ ...draft, passives: draft.passives.map((x, j) => j === i ? { ...x, icon: e.target.value } : x) })} />
                      <Input size="small" placeholder="展示给玩家的描述" value={p.desc} onChange={(e) => setDraft({ ...draft, passives: draft.passives.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) })} />
                    </div>
                  </div>
                ))}
              </div>
            </Form.Item>

            <Form.Item label={(
              <span className="flex items-center gap-3">主动技能
                {skills.filter((s) => s.stype === "active").length > 0 && (
                  <Select size="small" className="w-44" value="" placeholder="📚 从技能库套用…" onChange={(id) => {
                    const t = skills.find((s) => s.id === id)
                    if (t) setDraft({ ...draft, skill: { kind: t.kind as SkillKind, name: t.name, icon: t.icon, desc: t.desc, cooldown: t.cooldown, value: t.value, cardId: t.cardId } })
                  }} options={skills.filter((s) => s.stype === "active").map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }))} />
                )}
              </span>
            )}>
              <div className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2 grid grid-cols-2 gap-1.5">
                <Select size="small" value={draft.skill.kind} onChange={(v) => setDraft({ ...draft, skill: { ...draft.skill, kind: v as SkillKind } })}
                  options={SKILL_KINDS.map((k) => ({ value: k, label: SKILL_KIND_LABEL[k] }))} />
                <Input size="small" placeholder="技能名" value={draft.skill.name} onChange={(e) => setDraft({ ...draft, skill: { ...draft.skill, name: e.target.value } })} />
                <InputNumber size="small" min={0} max={99} title="数值 N" className="!w-full" value={draft.skill.value} onChange={(v) => setDraft({ ...draft, skill: { ...draft.skill, value: v ?? 0 } })} />
                <InputNumber size="small" min={0} max={9} title="冷却回合" className="!w-full" value={draft.skill.cooldown} onChange={(v) => setDraft({ ...draft, skill: { ...draft.skill, cooldown: v ?? 0 } })} />
                {draft.skill.kind === "generate-card" && (
                  <Select size="small" className="col-span-2" value={draft.skill.cardId || ""} placeholder="选择要生成的卡…"
                    onChange={(v) => setDraft({ ...draft, skill: { ...draft.skill, cardId: v } })}
                    options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
                )}
                <Input size="small" className="col-span-2" placeholder="展示给玩家的描述" value={draft.skill.desc}
                  onChange={(e) => setDraft({ ...draft, skill: { ...draft.skill, desc: e.target.value } })} />
              </div>
            </Form.Item>

            <Form.Item label={`初始卡组（${draft.startDeck.length} 张，至少 5 张）`}>
              <div className="flex flex-wrap gap-1">
                {draft.startDeck.map((id, i) => {
                  const d = CARDS.find((c) => c.id === id)
                  return (
                    <Tag key={i} closable onClose={() => setDraft({ ...draft, startDeck: draft.startDeck.filter((_, j) => j !== i) })}>
                      {d?.icon || "🎴"} {d?.name || id}
                    </Tag>
                  )
                })}
              </div>
              <Select size="small" className="w-full mt-1.5" value="" placeholder="＋ 添加一张卡到初始卡组…"
                onChange={(v) => setDraft({ ...draft, startDeck: [...draft.startDeck, v] })}
                options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}（${CATEGORY_LABEL[c.category]}）` }))} />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
