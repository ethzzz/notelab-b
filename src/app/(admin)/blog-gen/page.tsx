"use client"
// 博客管理 → 文章生成：手动输入 / AI 起草，提交到博客仓库（见 notelab-java BlogContentController /api/blog）。
// 默认走「先草稿审核再发布」：draft 默认开，确认发布时再决定是否转正式。
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Card, Tabs, Input, InputNumber, Select, Switch, Button, message, Space, Typography, Spin } from "antd"
import { apiJson, postJson } from "@/lib/api"

const MdEditor = dynamic(() => import("@/components/md-editor"), { ssr: false })

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const PERSONAS = [
  { value: "资深前端工程师，工作十年，一直保持做笔记的习惯", label: "资深前端十年沉淀（默认）" },
  { value: "注重工程化与性能优化的前端工程师", label: "工程化 / 性能导向" },
  { value: "带团队的前端负责人，关注架构与协作", label: "前端负责人视角" },
]

type ManualState = {
  title: string
  slug: string
  category: string
  tags: string
  description: string
  content: string
  draft: boolean
}
type AiState = {
  prompt: string
  category: string
  tags: string
  length: number
  persona: string
  custom: boolean
  customText: string
}

export default function BlogGenPage() {
  const [active, setActive] = useState<"manual" | "ai">("manual")
  const [manual, setManual] = useState<ManualState>({
    title: "", slug: "", category: "", tags: "", description: "", content: "", draft: true,
  })
  const [ai, setAi] = useState<AiState>({
    prompt: "", category: "", tags: "", length: 2500,
    persona: PERSONAS[0].value, custom: false, customText: "",
  })
  const [aiResult, setAiResult] = useState("")
  const [gen, setGen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    apiJson("/api/blog/list").then((r: any) => {
      if (r?.ok && Array.isArray(r.items)) setRecent(r.items.map((x: any) => x.slug))
    }).catch(() => { /* 菜单未授权时不阻塞 */ })
  }, [])

  function patchManual(p: Partial<ManualState>) {
    setManual((m) => ({ ...m, ...p }))
  }
  function patchAi(p: Partial<AiState>) {
    setAi((a) => ({ ...a, ...p }))
  }

  async function submitManual() {
    if (!manual.title.trim()) return message.error("标题必填")
    if (!manual.content.trim()) return message.error("正文必填")
    setSubmitting(true)
    try {
      const r = await postJson("/api/blog/content", {
        title: manual.title, slug: manual.slug, category: manual.category,
        tags: manual.tags, description: manual.description,
        content_md: manual.content, draft: manual.draft,
      })
      message.success(`已写入博客仓库：${r.slug}（${r.draft ? "草稿" : "已发布"}）`)
      patchManual({ title: "", slug: "", category: "", tags: "", description: "", content: "" })
      refreshRecent()
    } catch (e: any) {
      message.error(e?.message || "发布失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function genAi() {
    if (!ai.prompt.trim()) return message.error("提示词必填")
    setGen(true)
    try {
      const r = await postJson("/api/blog/generate", {
        prompt: ai.prompt, category: ai.category, tags: ai.tags,
        persona: ai.custom ? ai.customText : ai.persona, length: ai.length,
      })
      setAiResult(r.markdown || "")
      message.success("AI 草稿已生成，请审阅后发布")
    } catch (e: any) {
      message.error(e?.message || "生成失败")
    } finally {
      setGen(false)
    }
  }

  const [aiDraft, setAiDraft] = useState(true)
  async function publishAi() {
    if (!aiResult.trim()) return message.error("没有可发布的草稿")
    setSubmitting(true)
    try {
      const r = await postJson("/api/blog/content", { raw_markdown: aiResult, draft: aiDraft })
      message.success(`已写入博客仓库：${r.slug}（${r.draft ? "草稿" : "已发布"}）`)
      setAiResult("")
      refreshRecent()
    } catch (e: any) {
      message.error(e?.message || "发布失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshRecent() {
    try {
      const r = await apiJson("/api/blog/list")
      if (r?.ok && Array.isArray(r.items)) setRecent(r.items.map((x: any) => x.slug))
    } catch { /* ignore */ }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <Title level={3} className="!mb-1">博客管理 · 文章生成</Title>
      <Paragraph type="secondary" className="!mt-0">
        手动输入或给提示词交 AI 起草，提交后写入博客仓库（GitHub: ethzzz/blog）。默认先存草稿，确认发布再转正式。
      </Paragraph>

      <Tabs
        activeKey={active}
        onChange={(k) => setActive(k as "manual" | "ai")}
        items={[
          {
            key: "manual",
            label: "手动输入",
            children: (
              <Card>
                <Space direction="vertical" className="w-full" size="middle">
                  <Input addonBefore="标题" placeholder="文章标题"
                    value={manual.title} onChange={(e) => patchManual({ title: e.target.value })} />
                  <Space wrap>
                    <Input addonBefore="slug" placeholder="留空自动生成" style={{ width: 280 }}
                      value={manual.slug} onChange={(e) => patchManual({ slug: e.target.value })} />
                    <Input addonBefore="分类" placeholder="如 前端工程化" style={{ width: 220 }}
                      value={manual.category} onChange={(e) => patchManual({ category: e.target.value })} />
                    <Input addonBefore="标签" placeholder="逗号分隔，如 React, Hooks" style={{ width: 280 }}
                      value={manual.tags} onChange={(e) => patchManual({ tags: e.target.value })} />
                  </Space>
                  <TextArea rows={2} placeholder="描述（description）"
                    value={manual.description} onChange={(e) => patchManual({ description: e.target.value })} />
                  <div className="border rounded">
                    <MdEditor value={manual.content}
                      onChange={(v) => patchManual({ content: v })} />
                  </div>
                  <Space>
                    <Switch checked={manual.draft} onChange={(c) => patchManual({ draft: c })} />
                    <Text>存为草稿（确认发布时再关）</Text>
                    <Button type="primary" loading={submitting} onClick={submitManual}>
                      写入博客仓库
                    </Button>
                  </Space>
                </Space>
              </Card>
            ),
          },
          {
            key: "ai",
            label: "AI 生成",
            children: (
              <Card>
                <Space direction="vertical" className="w-full" size="middle">
                  <TextArea rows={4} placeholder="提示词：想写什么？例如「讲讲 React useEffect 的依赖陷阱与一次线上事故」"
                    value={ai.prompt} onChange={(e) => patchAi({ prompt: e.target.value })} />
                  <Space wrap>
                    <Input addonBefore="分类" placeholder="如 React" style={{ width: 200 }}
                      value={ai.category} onChange={(e) => patchAi({ category: e.target.value })} />
                    <Input addonBefore="标签" placeholder="逗号分隔" style={{ width: 240 }}
                      value={ai.tags} onChange={(e) => patchAi({ tags: e.target.value })} />
                    <Space>
                      <Text>字数</Text>
                      <InputNumber min={800} max={6000} step={500} style={{ width: 140 }}
                        value={ai.length} onChange={(v) => patchAi({ length: v ?? 2500 })} />
                    </Space>
                  </Space>
                  <Space wrap>
                    <Select style={{ width: 240 }} value={ai.persona}
                      onChange={(v) => patchAi({ persona: v })} options={PERSONAS} />
                    <Button onClick={() => patchAi({ custom: !ai.custom })}>
                      {ai.custom ? "用预设人设" : "自定义人设"}
                    </Button>
                  </Space>
                  {ai.custom && (
                    <Input placeholder="自定义人设描述" style={{ width: 480 }}
                      value={ai.customText} onChange={(e) => patchAi({ customText: e.target.value })} />
                  )}
                  <Space>
                    <Button type="primary" loading={gen} onClick={genAi}>生成草稿</Button>
                    {ai.custom && <Text type="secondary">提示：自定义人设会覆盖上方选择</Text>}
                  </Space>

                  {gen && <Spin tip="AI 起草中…"><div style={{ height: 240 }} /></Spin>}
                  {aiResult && !gen && (
                    <>
                      <Text type="secondary">AI 草稿（可在此直接修改后再发布）：</Text>
                      <div className="border rounded">
                        <MdEditor value={aiResult} onChange={setAiResult} />
                      </div>
                      <Space>
                        <Switch checked={aiDraft} onChange={setAiDraft} />
                        <Text>存为草稿（确认发布时再关）</Text>
                        <Button type="primary" loading={submitting} onClick={publishAi}>
                          确认发布到博客仓库
                        </Button>
                      </Space>
                    </>
                  )}
                </Space>
              </Card>
            ),
          },
        ]}
      />

      {recent.length > 0 && (
        <Card className="mt-4" title="最近文章（博客仓库）">
          <div className="flex flex-wrap gap-2">
            {recent.slice(0, 30).map((s) => (
              <Text key={s} code>{s}</Text>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
