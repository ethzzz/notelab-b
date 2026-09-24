"use client"

// 爬塔尖塔内容工坊（antd 版）：Tabs（卡片/角色/技能制作/角色授权）+ Table + 类型化 Modal 表单
// 保存后自定义内容经「发布到 C 端」生效于 C 端游戏中心（B/C 拆分 P6 后 B 端不再有游玩页）
// 角色授权：给 C 端用户组勾选"该组可选择哪些角色"，写入 spire.charAccess（随发布生效，C 端做前置筛选）
import { useEffect, useMemo, useState } from "react"
import {
  CARDS, applyCustomContent, sanitizeCard, sanitizeCharacter, cardDesc,
  CATEGORIES, EFFECT_TYPES, EFFECT_TYPE_LABEL, PASSIVE_KINDS, PASSIVE_KIND_LABEL,
  SKILL_KINDS, SKILL_KIND_LABEL,
  type CardDef, type CardEffect, type CharacterDef, type CardCategory, type EffectType, type PassiveKind, type SkillKind,
} from "@/lib/spire-engine"
import { SpireCardView, CATEGORY_LABEL, RARITY_NAME } from "@/components/SpireCardView"
import { loadSpireContent, saveSpireContent, type SpireBaseChar } from "@/lib/spire-content"
import { apiJson, postJson } from "@/lib/api"
import { Tabs, Table, Modal, Form, Input, InputNumber, Select, Button, Tag, Checkbox, Popconfirm, Space, Radio, Alert } from "antd"
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

/** 角色授权：C 端用户组（GET /api/c-admin/groups 的 items） */
interface CGroup { code: string; name: string; member_count?: number }

/** VIP 组码：默认全勾；default 组默认排除下面这批"需授权"角色 */
const VIP_GROUP = "vip"
/** 普通用户（default 组）默认不勾的角色 id：武诸葛为 VIP 专属 */
const DEFAULT_LOCKED_IDS = ["wuzhuge"]

/** 全量可选角色池 = 内置基础角色 + 工坊自定义角色（按 id 去重，自定义覆盖同名基础角色） */
function allCharPool(baseChars: SpireBaseChar[], chars: CharacterDef[]): { id: string; name: string; icon: string; custom: boolean }[] {
  const seen = new Set<string>()
  const out: { id: string; name: string; icon: string; custom: boolean }[] = []
  for (const c of chars) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id); out.push({ id: c.id, name: c.name || c.id, icon: c.icon || "🧙", custom: true })
  }
  for (const c of baseChars) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id); out.push({ id: c.id, name: c.name || c.id, icon: c.icon || "🎭", custom: false })
  }
  return out
}

/** 某组首次无配置时的预填白名单（fail-open 友好，便于运维直接发布） */
function presetAccess(groupCode: string, pool: { id: string }[]): string[] {
  if (groupCode === "default") return pool.map((c) => c.id).filter((id) => !DEFAULT_LOCKED_IDS.includes(id))
  return pool.map((c) => c.id) // vip 与其它组：默认全勾
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
  // 角色授权：内置角色常量 / C 端用户组 / 白名单 {组码: [角色 id]} / 当前编辑的组
  const [baseChars, setBaseChars] = useState<SpireBaseChar[]>([])
  const [groups, setGroups] = useState<CGroup[]>([])
  const [charAccess, setCharAccess] = useState<Record<string, string[]>>({})
  const [accGroup, setAccGroup] = useState<string>("default")
  const [accBusy, setAccBusy] = useState(false)

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
    // 角色授权要用的 C 端用户组（B 端登录才可读，失败不阻塞工坊主流程）
    apiJson("/api/c-admin/groups").then((j) => {
      const gs: CGroup[] = (j.items || []).filter((g: any) => g && typeof g.code === "string")
      setGroups(gs)
      if (gs.length && !gs.some((g) => g.code === "default")) setAccGroup(gs[0].code)
    }).catch(() => {})
    loadSpireContent().then((c) => {
      const sc = c.cards.map(sanitizeCard).filter(Boolean) as CardDef[]
      const sh = c.characters.map((r) => sanitizeCharacter(r, CARDS)).filter(Boolean) as CharacterDef[]
      const sk = c.skills.map(cleanSkill).filter(Boolean) as SkillTpl[]
      setCards(sc); setChars(sh); setSkills(sk)
      setBaseChars(c.baseCharacters || [])
      setCharAccess(c.charAccess || {})
      applyCustomContent(sc, sh)
      setLoaded(true)
    })
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      // charAccess 一并回传：POST /api/spire-content 是整包覆盖写，漏带会把角色授权清空
      await saveSpireContent({ cards, characters: chars, skills, charAccess })
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

  /**
   * 保存授权：把 charAccess（全部组）连同 cards/characters/skills 整包 POST，避免覆盖丢失；
   * 与工坊「保存并应用」同一入口，授权同样需要点「发布到 C 端」才在 C 端生效。
   */
  const saveAccess = async () => {
    setAccBusy(true)
    try {
      await saveSpireContent({ cards, characters: chars, skills, charAccess })
      toast.success("角色授权已保存，点「发布到 C 端」后生效")
    } catch (e: any) {
      toast.error(`保存授权失败：${e?.message || e}`)
    }
    setAccBusy(false)
  }

  // ---------------- 筛选 ----------------
  const fCards = useMemo(() => cards.filter((c) =>
    (fCat === "all" || c.category === fCat) && (!qCard.trim() || c.name.toLowerCase().includes(qCard.trim().toLowerCase()) || c.id.includes(qCard.trim()))
  ), [cards, qCard, fCat])
  const fChars = useMemo(() => chars.filter((c) => !qChar.trim() || c.name.toLowerCase().includes(qChar.trim().toLowerCase())), [chars, qChar])
  const fSkills = useMemo(() => skills.filter((s) =>
    (fStype === "all" || s.stype === fStype) && (!qSkill.trim() || s.name.toLowerCase().includes(qSkill.trim().toLowerCase()))
  ), [skills, qSkill, fStype])
  /** 角色授权：全量生效角色池（内置基础角色 + 工坊自定义，去重） */
  const charPool = useMemo(() => allCharPool(baseChars, chars), [baseChars, chars])

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

  if (!loaded) return <div className="text-zinc-500 dark:text-zinc-400">加载中...</div>

  const tableCls = ""
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
    { title: "卡片", dataIndex: "name", render: (_: any, c: CardDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.icon} {c.name}</span> },
    { title: "类型", dataIndex: "category", width: 90, render: (v: CardCategory) => <Tag color={catColor[v]}>{CATEGORY_LABEL[v]}</Tag> },
    { title: "费用", dataIndex: "cost", width: 70 },
    { title: "稀有度", dataIndex: "rarity", width: 90, render: (v: number) => <Tag>{RARITY_NAME[v]}</Tag> },
    { title: "效果描述", dataIndex: "id", render: (_: any, c: CardDef) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{cardDesc(c)}</span> },
    { title: "抽取池", dataIndex: "spawnOnly", width: 100, render: (v: boolean) => v ? <Tag>仅生成</Tag> : <Tag color="green">可抽取</Tag> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CardDef) => actBtns(() => setCardDraft(JSON.parse(JSON.stringify(c))), () => setCards((l) => l.filter((x) => x.id !== c.id)), c.name),
    },
  ]

  // ---------------- 角色表 ----------------
  const charColumns = [
    { title: "角色", dataIndex: "name", render: (_: any, c: CharacterDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.icon} {c.name}</span> },
    { title: "生命上限", dataIndex: "maxHp", width: 100, render: (v: number) => <>❤️ {v}</> },
    { title: "被动技能", dataIndex: "passives", render: (ps: CharacterDef["passives"]) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{ps.map((p) => `${p.icon}${p.name}`).join("、") || "—"}</span> },
    { title: "主动技能", dataIndex: "skill", render: (s: CharacterDef["skill"]) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.icon} {s.name}</span> },
    { title: "初始卡组", dataIndex: "startDeck", width: 100, render: (d: string[]) => `${d.length} 张` },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, c: CharacterDef) => actBtns(() => setCharDraft(JSON.parse(JSON.stringify(c))), () => setChars((l) => l.filter((x) => x.id !== c.id)), c.name),
    },
  ]

  // ---------------- 技能表 ----------------
  const skillColumns = [
    { title: "技能", dataIndex: "name", render: (_: any, s: SkillTpl) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.icon} {s.name}</span> },
    { title: "类型", dataIndex: "stype", width: 90, render: (v: string) => v === "active" ? <Tag color="orange">主动</Tag> : <Tag color="blue">被动</Tag> },
    { title: "机制", dataIndex: "kind", render: (_: any, s: SkillTpl) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{kindLabel(s)}</span> },
    { title: "数值", dataIndex: "value", width: 70 },
    { title: "冷却", dataIndex: "cooldown", width: 90, render: (v: number, s: SkillTpl) => s.stype === "active" ? `${v} 回合` : "—" },
    { title: "描述", dataIndex: "desc", render: (v: string) => <span className="text-xs text-zinc-500 dark:text-zinc-400">{v || "—"}</span> },
    {
      title: "操作", align: "right" as const, width: 140,
      render: (_: any, s: SkillTpl) => actBtns(() => setSkillDraft({ ...s }), () => setSkills((l) => l.filter((x) => x.id !== s.id)), s.name),
    },
  ]

  const emptyCard = <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">暂无自定义卡片，点右上角「新建卡片」开始制作</div>
  const emptyChar = <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">暂无自定义角色，点右上角「新建角色」开始制作</div>
  const emptySkill = <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">暂无技能模板，点右上角「新建技能」开始制作（角色制作时可从技能库引用）</div>

  // ---------------- 角色授权 ----------------
  /** 某组当前勾选：未配置该组键时按推荐规则预填（首次直接可发布，不落库） */
  const accChecked = (code: string): string[] =>
    Array.isArray(charAccess[code]) ? charAccess[code] : presetAccess(code, charPool)
  /** 写回某组白名单（其它组原样保留） */
  const setGroupAccess = (code: string, ids: string[]) =>
    setCharAccess((prev) => ({ ...prev, [code]: ids.filter((id, i, a) => a.indexOf(id) === i) }))
  const groupName = (code: string) => groups.find((g) => g.code === code)?.name || code

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">爬塔尖塔 · 内容工坊</h1>
        <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 px-2.5 py-1 rounded-full">自定义内容保存后在「爬塔尖塔」游戏中生效</span>
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
        {
          key: "access", label: `👥 角色授权（${groups.length || "…"} 组）`,
          children: (
            <div className="flex flex-col gap-3">
              <Alert type="info" showIcon
                message="给 C 端用户组勾选可选择的角色（爬塔「选择角色」页按玩家所属组做前置筛选，未授权角色锁定）"
                description={<span className="text-xs">白名单外的角色在 C 端锁定；<b>某组未配置（无键）时不筛选、全部可选</b>（fail-open，避免未配置时把玩家全锁死）。调整后需点右上角「保存授权」再「发布到 C 端」才生效。</span>} />
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">用户组</span>
                {groups.length > 0 ? (
                  <Radio.Group value={accGroup} onChange={(e) => setAccGroup(e.target.value)}
                    options={groups.map((g) => ({ value: g.code, label: `${g.name}（${g.code}${g.member_count != null ? ` · ${g.member_count}人` : ""}）` }))}
                    optionType="button" buttonStyle="solid" />
                ) : (
                  <span className="text-xs text-amber-500">用户组列表加载失败或无可用组（需 B 端登录，可在「C 端用户管理」新建组）</span>
                )}
                <Button type="primary" className="ml-auto" loading={accBusy} disabled={!accGroup} onClick={saveAccess}>保存授权</Button>
              </div>
              {accGroup && (
                <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium">「{groupName(accGroup)}」可选择的角色</span>
                    <Tag color="blue">已选 {accChecked(accGroup).length} / {charPool.length}</Tag>
                    {!(accGroup in charAccess) && <Tag color="orange">尚未配置 · C 端当前不筛选</Tag>}
                    <div className="ml-auto flex items-center gap-2">
                      <Button size="small" onClick={() => setGroupAccess(accGroup, charPool.map((c) => c.id))}>全选</Button>
                      <Button size="small" onClick={() => setGroupAccess(accGroup, [])}>全不选</Button>
                      <Button size="small" onClick={() => setGroupAccess(accGroup, presetAccess(accGroup, charPool))}>按推荐预填</Button>
                    </div>
                  </div>
                  <Checkbox.Group className="!w-full" value={accChecked(accGroup)}
                    onChange={(vals) => setGroupAccess(accGroup, vals as string[])}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {charPool.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 dark:border-zinc-700">
                          <Checkbox value={c.id}>{c.icon} {c.name}</Checkbox>
                          <Tag className="!ml-auto !mr-0" color={c.custom ? "purple" : "default"}>{c.custom ? "工坊" : "内置"}</Tag>
                        </div>
                      ))}
                    </div>
                  </Checkbox.Group>
                  {charPool.length === 0 && <div className="py-4 text-center text-sm text-zinc-400">暂无可授权角色（内置角色清单加载失败？）</div>}
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">
                    锁定文案在 C 端展示为「该角色未解锁 · VIP 专属/联系管理员」；组内成员在「C 端用户管理 → 用户」页调整。
                  </div>
                </div>
              )}
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
                      : <span className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">—</span>}
                    <Select size="small" value={e.target === "self" ? "self" : "enemy"} onChange={(v) => setEff(i, { target: v as "self" | "enemy" })}
                      options={[{ value: "enemy", label: "敌方" }, { value: "self", label: "自身" }]} />
                    <Button size="small" type="text" danger onClick={() => setCardDraft({ ...cardDraft, effects: cardDraft.effects.filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
              </div>
            </Form.Item>

            <div className="flex items-center gap-4">
              <SpireCardView def={sanitizeCard(cardDraft) || cardDraft} small />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">实时预览：卡面样式与游戏内一致</span>
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
                  <div key={i} className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2">
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
              <div className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2 grid grid-cols-2 gap-1.5">
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
