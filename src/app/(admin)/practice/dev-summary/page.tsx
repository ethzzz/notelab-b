"use client"

// 项目实践 · 项目开发总结
//
// 干什么：把「做项目时踩到的技术难点」按项目沉淀下来 —— 现象 / 原因 / 解决方案 / 代码。
// 数据结构：projects[{code,name,desc,entries[]}]，整份文档一次提交（后端 /api/dev-notes 整包覆盖写）。
//
// 为什么做成「项目分组 + 条目卡片」而不是一张大表格：
// 技术难点的正文很长（含代码块），表格塞不下；分组切换 + 卡片展开更接近"翻文档"的手感。
//
// ⚠️ 保存是整包提交：新增/删除条目后页面里提示「有未保存改动」，点保存才会写服务端。
import { useEffect, useMemo, useState } from "react"
import { Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Tag } from "antd"
import { ChevronDown, ChevronRight, Copy, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { AdminPage } from "@/components/admin"
import { toast } from "@/lib/toast"
import {
  SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL, blankEntry, blankProject, loadDevNotes, saveDevNotes, today,
  type DevEntry, type DevProject, type Severity,
} from "@/lib/dev-notes"

/** 代码块：等宽 + 可换行 + 一键复制（clipboard 失败降级 execCommand，与服务端 http 场景兼容） */
function CodeBlock({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("代码已复制")
    } catch {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand("copy"); toast.success("代码已复制") } catch { toast.error("复制失败，请手动选中") }
      document.body.removeChild(ta)
    }
  }
  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100 dark:bg-black/60">
        <code className="whitespace-pre-wrap break-words">{text}</code>
      </pre>
      <Button size="small" type="text" icon={<Copy size={13} />} onClick={copy}
        className="!absolute !right-1 !top-1 !text-zinc-400 opacity-0 group-hover:opacity-100">
        复制
      </Button>
    </div>
  )
}

/** 小节：标题 + 正文（正文为空则整节不渲染，避免出现一排空标题） */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value.trim()) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{label}</span>
      <div className={`text-sm whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  )
}

export default function DevSummaryPage() {
  const [projects, setProjects] = useState<DevProject[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [baseline, setBaseline] = useState("")

  const [activeCode, setActiveCode] = useState("")
  const [q, setQ] = useState("")
  const [sevFilter, setSevFilter] = useState<Severity | "">("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [entryDraft, setEntryDraft] = useState<DevEntry | null>(null)
  const [projectDraft, setProjectDraft] = useState<DevProject | null>(null)
  const [isNewProject, setIsNewProject] = useState(false)

  useEffect(() => {
    let alive = true
    loadDevNotes().then((d) => {
      if (!alive) return
      setProjects(d.projects)
      setBaseline(JSON.stringify(d.projects))
      setActiveCode(d.projects[0]?.code ?? "")
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  const dirty = loaded && JSON.stringify(projects) !== baseline
  const active = useMemo(() => projects.find((p) => p.code === activeCode), [projects, activeCode])

  const list = useMemo(() => {
    const arr = active?.entries ?? []
    const s = q.trim().toLowerCase()
    return arr.filter((e) => {
      if (sevFilter && e.severity !== sevFilter) return false
      if (!s) return true
      const hay = [e.title, e.stage, e.symptom, e.cause, e.solution, e.tags.join(" ")].join(" ").toLowerCase()
      return hay.includes(s)
    })
  }, [active, q, sevFilter])

  // ---------------- 保存（整包） ----------------
  const save = async () => {
    setBusy(true)
    try {
      await saveDevNotes({ projects })
      setBaseline(JSON.stringify(projects))
      toast.success("已保存")
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || e}`)
    }
    setBusy(false)
  }

  /** 改当前项目（不动其它项目） */
  const patchActive = (fn: (p: DevProject) => DevProject) => {
    setProjects((ps) => ps.map((p) => (p.code === activeCode ? fn(p) : p)))
  }

  // ---------------- 条目 ----------------
  const upsertEntry = () => {
    if (!entryDraft || !active) return
    if (!entryDraft.title.trim()) { toast.warning("标题不能为空"); return }
    patchActive((p) => {
      const i = p.entries.findIndex((e) => e.id === entryDraft.id)
      if (i >= 0) { const n = [...p.entries]; n[i] = entryDraft; return { ...p, entries: n } }
      return { ...p, entries: [entryDraft, ...p.entries] }
    })
    setExpanded((m) => ({ ...m, [entryDraft.id]: true }))
    setEntryDraft(null)
  }

  const delEntry = (id: string) => patchActive((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== id) }))

  // ---------------- 项目 ----------------
  const upsertProject = () => {
    if (!projectDraft) return
    const code = projectDraft.code.trim()
    const name = projectDraft.name.trim()
    if (!code || !name) { toast.warning("代号与名称都不能为空"); return }
    if (isNewProject) {
      if (projects.some((p) => p.code === code)) { toast.warning(`项目代号「${code}」已存在`); return }
      setProjects((ps) => [...ps, { ...projectDraft, code, name }])
      setActiveCode(code)
    } else {
      setProjects((ps) => ps.map((p) => (p.code === code ? { ...p, name, desc: projectDraft.desc } : p)))
    }
    setProjectDraft(null)
  }

  const delProject = (code: string) => {
    const next = projects.filter((p) => p.code !== code)
    setProjects(next)
    if (activeCode === code) setActiveCode(next[0]?.code ?? "")
  }

  const totalEntries = projects.reduce((s, p) => s + p.entries.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <AdminPage
        level={1}
        title="📓 项目开发总结"
        description={`把做项目时踩到的技术难点沉淀下来：现象 → 原因 → 解决方案 → 代码。当前 ${projects.length} 个项目 / ${totalEntries} 条记录。`}
        extra={
          <Space>
            {dirty && <Tag color="orange">有未保存改动</Tag>}
            <Button icon={<Plus size={14} />} onClick={() => { setIsNewProject(true); setProjectDraft(blankProject()) }}>
              新建项目
            </Button>
            <Button type="primary" icon={<Save size={14} />} loading={busy} onClick={save}>保存</Button>
          </Space>
        }
      />

      {!loaded ? (
        <Card size="small" className="shadow-sm"><div className="py-10 text-center text-sm text-zinc-500">加载中...</div></Card>
      ) : projects.length === 0 ? (
        <Card size="small" className="shadow-sm">
          <Empty description="还没有项目，点右上角「新建项目」开始记录" />
        </Card>
      ) : (
        <>
          {/* 项目切换 + 项目级操作 */}
          <Card size="small" className="shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">项目</span>
              <Select className="!min-w-[16rem]" value={activeCode || undefined} placeholder="选择项目"
                onChange={(v) => { if (typeof v === "string") setActiveCode(v) }}
                options={projects.map((p) => ({
                  value: p.code,
                  label: `${p.name}（${p.entries.length} 条）`,
                }))} />
              {active && (
                <>
                  <Button size="small" type="text" icon={<Pencil size={13} />}
                    onClick={() => { setIsNewProject(false); setProjectDraft({ ...active }) }}>编辑项目</Button>
                  <Popconfirm title="删除项目" description={`删除「${active.name}」及其 ${active.entries.length} 条记录？`}
                    okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
                    onConfirm={() => delProject(active.code)}>
                    <Button size="small" type="text" danger icon={<Trash2 size={13} />}>删除项目</Button>
                  </Popconfirm>
                </>
              )}
            </div>
            {active?.desc && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{active.desc}</div>
            )}
          </Card>

          {/* 筛选 + 新增条目 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input.Search className="!w-72" allowClear placeholder="搜标题 / 阶段 / 正文 / 标签…"
              value={q} onChange={(e) => setQ(e.target.value)} onSearch={setQ} />
            <Select className="!w-36" allowClear placeholder="全部性质" value={sevFilter || undefined}
              onChange={(v) => setSevFilter(typeof v === "string" ? (v as Severity) : "")}
              options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} />
            {(q || sevFilter) && (
              <Button type="text" onClick={() => { setQ(""); setSevFilter("") }}>清除筛选</Button>
            )}
            <Button className="ml-auto" type="primary" ghost icon={<Plus size={14} />}
              disabled={!active} onClick={() => setEntryDraft(blankEntry())}>新建条目</Button>
          </div>

          {/* 条目列表 */}
          {list.length === 0 ? (
            <Card size="small" className="shadow-sm">
              <Empty description={active && active.entries.length ? "没有匹配的记录，换个关键词试试" : "这个项目还没有记录，点「新建条目」开始"} />
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((e) => {
                const open = !!expanded[e.id]
                return (
                  <Card key={e.id} size="small" className="shadow-sm">
                    {/* 标题行（点击展开） */}
                    <div className="flex items-start gap-2 cursor-pointer select-none"
                      onClick={() => setExpanded((m) => ({ ...m, [e.id]: !m[e.id] }))}>
                      <span className="mt-0.5 text-zinc-400">
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag color={SEVERITY_COLOR[e.severity]} className="!m-0">{SEVERITY_LABEL[e.severity]}</Tag>
                          {e.stage && <span className="text-xs text-zinc-400">{e.stage}</span>}
                          {e.date && <span className="text-xs text-zinc-400">· {e.date}</span>}
                        </div>
                        <div className="mt-1 font-medium text-zinc-800 dark:text-zinc-100">{e.title}</div>
                        {!open && (e.tags.length > 0) && (
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {e.tags.map((t) => <Tag key={t} className="!m-0 text-[10px]">{t}</Tag>)}
                          </div>
                        )}
                      </div>
                      <Space size={2} onClick={(ev) => ev.stopPropagation()}>
                        <Button size="small" type="text" icon={<Pencil size={13} />}
                          onClick={() => setEntryDraft({ ...e })}>编辑</Button>
                        <Popconfirm title="删除这条记录？" okText="删除" cancelText="取消"
                          okButtonProps={{ danger: true }} onConfirm={() => delEntry(e.id)}>
                          <Button size="small" type="text" danger icon={<Trash2 size={13} />}>删除</Button>
                        </Popconfirm>
                      </Space>
                    </div>

                    {/* 展开区 */}
                    {open && (
                      <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        <Field label="现象" value={e.symptom} />
                        <Field label="原因" value={e.cause} />
                        <Field label="解决方案" value={e.solution} />
                        {e.code.trim() && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">代码</span>
                            <CodeBlock text={e.code} />
                          </div>
                        )}
                        {e.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {e.tags.map((t) => <Tag key={t} className="!m-0">{t}</Tag>)}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ---------------- 条目编辑 ---------------- */}
      {entryDraft && (
        <Modal open width={820} maskClosable={false}
          title={active && active.entries.some((e) => e.id === entryDraft.id) ? "编辑记录" : "新建记录"}
          okText="确定" cancelText="取消" onOk={upsertEntry} onCancel={() => setEntryDraft(null)}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="标题" required>
              <Input placeholder="一句话说清是什么难点" value={entryDraft.title}
                onChange={(e) => setEntryDraft({ ...entryDraft, title: e.target.value })} />
            </Form.Item>
            <div className="grid grid-cols-3 gap-x-4">
              <Form.Item label="阶段 / 模块">
                <Input placeholder="如 W1 · B 端配置页" value={entryDraft.stage}
                  onChange={(e) => setEntryDraft({ ...entryDraft, stage: e.target.value })} />
              </Form.Item>
              <Form.Item label="性质">
                <Select value={entryDraft.severity}
                  onChange={(v) => { if (typeof v === "string") setEntryDraft({ ...entryDraft, severity: v as Severity }) }}
                  options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} />
              </Form.Item>
              <Form.Item label="日期">
                <Input placeholder={today()} value={entryDraft.date}
                  onChange={(e) => setEntryDraft({ ...entryDraft, date: e.target.value })} />
              </Form.Item>
            </div>
            <Form.Item label="现象（报错原文 / 表现）">
              <Input.TextArea rows={3} value={entryDraft.symptom}
                onChange={(e) => setEntryDraft({ ...entryDraft, symptom: e.target.value })} />
            </Form.Item>
            <Form.Item label="原因">
              <Input.TextArea rows={3} value={entryDraft.cause}
                onChange={(e) => setEntryDraft({ ...entryDraft, cause: e.target.value })} />
            </Form.Item>
            <Form.Item label="解决方案">
              <Input.TextArea rows={4} value={entryDraft.solution}
                onChange={(e) => setEntryDraft({ ...entryDraft, solution: e.target.value })} />
            </Form.Item>
            <Form.Item label="代码（可留空）">
              <Input.TextArea rows={8} className="!font-mono !text-xs" value={entryDraft.code}
                onChange={(e) => setEntryDraft({ ...entryDraft, code: e.target.value })} />
            </Form.Item>
            <Form.Item label="标签（逗号分隔）">
              <Input value={entryDraft.tags.join(",")} placeholder="如 typescript,antd,构建"
                onChange={(e) => setEntryDraft({ ...entryDraft, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* ---------------- 项目编辑 ---------------- */}
      {projectDraft && (
        <Modal open width={520} maskClosable={false}
          title={isNewProject ? "新建项目" : `编辑项目「${projectDraft.name}」`}
          okText="确定" cancelText="取消" onOk={upsertProject} onCancel={() => setProjectDraft(null)}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="代号（唯一，作数据键，创建后不可改）" required>
              <Input value={projectDraft.code} disabled={!isNewProject}
                onChange={(e) => setProjectDraft({ ...projectDraft, code: e.target.value })} />
            </Form.Item>
            <Form.Item label="名称" required>
              <Input value={projectDraft.name} placeholder="如 摸金行动（Loot Raid）"
                onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} />
            </Form.Item>
            <Form.Item label="简介">
              <Input.TextArea rows={3} value={projectDraft.desc}
                onChange={(e) => setProjectDraft({ ...projectDraft, desc: e.target.value })} />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
