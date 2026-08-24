"use client"

// 爬塔尖塔内容工坊（antd 版）：Tabs（卡片/角色/技能制作）+ Table + 类型化 Modal 表单
// 保存后自定义内容即时生效于 /spire 游戏
import { useEffect, useMemo, useState } from "react"
import {
  CARDS, applyCustomContent, sanitizeCard, sanitizeCharacter, cardDesc,
  CATEGORIES, EFFECT_TYPES, EFFECT_TYPE_LABEL, PASSIVE_KINDS, PASSIVE_KIND_LABEL,
  SKILL_KINDS, SKILL_KIND_LABEL,
  type CardDef, type CardEffect, type CharacterDef, type CardCategory, type EffectType, type PassiveKind, type SkillKind,
} from "@/lib/spire-engine"
import { SpireCardView, CATEGORY_LABEL, RARITY_NAME } from "@/components/SpireCardView"
import { loadSpireContent, saveSpireContent } from "@/lib/spire-content"
import { apiJson, postJson } from "@/lib/api"
import { Tabs, Table, Modal, Form, Input, InputNumber, Select, Button, Tag, Checkbox, Popconfirm, Space } from "antd"
import { toast } from "@/lib/toast"
import { Plus, Save } from "lucide-react"

/** 技能模板：主动（SkillKind）或被动（PassiveKind），可在角色制作时引用（以拷贝形式嵌入角色） */
interface SkillTpl {
  id: string
  stype: "active" | "passive"
  kind: string
  name: string
  icon: string
  desc: string
  value: number
  cooldown: number
  cardId?: string
}

const uid36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

const blankCard = (): CardDef => ({
  id: `custom_c_${uid36()}`, name: "", icon: "🎴", cost: 1, category: "attack", rarity: 0,
  effects: [{ type: "damage", amount: 6, target: "enemy", scope: { kind: "single" } }],
})

const blankChar = (): CharacterDef => ({
  id: `custom_h_${uid36()}`, name: "", icon: "🧙", maxHp: 80, desc: "",
  startDeck: ["strike", "strike", "strike", "strike", "defend", "defend", "defend", "defend", "bash", "bash"],
  passives: [{ kind: "atk-bonus", name: "自定义被动", icon: "✨", desc: "", value: 1 }],
  skill: { kind: "draw-cards", name: "自定义技能", icon: "🌟", desc: "", cooldown: 3, value: 2 },
})

const blankSkill = (stype: "active" | "passive"): SkillTpl => ({
  id: `custom_s_${uid36()}`, stype,
  kind: stype === "active" ? "draw-cards" : "atk-bonus",
  name: "", icon: stype === "active" ? "🌟" : "✨", desc: "",
  value: stype === "active" ? 2 : 1, cooldown: 3,
})

/** 轻量校验技能模板（结构非法的丢弃） */
function cleanSkill(raw: any): SkillTpl | null {
  if (!raw || typeof raw !== "object") return null
  const stype = raw.stype === "passive" ? "passive" : raw.stype === "active" ? "active" : null
  if (!stype) return null
  const ok = stype === "active" ? SKILL_KINDS.includes(raw.kind) : PASSIVE_KINDS.includes(raw.kind)
  if (!ok || typeof raw.name !== "string" || !raw.name.trim()) return null
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `custom_s_${uid36()}`,
    stype, kind: raw.kind, name: raw.name.trim(),
    icon: typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : (stype === "active" ? "🌟" : "✨"),
    desc: typeof raw.desc === "string" ? raw.desc : "",
    value: Math.max(0, Math.min(99, Math.floor(Number(raw.value)) || 0)),
    cooldown: Math.max(0, Math.min(9, Math.floor(Number(raw.cooldown)) || 0)),
    cardId: typeof raw.cardId === "string" ? raw.cardId : undefined,
  }
}

const kindLabel = (t: SkillTpl) => (t.stype === "active" ? SKILL_KIND_LABEL : PASSIVE_KIND_LABEL)[t.kind as SkillKind & PassiveKind] || t.kind
const catColor: Record<CardCategory, string> = { attack: "volcano", defense: "geekblue", buff: "gold", special: "magenta" }

export default function SpireEditorPage() {
  const [tab, setTab] = useState("cards")
  const [cards, setCards] = useState<CardDef[]>([])
  const [chars, setChars] = useState<CharacterDef[]>([])
  const [skills, setSkills] = useState<SkillTpl[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  // B/C 拆分阶段2：发布状态（ui_config 顶层是否存在 spire_published 快照）
  const [published, setPublished] = useState<boolean | null>(null)
  const [pubBusy, setPubBusy] = useState(false)

  // 搜索与筛选
  const [qCard, setQCard] = useState(""); const [fCat, setFCat] = useState("all")
  const [qChar, setQChar] = useState("")
  const [qSkill, setQSkill] = useState(""); const [fStype, setFStype] = useState("all")

  // 弹窗草稿
  const [cardDraft, setCardDraft] = useState<CardDef | null>(null)
  const [charDraft, setCharDraft] = useState<CharacterDef | null>(null)
  const [skillDraft, setSkillDraft] = useState<SkillTpl | null>(null)

  useEffect(() => {
    apiJson("/api/ui-config").then((j) => setPublished(!!j.config?.spire_published)).catch(() => {})
    loadSpireContent().then((c) => {
      const sc = c.cards.map(sanitizeCard).filter(Boolean) as CardDef[]
      const sh = c.characters.map((r) => sanitizeCharacter(r, CARDS)).filter(Boolean) as CharacterDef[]
      const sk = c.skills.map(cleanSkill).filter(Boolean) as SkillTpl[]
      setCards(sc); setChars(sh); setSkills(sk)
      applyCustomContent(sc, sh)
      setLoaded(true)
    })
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      await saveSpireContent({ cards, characters: chars, skills })
      applyCustomContent(cards, chars)
      toast.success("已保存并应用到游戏")
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || e}`)
    }
    setBusy(false)
  }

  /** 发布：把当前工坊内容整体快照到 C 端（POST /api/spire-content/publish） */
  const publish = async () => {
    setPubBusy(true)
    try {
      await postJson("/api/spire-content/publish", {})
      setPublished(true)
      toast.success("已发布到 C 端（爬塔自定义内容即时生效）")
    } catch (e: any) {
      toast.error(`发布失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }

  /** 下架：移除 C 端已发布快照（POST /api/spire-content/unpublish），C 端回落内置内容 */
  const unpublish = async () => {
    setPubBusy(true)
    try {
      await postJson("/api/spire-content/unpublish", {})
      setPublished(false)
      toast.success("已下架，C 端回落为内置内容")
    } catch (e: any) {
      toast.error(`下架失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }

  // ---------------- 筛选 ----------------
  const fCards = useMemo(() => cards.filter((c) =>
    (fCat === "all" || c.category === fCat) && (!qCard.trim() || c.name.toLowerCase().includes(qCard.trim().toLowerCase()) || c.id.includes(qCard.trim()))
  ), [cards, qCard, fCat])
  const fChars = useMemo(() => chars.filter((c) => !qChar.trim() || c.name.toLowerCase().includes(qChar.trim().toLowerCase())), [chars, qChar])
  const fSkills = useMemo(() => skills.filter((s) =>
    (fStype === "all" || s.stype === fStype) && (!qSkill.trim() || s.name.toLowerCase().includes(qSkill.trim().toLowerCase()))
  ), [skills, qSkill, fStype])

  // ---------------- 草稿操作 ----------------
  const upsertCard = () => {
    if (!cardDraft) return
    const clean = sanitizeCard(cardDraft)
    if (!clean) { toast.warning("卡片不合法：需要名称与至少一条有效效果"); return }
    setCards((list) => {
      const i = list.findIndex((c) => c.id === clean.id)
      if (i >= 0) { const n = [...list]; n[i] = clean; return n }
      return [...list, clean]
    })
    setCardDraft(null)
  }
  const setEff = (i: number, patch: Partial<CardEffect>) => {
    if (!cardDraft) return
    setCardDraft({ ...cardDraft, effects: cardDraft.effects.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  const upsertChar = () => {
    if (!charDraft) return
    const clean = sanitizeCharacter(charDraft, CARDS)
    if (!clean) { toast.warning("角色不合法：需要名称"); return }
    setChars((list) => {
      const i = list.findIndex((c) => c.id === clean.id)
      if (i >= 0) { const n = [...list]; n[i] = clean; return n }
      return [...list, clean]
    })
    setCharDraft(null)
  }

  const upsertSkill = () => {
    if (!skillDraft) return
    const clean = cleanSkill(skillDraft)
    if (!clean) { toast.warning("技能不合法：需要名称与有效机制类型"); return }
    setSkills((list) => {
      const i = list.findIndex((s) => s.id === clean.id)
      if (i >= 0) { const n = [...list]; n[i] = clean; return n }
      return [...list, clean]
    })
    setSkillDraft(null)
  }

  if (!loaded) return <div className="text-zinc-500">加载中...</div>

  const tableCls = "card overflow-hidden [&_.ant-table]:bg-transparent"
  const actBtns = (onEdit: () => void, onDel: () => void, name: string) => (
    <Space size={4}>
      <Button size="small" type="text" onClick={onEdit}>编辑</Button>
      <Popconfirm title="删除" description={`删除「${name}」？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={onDel}>
        <Button size="small" type="text" danger>删除</Button>
      </Popconfirm>
    </Space>
  )

  // ---------------- 卡片表 ----------------
  const cardColumns = [
    { title: "卡片", dataIndex: "name", render: (_: any, c: CardDef) => <span className="font-medium text-zinc-800">{c.icon} {c.name}</span> },
    { title: "类型", dataIndex: "category", width: 90, render: (v: CardCategory) => <Tag color={catColor[v]}>{CATEGORY_LABEL[v]}</Tag> },
    { title: "费用", dataIndex: "cost", width: 70 },
    { title: "稀有度", dataIndex: "rarity", width: 90, render: (v: number) => <Tag>{RARITY_NAME[v]}</Tag> },
    { title: "效果描述", dataIndex: "id", render: (_: any, c: CardDef) => <span className="text-xs text-zinc-500">{cardDesc(c)}</span> },
    { title: "抽取池", dataIndex: "spawnOnly", width: 100, render: (v: boolean) => v ? <Tag>仅生成</Tag> : <Tag color="green">可抽取</Tag> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CardDef) => actBtns(() => setCardDraft(JSON.parse(JSON.stringify(c))), () => setCards((l) => l.filter((x) => x.id !== c.id)), c.name),
    },
  ]

  // ---------------- 角色表 ----------------
  const charColumns = [
    { title: "角色", dataIndex: "name", render: (_: any, c: CharacterDef) => <span className="font-medium text-zinc-800">{c.icon} {c.name}</span> },
    { title: "生命上限", dataIndex: "maxHp", width: 100, render: (v: number) => <>❤️ {v}</> },
    { title: "被动技能", dataIndex: "passives", render: (ps: CharacterDef["passives"]) => <span className="text-xs text-zinc-500">{ps.map((p) => `${p.icon}${p.name}`).join("、") || "—"}</span> },
    { title: "主动技能", dataIndex: "skill", render: (s: CharacterDef["skill"]) => <span className="text-xs text-zinc-500">{s.icon} {s.name}</span> },
    { title: "初始卡组", dataIndex: "startDeck", width: 100, render: (d: string[]) => `${d.length} 张` },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CharacterDef) => actBtns(() => setCharDraft(JSON.parse(JSON.stringify(c))), () => setChars((l) => l.filter((x) => x.id !== c.id)), c.name),
    },
  ]

  // ---------------- 技能表 ----------------
  const skillColumns = [
    { title: "技能", dataIndex: "name", render: (_: any, s: SkillTpl) => <span className="font-medium text-zinc-800">{s.icon} {s.name}</span> },
    { title: "类型", dataIndex: "stype", width: 90, render: (v: string) => v === "active" ? <Tag color="orange">主动</Tag> : <Tag color="blue">被动</Tag> },
    { title: "机制", dataIndex: "kind", render: (_: any, s: SkillTpl) => <span className="text-xs text-zinc-500">{kindLabel(s)}</span> },
    { title: "数值", dataIndex: "value", width: 70 },
    { title: "冷却", dataIndex: "cooldown", width: 90, render: (v: number, s: SkillTpl) => s.stype === "active" ? `${v} 回合` : "—" },
    { title: "描述", dataIndex: "desc", render: (v: string) => <span className="text-xs text-zinc-500">{v || "—"}</span> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, s: SkillTpl) => actBtns(() => setSkillDraft({ ...s }), () => setSkills((l) => l.filter((x) => x.id !== s.id)), s.name),
    },
  ]

  const emptyCard = <div className="py-6 text-center text-sm text-zinc-400">暂无自定义卡片，点右上角「新建卡片」开始制作</div>
  const emptyChar = <div className="py-6 text-center text-sm text-zinc-400">暂无自定义角色，点右上角「新建角色」开始制作</div>
  const emptySkill = <div className="py-6 text-center text-sm text-zinc-400">暂无技能模板，点右上角「新建技能」开始制作（角色制作时可从技能库引用）</div>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">爬塔尖塔 · 内容工坊</h1>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">自定义内容保存后在「爬塔尖塔」游戏中生效</span>
        <div className="ml-auto flex items-center gap-2">
          {published === true && <Tag color="success">已发布到 C 端</Tag>}
          {published === false && <Tag>未发布</Tag>}
          <Button type="primary" icon={<Save size={14} />} onClick={save} loading={busy}>保存并应用</Button>
          <Button type="primary" ghost loading={pubBusy} onClick={publish}>发布到 C 端</Button>
          {published === true && (
            <Popconfirm title="取消发布" description="下架后 C 端爬塔回落为内置内容，确定下架？"
              okText="下架" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={unpublish}>
              <Button danger loading={pubBusy}>取消发布</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <Tabs activeKey={tab} onChange={setTab} items={[
        {
          key: "cards", label: `🎴 卡片制作（${cards.length}）`,
          children: (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input.Search placeholder="搜索卡片名称 / ID…" allowClear className="!w-60" value={qCard} onChange={(e) => setQCard(e.target.value)} onSearch={setQCard} />
                <Select className="w-32" value={fCat} onChange={setFCat}
                  options={[{ value: "all", label: "全部类型" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} />
                <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setCardDraft(blankCard())}>新建卡片</Button>
              </div>
              <Table rowKey="id" size="middle" columns={cardColumns as any} dataSource={fCards} pagination={false}
                locale={{ emptyText: emptyCard }} className={tableCls} />
            </div>
          ),
        },
        {
          key: "chars", label: `🧙 角色制作（${chars.length}）`,
          children: (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input.Search placeholder="搜索角色名称…" allowClear className="!w-60" value={qChar} onChange={(e) => setQChar(e.target.value)} onSearch={setQChar} />
                <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setCharDraft(blankChar())}>新建角色</Button>
              </div>
              <Table rowKey="id" size="middle" columns={charColumns as any} dataSource={fChars} pagination={false}
                locale={{ emptyText: emptyChar }} className={tableCls} />
            </div>
          ),
        },
        {
          key: "skills", label: `⚡ 技能制作（${skills.length}）`,
          children: (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input.Search placeholder="搜索技能名称…" allowClear className="!w-60" value={qSkill} onChange={(e) => setQSkill(e.target.value)} onSearch={setQSkill} />
                <Select className="w-32" value={fStype} onChange={setFStype}
                  options={[{ value: "all", label: "全部类型" }, { value: "active", label: "主动技能" }, { value: "passive", label: "被动技能" }]} />
                <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setSkillDraft(blankSkill("active"))}>新建技能</Button>
              </div>
              <Table rowKey="id" size="middle" columns={skillColumns as any} dataSource={fSkills} pagination={false}
                locale={{ emptyText: emptySkill }} className={tableCls} />
            </div>
          ),
        },
      ]} />

      {/* ================= 卡片表单弹窗 ================= */}
      {cardDraft && (
        <Modal open onCancel={() => setCardDraft(null)} title={`🎴 ${cards.some((c) => c.id === cardDraft.id) ? "编辑" : "新建"}卡片`} width={680}
          okText="保存卡片" cancelText="取消" onOk={upsertCard} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={cardDraft.name} onChange={(e) => setCardDraft({ ...cardDraft, name: e.target.value })} /></Form.Item>
              <Form.Item label="插画 emoji"><Input value={cardDraft.icon || ""} maxLength={4} onChange={(e) => setCardDraft({ ...cardDraft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="能量消耗"><InputNumber min={0} max={9} className="!w-full" value={cardDraft.cost} onChange={(v) => setCardDraft({ ...cardDraft, cost: v ?? 0 })} /></Form.Item>
              <Form.Item label="类型">
                <Select value={cardDraft.category} onChange={(v) => setCardDraft({ ...cardDraft, category: v as CardCategory })}
                  options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
              </Form.Item>
              <Form.Item label="稀有度">
                <Select value={cardDraft.rarity} onChange={(v) => setCardDraft({ ...cardDraft, rarity: v as 0 | 1 | 2 })}
                  options={[{ value: 0, label: "普通" }, { value: 1, label: "稀有" }, { value: 2, label: "史诗" }]} />
              </Form.Item>
              <Form.Item label="可被抽取" extra="关闭后仅能通过技能生成，不会在战斗/奖励中出现">
                <Checkbox checked={!cardDraft.spawnOnly} onChange={(e) => setCardDraft({ ...cardDraft, spawnOnly: !e.target.checked })}>进入抽取池</Checkbox>
              </Form.Item>
            </div>

            <Form.Item label={(
              <span className="flex items-center gap-3">效果列表（按序结算）
                <Button size="small" icon={<Plus size={12} />} onClick={() => setCardDraft({ ...cardDraft, effects: [...cardDraft.effects, { type: "damage", amount: 5, target: "enemy", scope: { kind: "single" } }] })}>添加效果</Button>
              </span>
            )}>
              <div className="flex flex-col gap-2">
                {cardDraft.effects.map((e, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_70px_96px_32px] items-center gap-1.5">
                    <Select size="small" value={e.type} onChange={(v) => setEff(i, { type: v as EffectType })}
                      options={EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_TYPE_LABEL[t] }))} />
                    <InputNumber size="small" min={0} max={99} title="数值" value={e.amount} onChange={(v) => setEff(i, { amount: v ?? 0 })} />
                    {e.type === "damage"
                      ? <InputNumber size="small" min={1} max={9} title="段数" value={e.hits ?? 1} onChange={(v) => setEff(i, { hits: v ?? 1 })} />
                      : <span className="text-center text-[10px] text-zinc-400">—</span>}
                    <Select size="small" value={e.target === "self" ? "self" : "enemy"} onChange={(v) => setEff(i, { target: v as "self" | "enemy" })}
                      options={[{ value: "enemy", label: "敌方" }, { value: "self", label: "自身" }]} />
                    <Button size="small" type="text" danger onClick={() => setCardDraft({ ...cardDraft, effects: cardDraft.effects.filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
              </div>
            </Form.Item>

            <div className="flex items-center gap-4">
              <SpireCardView def={sanitizeCard(cardDraft) || cardDraft} small />
              <span className="text-xs text-zinc-400">实时预览：卡面样式与游戏内一致</span>
            </div>
          </Form>
        </Modal>
      )}

      {/* ================= 角色表单弹窗 ================= */}
      {charDraft && (
        <Modal open onCancel={() => setCharDraft(null)} title={`🧙 ${chars.some((c) => c.id === charDraft.id) ? "编辑" : "新建"}角色`} width={680}
          okText="保存角色" cancelText="取消" onOk={upsertChar} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={charDraft.name} onChange={(e) => setCharDraft({ ...charDraft, name: e.target.value })} /></Form.Item>
              <Form.Item label="形象 emoji"><Input value={charDraft.icon} maxLength={4} onChange={(e) => setCharDraft({ ...charDraft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="生命上限（30-200）"><InputNumber min={30} max={200} className="!w-full" value={charDraft.maxHp} onChange={(v) => setCharDraft({ ...charDraft, maxHp: v ?? 80 })} /></Form.Item>
              <Form.Item label="简介"><Input value={charDraft.desc} onChange={(e) => setCharDraft({ ...charDraft, desc: e.target.value })} /></Form.Item>
            </div>

            <Form.Item label={(
              <span className="flex items-center gap-3">被动技能
                {skills.filter((s) => s.stype === "passive").length > 0 && (
                  <Select size="small" className="w-44" value="" placeholder="📚 从技能库添加…" onChange={(id) => {
                    const t = skills.find((s) => s.id === id)
                    if (t) setCharDraft({ ...charDraft, passives: [...charDraft.passives, { kind: t.kind as PassiveKind, name: t.name, icon: t.icon, desc: t.desc, value: t.value }] })
                  }} options={skills.filter((s) => s.stype === "passive").map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }))} />
                )}
                <Button size="small" icon={<Plus size={12} />} onClick={() => setCharDraft({ ...charDraft, passives: [...charDraft.passives, { kind: "atk-bonus", name: "新被动", icon: "✨", desc: "", value: 1 }] })}>添加</Button>
              </span>
            )}>
              <div className="flex flex-col gap-2">
                {charDraft.passives.map((p, i) => (
                  <div key={i} className="rounded-xl border border-black/5 bg-black/[0.02] p-2">
                    <div className="grid grid-cols-[1fr_110px_70px_32px] items-center gap-1.5">
                      <Select size="small" value={p.kind} onChange={(v) => {
                        setCharDraft({ ...charDraft, passives: charDraft.passives.map((x, j) => j === i ? { ...x, kind: v as PassiveKind, name: x.name || PASSIVE_KIND_LABEL[v as PassiveKind].split("（")[0] } : x) })
                      }} options={PASSIVE_KINDS.map((k) => ({ value: k, label: PASSIVE_KIND_LABEL[k] }))} />
                      <Input size="small" value={p.name} title="被动名" onChange={(e) => setCharDraft({ ...charDraft, passives: charDraft.passives.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                      <InputNumber size="small" min={0} max={99} title="数值 N" value={p.value} onChange={(v) => setCharDraft({ ...charDraft, passives: charDraft.passives.map((x, j) => j === i ? { ...x, value: v ?? 0 } : x) })} />
                      <Button size="small" type="text" danger onClick={() => setCharDraft({ ...charDraft, passives: charDraft.passives.filter((_, j) => j !== i) })}>✕</Button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-[64px_1fr] gap-1.5">
                      <Input size="small" value={p.icon} title="图标" maxLength={4} onChange={(e) => setCharDraft({ ...charDraft, passives: charDraft.passives.map((x, j) => j === i ? { ...x, icon: e.target.value } : x) })} />
                      <Input size="small" placeholder="展示给玩家的描述" value={p.desc} onChange={(e) => setCharDraft({ ...charDraft, passives: charDraft.passives.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) })} />
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
                    if (t) setCharDraft({ ...charDraft, skill: { kind: t.kind as SkillKind, name: t.name, icon: t.icon, desc: t.desc, cooldown: t.cooldown, value: t.value, cardId: t.cardId } })
                  }} options={skills.filter((s) => s.stype === "active").map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` }))} />
                )}
              </span>
            )}>
              <div className="rounded-xl border border-black/5 bg-black/[0.02] p-2 grid grid-cols-2 gap-1.5">
                <Select size="small" value={charDraft.skill.kind} onChange={(v) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, kind: v as SkillKind } })}
                  options={SKILL_KINDS.map((k) => ({ value: k, label: SKILL_KIND_LABEL[k] }))} />
                <Input size="small" placeholder="技能名" value={charDraft.skill.name} onChange={(e) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, name: e.target.value } })} />
                <InputNumber size="small" min={0} max={99} title="数值 N" className="!w-full" value={charDraft.skill.value} onChange={(v) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, value: v ?? 0 } })} />
                <InputNumber size="small" min={0} max={9} title="冷却回合" className="!w-full" value={charDraft.skill.cooldown} onChange={(v) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, cooldown: v ?? 0 } })} />
                {charDraft.skill.kind === "generate-card" && (
                  <Select size="small" className="col-span-2" value={charDraft.skill.cardId || ""} placeholder="选择要生成的卡…" onChange={(v) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, cardId: v } })}
                    options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
                )}
                <Input size="small" className="col-span-2" placeholder="展示给玩家的描述" value={charDraft.skill.desc} onChange={(e) => setCharDraft({ ...charDraft, skill: { ...charDraft.skill, desc: e.target.value } })} />
              </div>
            </Form.Item>

            <Form.Item label={`初始卡组（${charDraft.startDeck.length} 张，至少 5 张）`}>
              <div className="flex flex-wrap gap-1">
                {charDraft.startDeck.map((id, i) => {
                  const d = CARDS.find((c) => c.id === id)
                  return (
                    <Tag key={i} closable onClose={() => setCharDraft({ ...charDraft, startDeck: charDraft.startDeck.filter((_, j) => j !== i) })}>
                      {d?.icon || "🎴"} {d?.name || id}
                    </Tag>
                  )
                })}
              </div>
              <Select size="small" className="w-full mt-1.5" value="" placeholder="＋ 添加一张卡到初始卡组…" onChange={(v) => setCharDraft({ ...charDraft, startDeck: [...charDraft.startDeck, v] })}
                options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}（${CATEGORY_LABEL[c.category]}）` }))} />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* ================= 技能表单弹窗 ================= */}
      {skillDraft && (
        <Modal open onCancel={() => setSkillDraft(null)} title={`⚡ ${skills.some((s) => s.id === skillDraft.id) ? "编辑" : "新建"}技能`}
          okText="保存技能" cancelText="取消" onOk={upsertSkill} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="技能类型" required extra="不同类型使用不同的机制选项">
              <Select value={skillDraft.stype} onChange={(v) => {
                const stype = v as "active" | "passive"
                setSkillDraft({ ...skillDraft, stype, kind: stype === "active" ? "draw-cards" : "atk-bonus", icon: stype === "active" ? "🌟" : "✨", cooldown: stype === "active" ? skillDraft.cooldown : 0 })
              }} options={[{ value: "active", label: "🌟 主动技能" }, { value: "passive", label: "✨ 被动技能" }]} />
            </Form.Item>
            <Form.Item label="机制" required extra={skillDraft.stype === "active" ? "角色主动释放，有冷却回合" : "角色常驻生效"}>
              {skillDraft.stype === "active" ? (
                <Select value={skillDraft.kind} onChange={(v) => setSkillDraft({ ...skillDraft, kind: v })}
                  options={SKILL_KINDS.map((k) => ({ value: k, label: SKILL_KIND_LABEL[k] }))} />
              ) : (
                <Select value={skillDraft.kind} onChange={(v) => setSkillDraft({ ...skillDraft, kind: v })}
                  options={PASSIVE_KINDS.map((k) => ({ value: k, label: PASSIVE_KIND_LABEL[k] }))} />
              )}
            </Form.Item>
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={skillDraft.name} onChange={(e) => setSkillDraft({ ...skillDraft, name: e.target.value })} /></Form.Item>
              <Form.Item label="图标 emoji"><Input value={skillDraft.icon} maxLength={4} onChange={(e) => setSkillDraft({ ...skillDraft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="数值 N"><InputNumber min={0} max={99} className="!w-full" value={skillDraft.value} onChange={(v) => setSkillDraft({ ...skillDraft, value: v ?? 0 })} /></Form.Item>
              {skillDraft.stype === "active"
                ? <Form.Item label="冷却（回合）"><InputNumber min={0} max={9} className="!w-full" value={skillDraft.cooldown} onChange={(v) => setSkillDraft({ ...skillDraft, cooldown: v ?? 0 })} /></Form.Item>
                : <div />}
            </div>
            {skillDraft.stype === "active" && skillDraft.kind === "generate-card" && (
              <Form.Item label="生成的卡片">
                <Select value={skillDraft.cardId || ""} placeholder="选择要生成的卡…" onChange={(v) => setSkillDraft({ ...skillDraft, cardId: v })}
                  options={CARDS.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
              </Form.Item>
            )}
            <Form.Item label="描述" extra="展示给玩家的技能说明">
              <Input value={skillDraft.desc} onChange={(e) => setSkillDraft({ ...skillDraft, desc: e.target.value })} />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
