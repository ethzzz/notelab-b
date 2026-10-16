"use client"
// 博客管理 → 文章起草 / 编辑：**新建与编辑是同一个页面**（用户 2026-10-16 定）。
//
// 预览为什么能「和线上一致」：正文**不是在这里渲染的** —— 这里只把当前内容 POST 给
//   /api/blog/preview 拿一个短时 token，再把 `/blog/preview/<token>/` 嵌进 iframe。
//   那一页由博客自己的 Astro SSR 渲染，用的是与线上文章页同一套布局 + 同一套 markdown 管线
//   （expressive-code 高亮 / KaTeX / 提示块 / 标题锚点）。在这里用 marked 渲染只会得到"另一种观感"。
//
// 接口分工（见 notelab-java BlogContentController）：
//   POST /api/blog/plan     干跑：会写成什么（URL / 会不会撞名 / 缺什么 / 警告）
//   POST /api/blog/content  新建 ｜ PUT /api/blog/articles/{slug} 更新（可改名）
//   POST /api/blog/preview  把当前内容放进短时存储（30 分钟），返回可嵌地址
// GET /api/blog/options 提供分类 / 标签候选 —— 从仓内现状来，别再手输（手输会把同一类内容写裂）。
//
// ⚠️ 写入响应里的 deploy 字段必须如实显示：草稿=不构建 / 发布=已排队 jobId / 部署进行中=409 被拒。
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Alert, AutoComplete, Button, Card, Collapse, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Switch, Tag, Typography } from "antd"
import { ExternalLink, Eye, FileText, ListChecks, RotateCw, Save, Send, Wand2 } from "lucide-react"
import { AdminPage } from "@/components/admin"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

const MdEditor = dynamic(() => import("@/components/md-editor"), { ssr: false })

const { Text, Paragraph } = Typography

type Draft = {
  title: string
  slug: string
  category: string
  tags: string[]
  description: string
  content: string
  draft: boolean
  published: string
}

const EMPTY: Draft = { title: "", slug: "", category: "", tags: [], description: "", content: "", draft: true, published: "" }

const PERSONAS = [
  { value: "资深前端工程师，工作十年，一直保持做笔记的习惯", label: "资深前端十年沉淀（默认）" },
  { value: "注重工程化与性能优化的前端工程师", label: "工程化 / 性能导向" },
  { value: "带团队的前端负责人，关注架构与协作", label: "前端负责人视角" },
]

/** 拆 frontmatter（只取编辑器要用的字段；正文之外的键由服务端在写入时保留） */
function splitFm(md: string): { body: string; fm: Record<string, string> } {
  const t = (md || "").trim()
  if (!t.startsWith("---")) return { body: t, fm: {} }
  const end = t.indexOf("\n---", 3)
  if (end < 0) return { body: t, fm: {} }
  const fm: Record<string, string> = {}
  for (const line of t.slice(3, end).split("\n")) {
    const i = line.indexOf(":")
    if (i < 0) continue
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")
  }
  return { body: t.slice(end + 4).trim(), fm }
}

/** `[a, 'b']` / `a, b` → ["a","b"] */
function parseTagList(v: string): string[] {
  return v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean)
}

export default function BlogEditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
      <Inner />
    </Suspense>
  )
}

/** `?slug=<已有文章>` → 编辑那一篇；没有就是新建。key 让切换文章时重建组件，避免上一篇的草稿残留在 state */
function Inner() {
  const sp = useSearchParams()
  const raw = sp.get("slug") || ""
  const slug = /^[a-z0-9\u4e00-\u9fa5-]{1,80}$/i.test(raw) ? raw : ""
  return <Editor key={slug || "new"} editing={slug} />
}

function Editor({ editing }: { editing: string }) {
  const [d, setD] = useState<Draft>(EMPTY)
  const [loading, setLoading] = useState(!!editing)
  const [busy, setBusy] = useState("")
  const [cats, setCats] = useState<{ value: string; label: string }[]>([])
  const [tagOpts, setTagOpts] = useState<{ value: string; label: string }[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deploy, setDeploy] = useState<any>(null)

  const patch = useCallback((p: Partial<Draft>) => setD((v) => ({ ...v, ...p })), [])

  const loadOptions = useCallback(async () => {
    try {
      const r = await apiJson<any>("/api/blog/options")
      setCats((r.categories || []).map((c: any) => ({ value: c.name, label: `${c.name}（${c.count}）` })))
      setTagOpts((r.tags || []).map((t: any) => ({ value: t.name, label: `${t.name}（${t.count}）` })))
    } catch { /* 候选只是辅助，拉不到不阻塞编辑 */ }
  }, [])

  useEffect(() => { void loadOptions() }, [loadOptions])

  useEffect(() => {
    if (!editing) return
    setLoading(true)
    apiJson<any>(`/api/blog/articles/${encodeURIComponent(editing)}`)
      .then((r) => {
        setD({
          title: r.title || "", slug: r.slug || editing, category: r.category || "",
          tags: Array.isArray(r.tags) ? r.tags : [], description: r.description || "",
          content: r.body || "", draft: !!r.draft, published: r.published || "",
        })
      })
      .catch((e) => toast.error(`加载失败：${(e as Error).message}`))
      .finally(() => setLoading(false))
  }, [editing])

  /** 请求体：新建带 slug（留空则由标题推导）；编辑带 newSlug（改名时才带） */
  const body = useCallback((publish?: boolean) => {
    const draft = publish === undefined ? d.draft : !publish
    const b: Record<string, unknown> = {
      title: d.title, category: d.category, tags: d.tags, description: d.description,
      content_md: d.content, draft,
    }
    if (editing) {
      if (d.slug && d.slug !== editing) b.newSlug = d.slug
    } else if (d.slug) {
      b.slug = d.slug
    }
    return b
  }, [d, editing])

  /** 干跑：**与真写共用同一个 plan()**，所以这里看到的 URL / 阻塞项就是真写会遇到的 */
  async function doPlan() {
    setBusy("plan")
    try {
      const r = await apiJson<any>("/api/blog/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body(), mode: editing ? "update" : "create", slug: d.slug || editing }),
      })
      setPlan(r)
      setPlanOpen(true)
    } catch (e) {
      toast.error(`干跑失败：${(e as Error).message}`)
    } finally { setBusy("") }
  }

  async function save(publish?: boolean) {
    setBusy(publish === true ? "publish" : "draft")
    try {
      const payload = body(publish)
      const r = editing
        ? await apiJson<any>(`/api/blog/articles/${encodeURIComponent(editing)}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          })
        : await postJson("/api/blog/content", payload)
      patch({ draft: !!r.draft })
      setDeploy(r.deploy)
      const where = r.renamed ? `${r.oldSlug} → ${r.slug}` : r.slug
      toast.success(`已写入博客仓：${where}（${r.draft ? "草稿" : "已发布"}）`)
      if (!editing && r.slug) {
        // 新建成功后切到"编辑这一篇"：后续保存就是更新，不会再建出第二个文件
        window.history.replaceState(null, "", `${window.location.pathname}?slug=${encodeURIComponent(r.slug)}`)
        patch({ slug: r.slug })
      }
      void loadOptions()
    } catch (e) {
      toast.error((e as Error).message || "保存失败")
    } finally { setBusy("") }
  }

  /** 预览：把**当前编辑中的内容**（还没落盘的也算）交给博客侧渲染 */
  async function doPreview() {
    if (!d.content.trim()) { toast.warning("还没有正文，预览是空页"); return }
    setBusy("preview")
    try {
      const r = await postJson("/api/blog/preview", {
        title: d.title, slug: d.slug || editing, category: d.category, tags: d.tags,
        description: d.description, draft: d.draft, content_md: d.content,
      })
      setPreviewUrl(`${window.location.origin}${r.url}`)
      setPreviewOpen(true)
    } catch (e) {
      toast.error(`预览失败：${(e as Error).message}`)
    } finally { setBusy("") }
  }

  /** AI 起草的整篇 Markdown（含 frontmatter）→ 填进**同一套字段**，之后走同一条保存/预览链路。
   *  刻意不自己维护一份"AI 结果"状态：那会让「编辑器里的」与「最终发布的」变成两份内容。 */
  function applyAiDraft(md: string) {
    const { body, fm } = splitFm(md)
    patch({
      title: fm.title || d.title,
      category: fm.category || d.category,
      description: fm.description || d.description,
      tags: fm.tags ? parseTagList(fm.tags) : d.tags,
      content: body || md,
    })
  }

  const onlineUrl = useMemo(
    () => (editing && !d.draft ? `/blog/posts/${encodeURIComponent(editing)}/` : ""),
    [editing, d.draft],
  )

  if (loading) return <div className="p-10 text-center"><Spin /></div>

  return (
    <AdminPage
      level={1}
      title={editing ? `✍️ 编辑文章` : "✍️ 新建文章"}
      description={
        editing
          ? <>正在编辑 <Text code>{editing}</Text>。预览由博客自己的页面渲染，与线上文章页一致；发布后会触发一次构建（约 1 分钟）。</>
          : "新建与编辑是同一个页面：保存成功后会自动切到编辑态，后续保存就是更新。先存草稿、预览满意再发布。"
      }
      extra={
        <Space wrap>
          {onlineUrl && (
            <Button icon={<ExternalLink size={14} />} href={onlineUrl} target="_blank">看线上</Button>
          )}
          <Button icon={<ListChecks size={14} />} loading={busy === "plan"} onClick={() => void doPlan()}>干跑检查</Button>
          <Button icon={<Eye size={14} />} loading={busy === "preview"} onClick={() => void doPreview()}>预览</Button>
          <Button icon={<Save size={14} />} loading={busy === "draft"} onClick={() => void save(true)}>存草稿</Button>
          <Popconfirm
            title="发布到博客？"
            description="会写入博客仓并触发一次构建（约 1 分钟）后才在线上可见。"
            okText="发布" cancelText="再想想"
            onConfirm={() => void save(false)}
          >
            <Button type="primary" icon={<Send size={14} />} loading={busy === "publish"}>发布</Button>
          </Popconfirm>
        </Space>
      }
    >
      {/* AI 起草：生成结果**填进下面同一套字段**再走同一条保存/预览链路 */}
      <Collapse
        size="small"
        items={[{
          key: "ai",
          label: (
            <span>
              <Wand2 size={14} className="inline align-[-2px] mr-1" />
              AI 起草（生成后自动填入下方字段，可继续手改；不覆盖已有的非空标题/正文）
            </span>
          ),
          children: <AiDraftCard categories={cats} onUse={applyAiDraft} />,
        }]}
      />

      {deploy && (
        <Alert
          type={deploy.skipped ? "info" : deploy.ok ? "success" : "warning"}
          showIcon closable
          onClose={() => setDeploy(null)}
          message={
            deploy.skipped ? "草稿不上线，未触发构建"
              : deploy.ok ? `已排队部署（#${deploy.jobId}），约 1 分钟后线上可见`
                : `这次没有触发部署：${deploy.reason || "未知原因"}`
          }
          description={
            deploy.ok && !deploy.skipped
              ? <>构建进度见 <a href="/admin/blog-deploy">部署状态</a>。构建进行中（约 1 分钟）改文章会被拒绝，属刻意互斥。</>
              : undefined
          }
        />
      )}

      <Card size="small">
        <Space direction="vertical" className="w-full" size="middle">
          <Input
            addonBefore="标题" placeholder="文章标题（必填）" size="large"
            value={d.title} onChange={(e) => patch({ title: e.target.value })}
          />
          <Space wrap>
            <Input
              addonBefore="slug" placeholder={editing ? editing : "留空由标题推导"} style={{ width: 360 }}
              value={d.slug} onChange={(e) => patch({ slug: e.target.value.trim() })}
            />
            {/* 分类用 AutoComplete：候选来自仓内现状，但**允许自由输入** —— 既有文章用的是自由分类，
                一刀切只准选候选会让那些文章编辑不了 */}
            <AutoComplete
              style={{ width: 260 }}
              placeholder="分类（可选候选，也可直接输入）"
              value={d.category || undefined}
              onChange={(v) => patch({ category: v || "" })}
              options={cats}
              filterOption={(input, opt) => String(opt?.value ?? "").toLowerCase().includes(input.toLowerCase())}
              allowClear
            />
          </Space>
          <Space wrap className="w-full">
            <span className="text-sm text-zinc-500">标签</span>
            <Select
              mode="tags" style={{ minWidth: 420 }} placeholder="回车添加；下拉里是仓内已有标签"
              value={d.tags} onChange={(v) => patch({ tags: v })}
              options={tagOpts}
            />
            <Space>
              <Switch checked={d.draft} onChange={(c) => patch({ draft: c })} />
              <Text>存为草稿{editing && d.published ? `（发布于 ${String(d.published).slice(0, 10)}）` : ""}</Text>
            </Space>
          </Space>
          <Input.TextArea
            rows={2} placeholder="描述（列表页与分享卡片上的摘要）"
            value={d.description} onChange={(e) => patch({ description: e.target.value })}
          />
          <div className="border border-solid border-[rgba(128,128,128,.25)] rounded">
            <MdEditor value={d.content} minHeight={460} onChange={(v) => patch({ content: v })} />
          </div>
          <Paragraph type="secondary" className="!mb-0 !text-xs">
            ⚠️ 编辑区右侧那个面板是<b>编辑器自带的快速预览</b>（marked 渲染，够用来看结构）；
            要看与线上<b>完全一致</b>的观感（代码高亮 / 提示块 / 公式 / 目录），点上方的「预览」——
            那是博客自己的页面渲染出来的。
          </Paragraph>
          <Paragraph type="secondary" className="!mb-0 !text-xs">
            ⚠️ 标签与分类是 frontmatter 里的自由文本：分类写歪会让同一类内容在归档页裂成好几组，
            所以下拉里的候选取自<b>仓内现状</b>，尽量照着选。
          </Paragraph>
        </Space>
      </Card>

      {/* 干跑结果：与真写共用同一个计划，所以「看到的」就是「写下去的」 */}
      <Modal open={planOpen} onCancel={() => setPlanOpen(false)} footer={null} title="干跑检查（还没写任何东西）" width={640}>
        {plan && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Tag color={plan.ready ? "green" : "red"} className="!m-0">{plan.ready ? "可以写入" : "有阻塞项"}</Tag>
              <Text code>{plan.path}</Text>
            </div>
            <div className="text-sm">
              <div>URL：<a href={plan.url} target="_blank" rel="noreferrer">{plan.url}</a></div>
              <div>提交信息：<Text code>{plan.commitMessage}</Text></div>
              <div>状态：{plan.draft ? "草稿（不会构建，线上看不到）" : "已发布（会触发一次构建）"}</div>
              {plan.renamed && <div>改名：<Text code>{plan.oldSlug}</Text> → <Text code>{plan.slug}</Text>（旧文件会一并删除）</div>}
              <div>正文 {plan.chars} 字符</div>
            </div>
            {plan.blockers?.length > 0 && (
              <Alert type="error" showIcon message="必须先解决" description={<ul className="m-0 pl-4">{plan.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>} />
            )}
            {plan.warnings?.length > 0 && (
              <Alert type="warning" showIcon message="提醒（不阻塞）" description={<ul className="m-0 pl-4">{plan.warnings.map((b: string) => <li key={b}>{b}</li>)}</ul>} />
            )}
          </div>
        )}
      </Modal>

      {/* 预览：iframe 指向博客自己的 SSR 页面 —— 与线上文章页同一套渲染 */}
      <Modal
        open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width="92vw" style={{ top: 16 }}
        title={
          <Space>
            <span>预览（博客自己的页面渲染，与线上文章页一致）</span>
            <Button size="small" icon={<RotateCw size={12} />} loading={busy === "preview"} onClick={() => void doPreview()}>按当前内容刷新</Button>
            <Button size="small" icon={<ExternalLink size={12} />} href={previewUrl} target="_blank">新窗口打开</Button>
            <Text type="secondary" className="!text-xs">地址 30 分钟后自动失效</Text>
          </Space>
        }
      >
        {previewUrl
          ? <iframe src={previewUrl} title="文章预览" className="w-full rounded border-0" style={{ height: "76vh" }} />
          : <div className="p-10 text-center text-zinc-400"><FileText className="inline" /> 还没有预览</div>}
      </Modal>
    </AdminPage>
  )
}

/** AI 起草卡片：只负责「生成 → 解析 → 交回编辑器」，自己既不保存也不预览 */
function AiDraftCard({ categories, onUse }: { categories: { value: string; label: string }[]; onUse: (md: string) => void }) {
  const [prompt, setPrompt] = useState("")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [length, setLength] = useState(2500)
  const [persona, setPersona] = useState(PERSONAS[0].value)
  const [custom, setCustom] = useState(false)
  const [customText, setCustomText] = useState("")
  const [busy, setBusy] = useState(false)

  async function gen() {
    if (!prompt.trim()) { toast.warning("先写提示词：想让 AI 写什么？"); return }
    setBusy(true)
    try {
      const r = await postJson("/api/blog/generate", {
        prompt, category, tags, length, persona: custom ? customText : persona,
      })
      onUse(r.markdown || "")
      toast.success("已生成并填入下方字段，请审阅后再保存")
    } catch (e) {
      toast.error(`生成失败：${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  return (
    <Space direction="vertical" className="w-full" size="small">
      <Input.TextArea
        rows={3} placeholder="提示词：想写什么？例如「讲讲 React useEffect 的依赖陷阱与一次线上事故」"
        value={prompt} onChange={(e) => setPrompt(e.target.value)}
      />
      <Space wrap>
        <AutoComplete
          style={{ width: 200 }} placeholder="分类" value={category || undefined}
          onChange={(v) => setCategory(v || "")} options={categories}
          filterOption={(input, opt) => String(opt?.value ?? "").toLowerCase().includes(input.toLowerCase())}
        />
        <Input style={{ width: 240 }} placeholder="标签，逗号分隔（如 React, Hooks）" value={tags} onChange={(e) => setTags(e.target.value)} />
        <Space>
          <Text>字数</Text>
          <InputNumber min={800} max={6000} step={500} style={{ width: 140 }} value={length} onChange={(v) => setLength(v ?? 2500)} />
        </Space>
      </Space>
      <Space wrap>
        <Select style={{ width: 260 }} value={persona} onChange={setPersona} options={PERSONAS} disabled={custom} />
        <Button onClick={() => setCustom((v) => !v)}>{custom ? "用预设人设" : "自定义人设"}</Button>
        {custom && <Input style={{ width: 360 }} placeholder="自定义人设描述" value={customText} onChange={(e) => setCustomText(e.target.value)} />}
        <Button type="primary" icon={<Wand2 size={14} />} loading={busy} onClick={() => void gen()}>生成草稿</Button>
      </Space>
      <Text type="secondary" className="!text-xs">
        生成只调用大模型，<b>不会写博客仓</b>；内容会填进下方编辑器，改完再存草稿或发布。
      </Text>
    </Space>
  )
}
