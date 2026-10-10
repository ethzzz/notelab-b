"use client"
// 低代码平台 · 复用小部件（拷贝按钮、分组标题、导出弹窗、方案管理栏）
import { useState } from "react"
import { Button, Input, Modal, Popconfirm, Select } from "antd"
import { CopyOutlined } from "@ant-design/icons"
import { copyText } from "@/lib/clipboard"
import { toast } from "@/lib/toast"
import type { Plan } from "../_lib/core"

export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button size="small" icon={<CopyOutlined />}
      onClick={() => {
        copyText(text).then((done) => {
          if (done) { setOk(true); setTimeout(() => setOk(false), 1500) }
          else toast.warning("复制失败，请手动选择复制")
        })
      }}>
      {ok ? "已复制" : "复制"}
    </Button>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{children}</div>
}

/** 代码/JSON 展示区（深色底，统一观感） */
export function CodeBlock({ text, maxH = "60vh" }: { text: string; maxH?: string }) {
  return (
    <pre className="text-[11px] bg-zinc-900 text-emerald-300 rounded-lg p-3 overflow-auto"
      style={{ maxHeight: maxH }}>{text}</pre>
  )
}

export function ExportModal({ open, onClose, title, text, width = 720 }:
  { open: boolean; onClose: () => void; title: string; text: string; width?: number }) {
  return (
    <Modal open={open} onCancel={onClose} title={title} width={width}
      footer={[<CopyBtn key="copy" text={text} />, <Button key="close" onClick={onClose}>关闭</Button>]}>
      <CodeBlock text={text} />
    </Modal>
  )
}

/**
 * 方案管理栏：切换 / 新建 / 另存为 / 重命名 / 删除。
 *
 * ⚠️ 这里只改内存里的方案列表并置 dirty —— 落库统一由页面顶部的「保存到服务器」按钮完成。
 * 理由：b_notelab 的 ui_config 是整包覆盖写，每个 Tab 各存一次会互相覆盖（同类方案在同一数组里）。
 */
export function PlanBar({ plans, currentId, onChange, onPatch, label }: {
  plans: Plan[]
  currentId: string | null
  onChange: (id: string | null) => void
  onPatch: (next: Plan[]) => void
  label: string
}) {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState("")
  const cur = plans.find((p) => p.id === currentId) || null

  function create() {
    const p: Plan = { id: "p" + Date.now().toString(36), name: `新建${label} ${plans.length + 1}`, updated_at: "" }
    onPatch([...plans, p])
    onChange(p.id)
  }
  function saveAs() {
    if (!cur) return
    const copy: Plan = { ...cur, id: "p" + Date.now().toString(36), name: cur.name + " 副本", updated_at: "" }
    onPatch([...plans, copy])
    onChange(copy.id)
  }
  function remove() {
    if (!cur) return
    const rest = plans.filter((p) => p.id !== cur.id)
    onPatch(rest)
    onChange(rest.length ? rest[0].id : null)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">当前{label}</span>
      <Select size="small" className="!w-56" value={currentId ?? undefined} onChange={(v) => onChange(v ?? null)}
        placeholder={plans.length ? "请选择方案" : "暂无方案"}
        options={plans.map((p) => ({ value: p.id, label: p.name }))} />
      <Button size="small" onClick={create}>＋ 新建</Button>
      <Button size="small" disabled={!cur} onClick={saveAs}>⧉ 另存为</Button>
      <Button size="small" disabled={!cur} onClick={() => { setDraftName(cur?.name || ""); setRenaming(true) }}>✎ 重命名</Button>
      <Popconfirm title={`删除「${cur?.name || ""}」？`} okText="删除" okButtonProps={{ danger: true }} onConfirm={remove} disabled={!cur}>
        <Button size="small" danger disabled={!cur}>🗑 删除</Button>
      </Popconfirm>
      {cur?.updated_at && <span className="text-[11px] text-zinc-400 dark:text-zinc-500">上次保存 {cur.updated_at}</span>}

      <Modal open={renaming} title="重命名方案" onCancel={() => setRenaming(false)}
        onOk={() => {
          const n = draftName.trim()
          if (!n) { toast.warning("名称不能为空"); return }
          onPatch(plans.map((p) => (p.id === currentId ? { ...p, name: n } : p)))
          setRenaming(false)
        }} okText="确定" cancelText="取消">
        <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="方案名称" />
      </Modal>
    </div>
  )
}
