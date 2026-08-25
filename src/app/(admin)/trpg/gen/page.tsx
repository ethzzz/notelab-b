"use client"
// 剧本生成（antd 版）：轮询任务交互与 myapp 一致；新增「发布/取消发布」（B/C 拆分阶段2接口）
import { useCallback, useEffect, useState } from "react"
import { Button, Table, Tag, Space, Modal, Select, Form, Input } from "antd"
import { api, apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import ScenarioPreview from "@/components/ScenarioPreview"
import { TRPG_STYLES, TRPG_SCALES, randomSetup, type ScenarioRow, type ScenarioData } from "@/lib/trpg"
import { Dices, Eye, Plus, Trash2 } from "lucide-react"

const EMPTY_FORM = { title: "", background: "", characters: "", places: "", event: "", style: "悬疑推理", scale: "中" }

export default function TrpgGenPage() {
  const [rows, setRows] = useState<ScenarioRow[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<{ id: number; scenario: ScenarioData } | null>(null)
  const [pubBusyId, setPubBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    apiJson("/api/trpg/scenarios").then((j) => setRows(j.scenarios || [])).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const patch = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  /** 随机灵感：按当前风格从预设素材库抽取一组设定填充表单（纯前端，可反复点击） */
  function randomFill() {
    setForm((f) => ({ ...f, ...randomSetup(f.style) }))
    toast.info("已填入随机灵感，可随意修改细节")
  }

  async function generate() {
    if (!form.background.trim() && !form.characters.trim() && !form.event.trim()) {
      toast.warning("请至少填写背景、人物或核心事件之一"); return
    }
    setBusy(true)
    try {
      // 异步任务：提交后立即返回 task_id，轮询进度（避免长请求被代理层超时断开）
      const t = await apiJson("/api/trpg/scenarios", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      })
      for (let i = 0; i < 120; i++) { // 3s × 120 = 最长 6 分钟
        await new Promise((r) => setTimeout(r, 3000))
        const s = await apiJson(`/api/trpg/scenarios/tasks/${t.task_id}`)
        if (s.state === "done") {
          toast.success(`剧本「${s.scenario?.title || "未命名"}」生成完成`)
          setOpen(false)
          setForm({ ...EMPTY_FORM, style: form.style, scale: form.scale })
          setViewing({ id: s.id, scenario: s.scenario })
          load()
          return
        }
        if (s.state === "error") {
          toast.error(s.error || "生成失败")
          return
        }
      }
      toast.error("生成超时，请稍后到剧本列表查看结果")
      load()
    } catch (e: any) {
      toast.error(e.message || "生成失败")
    } finally {
      setBusy(false)
    }
  }

  async function view(s: ScenarioRow) {
    try {
      const j = await apiJson(`/api/trpg/scenarios/${s.id}`)
      setViewing({ id: s.id, scenario: j.scenario })
    } catch (e: any) { toast.error(e.message || "加载失败") }
  }

  function remove(s: ScenarioRow) {
    Modal.confirm({
      title: "删除剧本",
      content: `删除「${s.title}」？相关对局记录也会一并删除。`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try { await api(`/api/trpg/scenarios/${s.id}`, { method: "DELETE" }); toast.success("已删除"); load() }
        catch (e: any) { toast.error(e.message || "删除失败") }
      },
    })
  }

  /** 发布/取消发布到 C 端（阶段2接口：POST /api/trpg/scenarios/{id}/publish|unpublish） */
  async function togglePublish(s: ScenarioRow) {
    const publishing = !s.published
    if (!publishing) {
      Modal.confirm({
        title: "取消发布",
        content: `将「${s.title}」从 C 端下架？已开局的 C 端存档不受影响，仅限制新开局。`,
        okText: "下架",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => doPublish(s, publishing),
      })
      return
    }
    await doPublish(s, publishing)
  }

  async function doPublish(s: ScenarioRow, publishing: boolean) {
    setPubBusyId(s.id)
    try {
      await apiJson(`/api/trpg/scenarios/${s.id}/${publishing ? "publish" : "unpublish"}`, { method: "POST" })
      toast.success(publishing ? `「${s.title}」已发布到 C 端` : `「${s.title}」已下架`)
      load()
    } catch (e: any) {
      toast.error(e.message || "操作失败")
    }
    setPubBusyId(null)
  }

  const columns = [
    {
      title: "剧本", dataIndex: "title",
      render: (_: any, s: ScenarioRow) => <span className="font-medium text-zinc-800 whitespace-nowrap">📜 {s.title} <span className="text-[10px] text-zinc-400 font-normal">#{s.id}</span></span>,
    },
    {
      title: "风格", dataIndex: "genre", width: 110,
      render: (g: string) => g ? <Tag color="purple">{g}</Tag> : <span className="text-zinc-400">—</span>,
    },
    {
      title: "简介", dataIndex: "summary",
      render: (v: string) => <span className="text-xs text-zinc-500 line-clamp-1 block max-w-[300px]">{v || "—"}</span>,
    },
    {
      title: "发布状态", width: 100,
      render: (_: any, s: ScenarioRow) => s.published ? <Tag color="success">已发布</Tag> : <Tag>未发布</Tag>,
    },
    {
      title: "创建时间", dataIndex: "created_at", width: 140,
      render: (v: string) => <span className="text-xs text-zinc-400 whitespace-nowrap">{String(v || "").slice(0, 16)}</span>,
    },
    {
      title: "操作", align: "right" as const, width: 330,
      render: (_: any, s: ScenarioRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => view(s)}>预览</Button>
          <Button size="small" loading={pubBusyId === s.id}
            type={s.published ? "default" : "primary"} ghost={!!s.published}
            onClick={() => togglePublish(s)}>
            {s.published ? "取消发布" : "发布到 C 端"}
          </Button>
          <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => remove(s)} />
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="primary" icon={<Plus size={15} />} onClick={() => setOpen(true)}>生成新剧本</Button>
        <span className="text-xs text-zinc-400">共 {rows.length} 个剧本 · 生成通常需要 1-3 分钟 · 发布后 C 端「剧本列表」可见</span>
      </div>

      {/* 剧本表格 */}
      <Table rowKey="id" size="middle" columns={columns as any} dataSource={rows} pagination={false}
        locale={{ emptyText: "还没有剧本，点左上角「生成新剧本」开始创作" }}
        scroll={{ x: 760 }} />

      {/* 配置弹窗 */}
      <Modal open={open} onCancel={() => { if (!busy) setOpen(false) }} title="🎬 剧本设定" width={560}
        okText={busy ? "AI 创作中…" : "🎲 开始生成"} cancelText="取消"
        confirmLoading={busy} onOk={generate} maskClosable={false}
        okButtonProps={{ disabled: busy }}>
        <Form layout="vertical" className="mt-3">
          <div className="flex justify-end">
            <Button size="small" icon={<Dices size={13} />} onClick={randomFill} disabled={busy} title="按当前风格随机填充表单内容">
              随机灵感
            </Button>
          </div>
          <Form.Item label="标题" extra="可选，AI 可代起名">
            <Input placeholder="如：雾港惊魂" value={form.title} onChange={(e) => patch("title", e.target.value)} />
          </Form.Item>
          <Form.Item label="背景" extra="时代 / 世界观" required>
            <Input.TextArea rows={2} placeholder="如：1920 年代美国东海岸，迷雾笼罩的港口小镇" value={form.background} onChange={(e) => patch("background", e.target.value)} />
          </Form.Item>
          <Form.Item label="人物" extra="逗号分隔多个角色">
            <Input.TextArea rows={2} placeholder="如：私家侦探主角、神秘的码头管理员、失踪的考古学家" value={form.characters} onChange={(e) => patch("characters", e.target.value)} />
          </Form.Item>
          <Form.Item label="地点">
            <Input placeholder="如：废弃灯塔、旧图书馆、深夜酒馆" value={form.places} onChange={(e) => patch("places", e.target.value)} />
          </Form.Item>
          <Form.Item label="核心事件" extra="故事的起点与核心悬念">
            <Input.TextArea rows={2} placeholder="如：考古学家留下一封密信后失踪，信中反复提到「灯塔下的低语」" value={form.event} onChange={(e) => patch("event", e.target.value)} />
          </Form.Item>
          <div className="flex gap-3">
            <Form.Item label="风格" className="flex-1">
              <Select value={form.style} onChange={(v) => patch("style", v)} options={TRPG_STYLES.map((x) => ({ value: x, label: x }))} />
            </Form.Item>
            <Form.Item label="篇幅" className="flex-1">
              <Select value={form.scale} onChange={(v) => patch("scale", v)} options={TRPG_SCALES} />
            </Form.Item>
          </div>
          {busy && <div className="text-xs text-zinc-400 text-center leading-relaxed">AI 正在构建故事线、分支与结局，通常需要 1-3 分钟，请耐心等待…（生成中请勿关闭）</div>}
        </Form>
      </Modal>

      {/* 预览弹窗 */}
      {viewing && (
        <Modal open onCancel={() => setViewing(null)} title={`剧本预览 #${viewing.id}`} width={680}
          footer={<Button onClick={() => setViewing(null)}>关闭</Button>}>
          <ScenarioPreview scenario={viewing.scenario} />
        </Modal>
      )}
    </div>
  )
}
