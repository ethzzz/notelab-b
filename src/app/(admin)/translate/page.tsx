"use client"
// 翻译句子库（每日英语翻译练习 · B 端管理）：接口全走 /api/admin/translate/*（契约以 TranslateAdminController 为准）
// 组状态机：draft 草稿 → queued 已入队（等 0 点定时任务激活）→ used 已激活；也支持手动指定激活日期强制发布。
// 句子三通道：手动加句 / 批量导入（中文句末标点+换行切分，前端预览切分结果）/ AI 批量生成（场景+提示词+每阶数量）。
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert, AutoComplete, Button, Card, Empty, Input, InputNumber, Modal, Popconfirm,
  Select, Space, Spin, Table, Tag, Tooltip,
} from "antd"
import {
  ArrowLeft, CalendarClock, ListPlus, Pencil, Plus, Send, Sparkles, Trash2, Upload, Wand2,
} from "lucide-react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import {
  MAX_ZH_LEN, SCENARIOS, SOURCE_LABEL, STATUS_COLOR, STATUS_LABEL, TIER_COLOR, TIER_LABEL,
  splitZhPreview, type GroupRow, type SentenceRow, type TierMeta,
} from "@/lib/translate"

const TIER_OPTIONS = [
  { value: 1, label: "1 · 简单" },
  { value: 2, label: "2 · 中等" },
  { value: 3, label: "3 · 困难" },
]

type GroupDetail = {
  group: GroupRow
  sentences: SentenceRow[]
  tier_counts: Record<string, number>
  tiers: TierMeta[]
}

/** 生成结果条目（后端已入库，这里预览供复核） */
type GeneratedRow = SentenceRow & { tier: number }

export default function TranslateAdminPage() {
  // ---------------- 组列表 ----------------
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [tiers, setTiers] = useState<TierMeta[]>([])
  const [today, setToday] = useState("")
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)

  // ---------------- 组详情 ----------------
  const [openGroupId, setOpenGroupId] = useState<number | null>(null)
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---------------- 新建组 ----------------
  const [createOpen, setCreateOpen] = useState(false)
  const [newGroup, setNewGroup] = useState({ title: "", scenario: "", note: "" })

  // ---------------- 手动加句 / 编辑句子 ----------------
  const [sentOpen, setSentOpen] = useState(false)
  const [sentDraft, setSentDraft] = useState<{ id: number | null; zh_text: string; tier: number; ref_en: string; sort_order: number | null }>(
    { id: null, zh_text: "", tier: 1, ref_en: "", sort_order: null },
  )

  // ---------------- 批量导入 ----------------
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importTier, setImportTier] = useState(1)
  const [importBusy, setImportBusy] = useState(false)

  // ---------------- AI 生成 ----------------
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ scenario: "日常生活", prompt: "", t1: 4, t2: 4, t3: 3 })
  const [genBusy, setGenBusy] = useState(false)
  const [genResult, setGenResult] = useState<GeneratedRow[] | null>(null)
  const [genWarning, setGenWarning] = useState("")

  const [busyId, setBusyId] = useState<number | null>(null)
  const [dateGroupId, setDateGroupId] = useState<number | null>(null)
  const [dateValue, setDateValue] = useState("")
  const [activating, setActivating] = useState(false)

  const loadGroups = useCallback(() => {
    setLoading(true)
    apiJson("/api/admin/translate/groups")
      .then((j) => {
        setGroups(j.groups || [])
        setTiers(j.tiers || [])
        setToday(j.today || "")
        setDenied(false)
      })
      .catch((e: Error) => {
        if (String(e.message).includes("403")) setDenied(true)
        else toast.error(e.message || "加载句子组失败")
      })
      .finally(() => setLoading(false))
  }, [])

  const loadDetail = useCallback((id: number) => {
    setDetailLoading(true)
    apiJson<GroupDetail>(`/api/admin/translate/groups/${id}`)
      .then(setDetail)
      .catch((e: Error) => toast.error(e.message || "加载组详情失败"))
      .finally(() => setDetailLoading(false))
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => { if (openGroupId != null) loadDetail(openGroupId) }, [openGroupId, loadDetail])

  const sentences = useMemo(() => detail?.sentences || [], [detail])

  // ================= 组操作 =================

  async function createGroup() {
    const title = newGroup.title.trim()
    if (!title) { toast.warning("请填写组标题"); return }
    try {
      const j = await postJson("/api/admin/translate/groups", newGroup)
      toast.success(`句子组「${j.group?.title || title}」已创建（草稿）`)
      setCreateOpen(false)
      setNewGroup({ title: "", scenario: "", note: "" })
      loadGroups()
      openGroup(j.id)
    } catch (e: any) { toast.error(e.message || "创建失败") }
  }

  /** 打开组详情（setOpenGroupId 驱动 effect 取数；已在该组则手动刷新） */
  function openGroup(id: number) {
    if (openGroupId === id) loadDetail(id)
    else setOpenGroupId(id)
  }

  function backToList() {
    setOpenGroupId(null)
    setDetail(null)
    loadGroups()
  }

  async function queueGroup(g: GroupRow) {
    setBusyId(g.id)
    try {
      await apiJson(`/api/admin/translate/groups/${g.id}/queue`, { method: "POST" })
      toast.success(`「${g.title}」已入队，0 点自动激活`)
      loadGroups()
      if (openGroupId === g.id) loadDetail(g.id)
    } catch (e: any) { toast.error(e.message || "入队失败") }
    setBusyId(null)
  }

  async function unqueueGroup(g: GroupRow) {
    setBusyId(g.id)
    try {
      await apiJson(`/api/admin/translate/groups/${g.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", activated_date: "" }),
      })
      toast.success(`「${g.title}」已退回草稿`)
      loadGroups()
      if (openGroupId === g.id) loadDetail(g.id)
    } catch (e: any) { toast.error(e.message || "操作失败") }
    setBusyId(null)
  }

  function openDatePicker(g: GroupRow) {
    setDateGroupId(g.id)
    setDateValue(g.activated_date || "")
  }

  async function applyDate() {
    if (dateGroupId == null) return
    setBusyId(dateGroupId)
    try {
      const payload: Record<string, string> = dateValue ? { activated_date: dateValue } : { activated_date: "" }
      const j = await apiJson(`/api/admin/translate/groups/${dateGroupId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      toast.success(dateValue
        ? `已强制发布到 ${dateValue}（${j.group?.status === "used" ? "已激活" : j.group?.status}）`
        : "已清除激活日期")
      const gid = dateGroupId
      setDateGroupId(null)
      loadGroups()
      if (openGroupId === gid) loadDetail(gid)
    } catch (e: any) { toast.error(e.message || "设置失败") }
    setBusyId(null)
  }

  async function removeGroup(g: GroupRow) {
    setBusyId(g.id)
    try {
      await api(`/api/admin/translate/groups/${g.id}`, { method: "DELETE" })
      toast.success(`「${g.title}」已删除`)
      if (openGroupId === g.id) backToList()
      loadGroups()
    } catch (e: any) { toast.error(e.message || "删除失败") }
    setBusyId(null)
  }

  /** 手动补跑当日激活（与 0 点定时任务同一逻辑，幂等） */
  async function activateToday() {
    setActivating(true)
    try {
      const j = await postJson("/api/admin/translate/activate-today", {})
      if (j.activated) toast.success(`已激活「${j.title}」作为 ${j.date} 的内容`)
      else toast.info(`未激活：${j.reason || "当天已有激活组或队列为空"}`)
      loadGroups()
      if (openGroupId != null) loadDetail(openGroupId)
    } catch (e: any) { toast.error(e.message || "激活失败") }
    setActivating(false)
  }

  // ================= 句子操作 =================

  function openAddSentence(tier = 1) {
    setSentDraft({ id: null, zh_text: "", tier, ref_en: "", sort_order: null })
    setSentOpen(true)
  }

  function openEditSentence(s: SentenceRow) {
    setSentDraft({ id: s.id, zh_text: s.zh_text, tier: s.tier, ref_en: s.ref_en || "", sort_order: s.sort_order })
    setSentOpen(true)
  }

  async function saveSentence() {
    const zh = sentDraft.zh_text.trim()
    if (!zh) { toast.warning("中文原句不能为空"); return }
    if (!detail) return
    const gid = detail.group.id
    try {
      if (sentDraft.id == null) {
        const body: Record<string, unknown> = { zh_text: zh, tier: sentDraft.tier }
        if (sentDraft.ref_en.trim()) body.ref_en = sentDraft.ref_en.trim()
        if (sentDraft.sort_order != null) body.sort_order = sentDraft.sort_order
        const j = await postJson(`/api/admin/translate/groups/${gid}/sentences`, body)
        toast.success("句子已添加")
        if (j.warning) toast.warning(j.warning)
      } else {
        await apiJson(`/api/admin/translate/sentences/${sentDraft.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zh_text: zh, tier: sentDraft.tier, ref_en: sentDraft.ref_en.trim(),
            sort_order: sentDraft.sort_order,
          }),
        })
        toast.success("句子已更新")
      }
      setSentOpen(false)
      loadDetail(gid)
      loadGroups()
    } catch (e: any) { toast.error(e.message || "保存失败") }
  }

  async function removeSentence(s: SentenceRow) {
    if (!detail) return
    try {
      await api(`/api/admin/translate/sentences/${s.id}`, { method: "DELETE" })
      toast.success("句子已删除")
      loadDetail(detail.group.id)
      loadGroups()
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  // ================= 批量导入 =================

  const preview = useMemo(() => splitZhPreview(importText), [importText])
  const previewLong = preview.sentences.filter((s) => s.length > MAX_ZH_LEN).length

  async function doImport() {
    if (!detail) return
    if (!importText.trim()) { toast.warning("请粘贴要导入的文本"); return }
    setImportBusy(true)
    try {
      const j = await postJson(`/api/admin/translate/groups/${detail.group.id}/import`, {
        text: importText, tier: importTier,
      })
      toast.success(`已导入 ${j.imported} 句${j.skipped ? `，跳过 ${j.skipped} 条（空/重复/过短）` : ""}`)
      if (j.warning) toast.warning(j.warning)
      setImportOpen(false)
      setImportText("")
      loadDetail(detail.group.id)
      loadGroups()
    } catch (e: any) { toast.error(e.message || "导入失败") }
    setImportBusy(false)
  }

  // ================= AI 生成 =================

  async function doGenerate() {
    if (!detail) return
    const counts = { t1: genForm.t1, t2: genForm.t2, t3: genForm.t3 }
    if (counts.t1 + counts.t2 + counts.t3 === 0) { toast.warning("请至少设置一个阶梯的数量"); return }
    setGenBusy(true)
    setGenResult(null)
    setGenWarning("")
    try {
      const j = await postJson(`/api/admin/translate/groups/${detail.group.id}/generate`, {
        scenario: genForm.scenario, prompt: genForm.prompt, counts,
      })
      setGenResult(j.sentences || [])
      setGenWarning(j.warning || "")
      toast.success(`AI 已生成 ${j.generated} 句并入库`)
      loadDetail(detail.group.id)
      loadGroups()
    } catch (e: any) {
      toast.error(e.message || "生成失败")
      setGenWarning(e.message || "生成失败")
    }
    setGenBusy(false)
  }

  async function discardGenerated(s: GeneratedRow) {
    if (!detail) return
    try {
      await api(`/api/admin/translate/sentences/${s.id}`, { method: "DELETE" })
      setGenResult((rows) => (rows || []).filter((r) => r.id !== s.id))
      loadDetail(detail.group.id)
      loadGroups()
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  // ================= 渲染 =================

  if (denied) {
    return (
      <Card>
        <Empty description="无「翻译句子库」页面权限，请联系超级管理员在 /perm 分配" />
      </Card>
    )
  }

  const groupColumns = [
    {
      title: "标题", dataIndex: "title",
      render: (_: unknown, g: GroupRow) => (
        <button onClick={() => openGroup(g.id)} className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline dark:text-blue-400">
          <ListPlus size={14} /> {g.title} <span className="text-[10px] font-normal text-zinc-400">#{g.id}</span>
        </button>
      ),
    },
    {
      title: "状态", dataIndex: "status", width: 100,
      render: (s: GroupRow["status"], g: GroupRow) => (
        <Space size={4}>
          <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s}</Tag>
          {g.status === "used" && g.activated_date === today && <Tag color="blue">今日</Tag>}
        </Space>
      ),
    },
    { title: "句子数", dataIndex: "sentence_count", width: 90, align: "center" as const },
    {
      title: "激活日期", dataIndex: "activated_date", width: 130,
      render: (d: string | null) => d
        ? <span className="font-mono text-xs">{d}</span>
        : <span className="text-xs text-zinc-400">—</span>,
    },
    {
      title: "来源", dataIndex: "source", width: 100,
      render: (s: GroupRow["source"], g: GroupRow) => (
        <Tooltip title={g.scenario ? `场景：${g.scenario}` : undefined}>
          <Tag>{SOURCE_LABEL[s] || s}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "创建时间", dataIndex: "created_at", width: 150,
      render: (v: string) => <span className="text-xs text-zinc-400 whitespace-nowrap">{String(v || "").slice(0, 16)}</span>,
    },
    {
      title: "操作", key: "op", width: 340, align: "right" as const,
      render: (_: unknown, g: GroupRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openGroup(g.id)}>句子管理</Button>
          {g.status === "queued"
            ? <Button size="small" loading={busyId === g.id} onClick={() => unqueueGroup(g)}>退回草稿</Button>
            : <Button size="small" type={g.status === "draft" ? "primary" : "default"} ghost={g.status !== "draft"}
                loading={busyId === g.id} disabled={g.status === "used"} onClick={() => queueGroup(g)}>
                <Send size={12} className="mr-1" />入队
              </Button>}
          <Button size="small" icon={<CalendarClock size={12} />} onClick={() => openDatePicker(g)}>激活日期</Button>
          <Popconfirm title="删除后句子一并删除，确定？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
            onConfirm={() => removeGroup(g)}>
            <Button size="small" danger icon={<Trash2 size={12} />} loading={busyId === g.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const sentenceColumns = [
    {
      title: "阶梯", dataIndex: "tier", width: 90,
      filters: TIER_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (v: unknown, s: SentenceRow) => s.tier === v,
      render: (t: number) => <Tag color={TIER_COLOR[t]}>{TIER_LABEL[t] || t}</Tag>,
    },
    {
      title: "中文原句", dataIndex: "zh_text",
      render: (v: string) => (
        <span className={v.length > MAX_ZH_LEN ? "text-amber-600 dark:text-amber-400" : ""}>
          {v}
          {v.length > MAX_ZH_LEN && <span className="ml-1 text-[10px]">（{v.length} 字，偏长）</span>}
        </span>
      ),
    },
    {
      title: "参考译文", dataIndex: "ref_en",
      render: (v: string | null) => v
        ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{v}</span>
        : <span className="text-xs text-zinc-400">—</span>,
    },
    { title: "排序", dataIndex: "sort_order", width: 70, align: "center" as const },
    {
      title: "操作", key: "op", width: 120, align: "right" as const,
      render: (_: unknown, s: SentenceRow) => (
        <Space size={4}>
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEditSentence(s)} />
          <Popconfirm title="删除这句？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
            onConfirm={() => removeSentence(s)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ---------------- 组详情视图 ----------------
  if (detail) {
    const g = detail.group
    return (
      <div className="flex flex-col gap-3">
        <Card
          title={
            <Space wrap>
              <Button icon={<ArrowLeft size={14} />} onClick={backToList}>返回列表</Button>
              <span className="font-semibold">{g.title}</span>
              <Tag color={STATUS_COLOR[g.status]}>{STATUS_LABEL[g.status]}</Tag>
              <Tag>{SOURCE_LABEL[g.source] || g.source}</Tag>
              {g.activated_date && <Tag color="blue">激活日期 {g.activated_date}</Tag>}
            </Space>
          }
          extra={
            <Space wrap>
              <Button icon={<Plus size={14} />} onClick={() => openAddSentence(1)}>手动加句</Button>
              <Button icon={<Upload size={14} />} onClick={() => setImportOpen(true)}>批量导入</Button>
              <Button type="primary" icon={<Sparkles size={14} />} onClick={() => { setGenResult(null); setGenWarning(""); setGenOpen(true) }}>AI 生成</Button>
              {g.status !== "queued" && g.status !== "used" && (
                <Button icon={<Send size={14} />} onClick={() => queueGroup(g)} loading={busyId === g.id}>入队</Button>
              )}
            </Space>
          }
        >
          {g.note && <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">备注：{g.note}</div>}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {tiers.map((t) => (
              <span key={t.tier}>
                <Tag color={TIER_COLOR[t.tier]}>{t.name}</Tag>
                {detail.tier_counts?.[String(t.tier)] ?? 0} 句
              </span>
            ))}
            <span className="text-zinc-400">· 共 {sentences.length} 句（建议每阶 3-5 句）</span>
          </div>
          {g.status === "draft" && sentences.length > 0 && (
            <Alert className="mb-3" type="info" showIcon
              message="该组仍为草稿：点「入队」后由 0 点定时任务自动激活为当天内容；也可在列表用「激活日期」强制发布。" />
          )}
          <Table rowKey="id" size="middle" loading={detailLoading} columns={sentenceColumns as any}
            dataSource={sentences} pagination={false} scroll={{ x: 720 }}
            locale={{ emptyText: "还没有句子，用上方「手动加句 / 批量导入 / AI 生成」填充" }} />
        </Card>

        {/* 手动加句 / 编辑句子 */}
        <Modal open={sentOpen} title={sentDraft.id == null ? "手动加句" : `编辑句子 #${sentDraft.id}`}
          okText="保存" cancelText="取消" onOk={saveSentence} onCancel={() => setSentOpen(false)} width={560}>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <div className="mb-1 text-xs text-zinc-500">中文原句（建议 10-{MAX_ZH_LEN} 字）</div>
              <Input.TextArea rows={3} maxLength={255} showCount value={sentDraft.zh_text}
                placeholder="如：如果明天下雨，我们就把会议改到下周举行。"
                onChange={(e) => setSentDraft({ ...sentDraft, zh_text: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="mb-1 text-xs text-zinc-500">阶梯</div>
                <Select className="w-full" value={sentDraft.tier} options={TIER_OPTIONS}
                  onChange={(v) => setSentDraft({ ...sentDraft, tier: v })} />
              </div>
              <div className="flex-1">
                <div className="mb-1 text-xs text-zinc-500">排序（留空自动排到该阶梯末尾）</div>
                <InputNumber className="!w-full" min={0} max={999} value={sentDraft.sort_order}
                  onChange={(v) => setSentDraft({ ...sentDraft, sort_order: v })} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">参考英文译文（可选，仅供判分对照）</div>
              <Input.TextArea rows={2} maxLength={500} value={sentDraft.ref_en}
                placeholder="如：If it rains tomorrow, we will postpone the meeting to next week."
                onChange={(e) => setSentDraft({ ...sentDraft, ref_en: e.target.value })} />
            </div>
          </div>
        </Modal>

        {/* 批量导入 */}
        <Modal open={importOpen} title="批量导入句子" okText={`导入 ${preview.sentences.length} 句`}
          cancelText="取消" confirmLoading={importBusy} onOk={doImport} onCancel={() => setImportOpen(false)} width={680}>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">导入到阶梯</span>
              <Select className="w-40" value={importTier} options={TIER_OPTIONS} onChange={setImportTier} />
            </div>
            <Input.TextArea rows={7} value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder={"粘贴一段中文文本，按句末标点（。！？；…）与换行自动切分：\n我每天早上七点起床。\n今天天气很好，我们去公园散步吧！"} />
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              切分预览：共 {preview.sentences.length} 句
              {preview.skipped > 0 && <span className="ml-1 text-amber-600">（将跳过 {preview.skipped} 条：空/重复/过短）</span>}
              {previewLong > 0 && <span className="ml-1 text-amber-600">（{previewLong} 句超过 {MAX_ZH_LEN} 字，仍会入库）</span>}
            </div>
            {preview.sentences.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                {preview.sentences.map((s, i) => (
                  <div key={i} className="flex gap-2 py-0.5 text-xs">
                    <span className="w-6 shrink-0 text-right text-zinc-400">{i + 1}</span>
                    <span className={s.length > MAX_ZH_LEN ? "text-amber-600" : ""}>{s}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-zinc-400">入库时会再次去重（与组内已有句子相同的自动跳过）。</div>
          </div>
        </Modal>

        {/* AI 生成 */}
        <Modal open={genOpen} title="AI 批量生成句子" width={720} maskClosable={!genBusy}
          onCancel={() => { if (!genBusy) setGenOpen(false) }}
          footer={
            <Space>
              <Button onClick={() => setGenOpen(false)} disabled={genBusy}>关闭</Button>
              <Button type="primary" icon={<Wand2 size={14} />} loading={genBusy} onClick={doGenerate}>
                {genBusy ? "生成中（约 1-2 分钟）…" : (genResult ? "重新生成" : "开始生成")}
              </Button>
            </Space>
          }>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="mb-1 text-xs text-zinc-500">场景</div>
                <AutoComplete className="w-full" value={genForm.scenario} options={SCENARIOS.map((s) => ({ value: s }))}
                  onChange={(v) => setGenForm({ ...genForm, scenario: v })} placeholder="如：机场出行" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">提示词（可选，补充出题要求）</div>
              <Input.TextArea rows={2} maxLength={500} value={genForm.prompt}
                onChange={(e) => setGenForm({ ...genForm, prompt: e.target.value })}
                placeholder="如：围绕值机、安检、登机、行李与航班延误，句子要贴近真实口语场景" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {TIER_OPTIONS.map((o) => {
                const key = `t${o.value}` as "t1" | "t2" | "t3"
                return (
                  <div key={key}>
                    <div className="mb-1 text-xs text-zinc-500">{o.label}（句数）</div>
                    <InputNumber min={0} max={10} value={genForm[key]}
                      onChange={(v) => setGenForm({ ...genForm, [key]: v ?? 0 })} />
                  </div>
                )
              })}
              <span className="pb-1 text-xs text-zinc-400">合计 {genForm.t1 + genForm.t2 + genForm.t3} 句</span>
            </div>
            {genBusy && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
                <Spin size="small" /> AI 正在按阶梯出题（10-50 字中文 + 参考英文），通常需要 1-2 分钟，请勿关闭…
              </div>
            )}
            {genWarning && !genBusy && <Alert type="warning" showIcon message={genWarning} />}
            {genResult && genResult.length > 0 && !genBusy && (
              <div>
                <div className="mb-1 text-xs text-zinc-500">
                  生成结果预览（已入库，可删除不要的句子）：{genResult.length} 句
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {genResult.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
                      <Tag color={TIER_COLOR[s.tier]}>{TIER_LABEL[s.tier]}</Tag>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{s.zh_text}</div>
                        {s.ref_en && <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.ref_en}</div>}
                      </div>
                      <Button size="small" danger type="text" icon={<Trash2 size={12} />} onClick={() => discardGenerated(s)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    )
  }

  // ---------------- 组列表视图 ----------------
  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><ListPlus size={17} /> 翻译句子库</span>}
      extra={
        <Space wrap>
          <Tooltip title="手动补跑当日激活（与 0 点定时任务同一逻辑，幂等）">
            <Button icon={<CalendarClock size={14} />} loading={activating} onClick={activateToday}>立即激活今日</Button>
          </Tooltip>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>新建句子组</Button>
        </Space>
      }
    >
      <div className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        今天 <span className="font-mono">{today}</span> · 待激活队列 {groups.filter((g) => g.status === "queued").length} 组 ·
        每天 0 点自动取队首一组激活为当天 C 端练习内容（草稿组需先「入队」）
      </div>
      <Table rowKey="id" size="middle" loading={loading} columns={groupColumns as any} dataSource={groups}
        pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }}
        locale={{ emptyText: "还没有句子组，点右上角「新建句子组」开始" }} />

      {/* 新建组 */}
      <Modal open={createOpen} title="新建句子组" okText="创建" cancelText="取消" onOk={createGroup}
        onCancel={() => setCreateOpen(false)} width={520}>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">标题（必填）</div>
            <Input maxLength={120} showCount value={newGroup.title} placeholder="如：2026-09-22 日常生活翻译"
              onChange={(e) => setNewGroup({ ...newGroup, title: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">场景（可选，AI 生成时作默认场景）</div>
            <AutoComplete className="w-full" value={newGroup.scenario} options={SCENARIOS.map((s) => ({ value: s }))}
              onChange={(v) => setNewGroup({ ...newGroup, scenario: v })} placeholder="如：机场出行" />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">备注（可选）</div>
            <Input.TextArea rows={2} maxLength={255} value={newGroup.note}
              onChange={(e) => setNewGroup({ ...newGroup, note: e.target.value })} />
          </div>
          <div className="text-xs text-zinc-400">创建后为草稿状态，填充句子再「入队」等 0 点激活。</div>
        </div>
      </Modal>

      {/* 设置激活日期 */}
      <Modal open={dateGroupId != null} title="设置激活日期（强制发布）" okText="保存" cancelText="取消"
        onOk={applyDate} onCancel={() => setDateGroupId(null)} width={460}>
        <div className="mt-3 flex flex-col gap-3">
          <div className="text-xs text-zinc-500">
            填写日期即把该组标记为「已激活」并作为该日 C 端内容；清空则退回草稿。
            正常流程建议用「入队」交给 0 点定时任务。
          </div>
          <Input className="font-mono" placeholder="YYYY-MM-DD，如 2026-09-25" value={dateValue}
            onChange={(e) => setDateValue(e.target.value.trim())} />
          <Space wrap>
            <Button size="small" onClick={() => setDateValue(today)}>今天（{today}）</Button>
            <Button size="small" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() + 1)
              setDateValue(d.toISOString().slice(0, 10))
            }}>明天</Button>
            <Button size="small" danger onClick={() => setDateValue("")}>清空</Button>
          </Space>
        </div>
      </Modal>
    </Card>
  )
}
