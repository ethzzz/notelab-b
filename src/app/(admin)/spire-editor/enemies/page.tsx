"use client"

// 爬塔工坊 · 敌人制作（对称「角色制作」页）
// 内置 10 敌人由后端懒 seed 下发，出现在列表里即可直接编辑（同 id 覆盖，删除后回落内置）；
// 新建敌人走 custom_e_ 前缀 id，仅工坊自定义，不影响内置。
import { useMemo, useState } from "react"
import { Input, Select, Button, Tag, Card, Modal, Form, InputNumber } from "antd"
import { Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { DataTable, actionColumn } from "@/components/admin"
import { useSpire } from "../_shared/store"
import { actBtns, emptyHint, PageHead } from "../_shared/ui"
import {
  blankEnemy, sanitizeEnemy, MOVE_KINDS, MOVE_KIND_LABEL, DEBUFF_KINDS, DEBUFF_KIND_LABEL,
  type EnemyDef, type Move, type MoveKind,
} from "../_shared/model"

export default function SpireEnemiesPage() {
  const { enemies, setEnemies, baseEnemies, busy, save, dirty } = useSpire()
  const [q, setQ] = useState("")
  const [draft, setDraft] = useState<EnemyDef | null>(null)

  const builtInIds = useMemo(() => new Set((baseEnemies || []).map((e) => e.id)), [baseEnemies])
  const list = useMemo(() => enemies.filter((e) =>
    !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase())
  ), [enemies, q])

  const upsert = () => {
    if (!draft) return
    const clean = sanitizeEnemy(draft)
    if (!clean) { toast.warning("敌人不合法：需要名称，且至少一条合法招式"); return }
    setEnemies((l) => {
      const i = l.findIndex((e) => e.id === clean.id)
      if (i >= 0) { const n = [...l]; n[i] = clean; return n }
      return [...l, clean]
    })
    setDraft(null)
  }

  const setMove = (i: number, patch: Partial<Move>) =>
    setDraft((d) => d ? { ...d, moves: d.moves.map((m, j) => j === i ? { ...m, ...patch } : m) } : d)

  const columns = [
    { title: "敌人", dataIndex: "name", render: (_: any, e: EnemyDef) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{e.icon} {e.name}</span> },
    { title: "类型", dataIndex: "boss", width: 90, render: (_: any, e: EnemyDef) => e.boss
      ? <Tag color="red">BOSS</Tag>
      : e.elite ? <Tag color="volcano">精英</Tag> : <Tag>普通</Tag> },
    { title: "生命", dataIndex: "hp", width: 80, render: (v: number) => <>❤️ {v}</> },
    { title: "招式数", dataIndex: "moves", width: 80, render: (m: Move[]) => `${m.length} 招` },
    { title: "来源", dataIndex: "id", width: 80, render: (id: string) => builtInIds.has(id)
      ? <Tag color="blue">内置</Tag> : <Tag color="purple">自定义</Tag> },
    actionColumn((_: any, e: EnemyDef) => actBtns(
      () => setDraft(JSON.parse(JSON.stringify(e))),
      () => setEnemies((l) => l.filter((x) => x.id !== e.id)),
      e.name,
    ), 140),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="👾 敌人制作"
        hint={`共 ${enemies.length} 个敌人（含内置 ${builtInIds.size} 个）；编辑内置敌人即覆盖其数值，C 端战斗即时生效`}
        onSave={save}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input.Search placeholder="搜索敌人名称…" allowClear className="!w-60"
              value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
            <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setDraft(blankEnemy())}>新建敌人</Button>
          </div>
          <DataTable size="middle" columns={columns as any} dataSource={list} pagination={false}
            locale={{ emptyText: emptyHint("暂无敌人，点右上角「新建敌人」开始制作") }} />
        </div>
      </Card>

      {draft && (
        <Modal open onCancel={() => setDraft(null)}
          title={`👾 ${enemies.some((e) => e.id === draft.id) ? "编辑" : "新建"}敌人`} width={680}
          okText="确定" cancelText="取消" onOk={upsert} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="名称" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Form.Item>
              <Form.Item label="形象 emoji"><Input value={draft.icon} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} /></Form.Item>
              <Form.Item label="生命值（1-999）"><InputNumber min={1} max={999} className="!w-full" value={draft.hp} onChange={(v) => setDraft({ ...draft, hp: v ?? 30 })} /></Form.Item>
              <Form.Item label="类别">
                <Select value={draft.boss ? "boss" : draft.elite ? "elite" : "normal"} onChange={(t) => setDraft({
                  ...draft, boss: t === "boss", elite: t === "elite",
                })} options={[
                  { value: "normal", label: "普通敌人" },
                  { value: "elite", label: "精英敌人" },
                  { value: "boss", label: "BOSS" },
                ]} />
              </Form.Item>
            </div>
            <Form.Item label={`招式（${draft.moves.length} 条，至少 1 条）`}>
              <div className="flex flex-col gap-2">
                {draft.moves.map((m, i) => (
                  <div key={i} className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-2">
                    <div className="grid grid-cols-[1fr_96px_64px_64px_32px] items-center gap-1.5">
                      <Input size="small" placeholder="招式名" value={m.name} onChange={(e) => setMove(i, { name: e.target.value })} />
                      <Select size="small" value={m.kind} onChange={(v) => setMove(i, { kind: v as MoveKind, debuffKind: v === "debuff" ? m.debuffKind : undefined })}
                        options={MOVE_KINDS.map((k) => ({ value: k, label: MOVE_KIND_LABEL[k] }))} />
                      <InputNumber size="small" min={0} max={99} title="数值" className="!w-full" value={m.amt} onChange={(v) => setMove(i, { amt: v ?? 0 })} />
                      <InputNumber size="small" min={1} max={9} title="段数" className="!w-full" value={m.hits} onChange={(v) => setMove(i, { hits: v ?? 1 })} />
                      <Button size="small" type="text" danger onClick={() => setDraft({ ...draft, moves: draft.moves.filter((_, j) => j !== i) })}>✕</Button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-[64px_1fr_120px] gap-1.5">
                      <Input size="small" value={m.icon} title="图标" maxLength={4} onChange={(e) => setMove(i, { icon: e.target.value })} />
                      <span className="text-xs text-zinc-400 flex items-center">{m.kind === "debuff" ? "减益类型" : "（攻击/格挡/增益无需减益）"}</span>
                      {m.kind === "debuff" && (
                        <Select size="small" value={m.debuffKind || ""} placeholder="选择…"
                          onChange={(v) => setMove(i, { debuffKind: (v || undefined) as Move["debuffKind"] })}
                          options={DEBUFF_KINDS.map((k) => ({ value: k, label: DEBUFF_KIND_LABEL[k] }))} />
                      )}
                    </div>
                  </div>
                ))}
                <Button size="small" icon={<Plus size={12} />} onClick={() => setDraft({ ...draft, moves: [...draft.moves, { name: "新招式", kind: "atk", amt: 6, hits: 1, icon: "🗡️" }] })}>添加招式</Button>
              </div>
            </Form.Item>
            <div className="text-xs text-zinc-400">id：<code>{draft.id}</code>（内置敌人同 id 覆盖，自定义敌人请保持前缀 custom_e_）</div>
          </Form>
        </Modal>
      )}
    </div>
  )
}
