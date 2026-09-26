"use client"

// 爬塔工坊 · 技能制作（原「技能制作」Tab，已独立成页）
// 技能模板本身不直接生效，是给「角色制作」页引用（以拷贝形式嵌进角色的主动/被动槽）
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Table, Modal, Form, InputNumber } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankSkill, cleanSkill, kindLabel,
  CARDS, SKILL_KINDS, SKILL_KIND_LABEL, PASSIVE_KINDS, PASSIVE_KIND_LABEL,
  type SkillTpl,
} from "../_shared/model"

export default function SpireSkillsPage() {
  const { skills, setSkills, busy, save, dirty } = useSpire()
  const [q, setQ] = useState("")
  const [fStype, setFStype] = useState("all")
  const [draft, setDraft] = useState<SkillTpl | null>(null)

  const list = useMemo(() => skills.filter((s) =>
    (fStype === "all" || s.stype === fStype) &&
    (!q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()))
  ), [skills, q, fStype])

  const upsert = () => {
    if (!draft) return
    const clean = cleanSkill(draft)
    if (!clean) { toast.warning("技能不合法：需要名称与有效机制类型"); return }
    setSkills((l) => {
      const i = l.findIndex((s) => s.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const columns = [
    { title: "技能", dataIndex: "name", render: (_: any, s: SkillTpl) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.icon} {s.name}</span> },
    { title: "类型", dataIndex: "stype", width: 90, render: (v: string) => v === "active" ? <Tag color="orange">主动</Tag> : <Tag color="blue">被动</Tag> },
    { title: "机制", dataIndex: "kind", render: (_: any, s: SkillTpl) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{kindLabel(s)}</span> },
    { title: "数值", dataIndex: "value", width: 70 },
    { title: "冷却", dataIndex: "cooldown", width: 90, render: (v: number, s: SkillTpl) => s.stype === "active" ? `${v} 回合` : "—" },
    { title: "描述", dataIndex: "desc", render: (v: string) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{v || "—"}</span> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, s: SkillTpl) => actBtns(
        () => setDraft({ ...s }),
        () => setSkills((l) => l.filter((x) => x.id !== s.id)),
        s.name,
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="⚡ 技能制作"
        hint={`共 ${skills.length} 个技能模板；角色制作页可从这里「套用」到角色的主动/被动槽（套用是拷贝，之后改模板不会回改已套用的角色）`}
        onSave={save}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Input.Search placeholder="搜索技能名称…" allowClear className="!w-60"
          value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
        <Select className="w-32" value={fStype} onChange={setFStype}
          options={[{ value: "all", label: "全部类型" }, { value: "active", label: "主动技能" }, { value: "passive", label: "被动技能" }]} />
        <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankSkill("active"))}>新建技能</Button>
      </div>
      <Table rowKey="id" size="middle" columns={columns as any} dataSource={list} pagination={false}
        locale={{ emptyText: emptyHint("暂无技能模板，点右上角「新建技能」开始制作（角色制作时可从技能库引用）") }} />

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`⚡ ${skills.some((s) => s.id === draft.id) ? "编辑" : "新建"}技能`}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="技能类型" required extra="不同类型使用不同的机制选项">
              <Select value={draft.stype} onChange={(v) => {
                const stype = v as "active" | "passive"
                setDraft({
                  ...draft, stype,
                  kind: stype === "active" ? "draw-cards" : "atk-bonus",
                  icon: stype === "active" ? "🌟" : "✨",
                  cooldown: stype === "active" ? draft.cooldown : 0,
                })
              }} options={[{ value: "active", label: "🌟 主动技能" }, { value: "passive", label: "✨ 被动技能" }]} />
            </Form.Item>
            <Form.Item label="机制" required extra={draft.stype === "active" ? "角色主动释放，有冷却回合" : "角色常驻生效"}>
              {draft.stype === "active" ? (
                <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })}
                  options={SKILL_KINDS.map((k) => ({ value: k, label: SKILL_KIND_LABEL[k] }))} />
              ) : (
                <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })}
                  options={PASSIVE_KINDS.map((k) => ({ value: k, label: PASSIVE_KIND_LABEL[k] }))} />
              )}
            </Form.Item>
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="图标 emoji"><Input value={draft.icon} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="数值 N"><InputNumber min={0} max={99} className="!w-full" value={draft.value} onChange={(v) => setDraft({ ...draft, value: v ?? 0 })} /></Form.Item>
              {draft.stype === "active"
                ? <Form.Item label="冷却（回合）"><InputNumber min={0} max={9} className="!w-full" value={draft.cooldown} onChange={(v) => setDraft({ ...draft, cooldown: v ?? 0 })} /></Form.Item>
                : <div />}
            </div>
            {draft.stype === "active" && draft.kind === "generate-card" && (
              <Form.Item label="生成的卡片">
                <Select value={draft.cardId || ""} placeholder="选择要生成的卡…" onChange={(v) => setDraft({ ...draft, cardId: v })}
                  options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
              </Form.Item>
            )}
            <Form.Item label="描述" extra="展示给玩家的技能说明">
              <Input value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
