"use client"

// 编程学习 —— 学习路线页。
//
// 干什么：按语言给出「从入门到精通」的阶段化学习流程 —— 每节课 = 知识讲解（Markdown）
// + 可直接运行的示例代码 + 随堂测试（选择即判、带解析），用答题结果验证学习成果。
//
// 数据结构：track（语言）→ stage（阶段）→ lesson（课时）→ quiz（选择题），
// 整包存 ui_config.learning（见 Java 侧 LearningContentController）。这是后台知识库，
// **不编辑内容时页面是只读的** —— 架子阶段先在页面里读，编辑能力后续再加。
//
// ⚠️ 详情态走 `?track=<code>` 查询参数而**不是子路由**：页面守卫的 pages.includes(pathname)
//    是精确匹配，/learning/xxx 不在路由表里会被判无权限（协作画布踩过同一个坑）。
//
// ⚠️ 「能不能真跑代码」这件事由后端的 runners 能力表描述（只读），页面只负责展示 ——
//    本页不含任何执行器，运行按钮弹出的是该语言的方案说明。

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, Card, Empty, Modal, Spin, Tag, Tooltip } from "antd"
import { ArrowLeft, CircleCheck, CircleDot, Clock, Copy, Play, Users } from "lucide-react"
import { AdminPage } from "@/components/admin"
import { MdPreview } from "@/components/md-editor"
import { toast } from "@/lib/toast"
import {
  LEVEL_META, loadLearning, loadProgress, runnerOf, saveProgress, trackStats,
  type LearningDoc, type Lesson, type QuizItem, type Runner, type Track,
} from "@/lib/learning-content"

export default function LearningPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
      <LearningInner />
    </Suspense>
  )
}

function LearningInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const code = sp.get("track") || ""
  const [doc, setDoc] = useState<LearningDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadLearning()
      .then(setDoc)
      .catch((e: unknown) => toast.error((e as Error)?.message || "加载学习路线失败"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Spin /> <span className="ml-2 text-sm text-zinc-500">正在加载学习路线…</span></div>
  if (!doc || !doc.tracks.length) return <AdminPage title="编程学习"><Empty description="还没有学习内容" /></AdminPage>

  const track = doc.tracks.find((t) => t.code === code)
  if (track) {
    return <TrackView key={track.code} doc={doc} track={track} onBack={() => router.push("/learning")} />
  }
  return <TrackList doc={doc} onOpen={(c) => router.push(`/learning?track=${c}`)} />
}

// ------------------------------------------------------------------ 列表态

/** 运行方案的档位徽标（列表与详情共用） */
function LevelTag({ runner }: { runner?: Runner }) {
  if (!runner) return null
  const meta = LEVEL_META[runner.level] || LEVEL_META.none
  return (
    <Tooltip title={`${runner.name} · ${runner.engine} · ${runner.size}`}>
      <Tag className={`!m-0 !border ${meta.cls}`} bordered>{meta.label}</Tag>
    </Tooltip>
  )
}

function TrackList({ doc, onOpen }: { doc: LearningDoc; onOpen: (code: string) => void }) {
  return (
    <AdminPage
      title="编程学习"
      description="按语言分阶段的学习流程：知识讲解 → 示例代码 → 随堂测试。答题结果会记在本地，用来验证学没学会。"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {doc.tracks.map((t) => {
          const st = trackStats(t)
          const runner = runnerOf(doc, t.runner)
          return (
            <Card key={t.code} size="small" hoverable onClick={() => onOpen(t.code)}
              className="!cursor-pointer transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{t.icon || "📘"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium text-zinc-800 dark:text-zinc-100">{t.name}</span>
                    <LevelTag runner={runner} />
                  </div>
                  <p className="mt-1 mb-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
                    <span>{st.stages} 个阶段</span>
                    <span>{st.lessons} 节课</span>
                    {st.minutes > 0 && <span>约 {st.minutes} 分钟</span>}
                    {st.quiz > 0 && <span>{st.quiz} 道随堂题</span>}
                    {st.lessons === 0 && <span className="text-amber-600 dark:text-amber-400">内容待补</span>}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <RunnerCatalog runners={doc.runners} />
    </AdminPage>
  )
}

/** 运行能力表 —— 直接回答「哪些语言能在网页里跑代码」 */
function RunnerCatalog({ runners }: { runners: Runner[] }) {
  if (!runners.length) return null
  return (
    <Card size="small" title="能在这台服务器上跑代码的几种方式"
      extra={<span className="text-xs text-zinc-400">由后端常量维护，只读</span>}>
      <div className="grid gap-3 md:grid-cols-2">
        {runners.map((r) => {
          const meta = LEVEL_META[r.level] || LEVEL_META.none
          return (
            <div key={r.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.name}</span>
                <Tag className={`!m-0 !border ${meta.cls}`} bordered>{meta.label}</Tag>
              </div>
              <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                {r.engine}{r.size && r.size !== "—" ? ` · ${r.size}` : ""}
              </div>
              <p className="mt-1.5 mb-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{r.note}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ 详情态

function TrackView({ doc, track, onBack }: { doc: LearningDoc; track: Track; onBack: () => void }) {
  const runner = runnerOf(doc, track.runner)
  const flat = useMemo(() => track.stages.flatMap((s) => s.lessons.map((l) => ({ stage: s, lesson: l }))), [track])
  const [lessonId, setLessonId] = useState(flat[0]?.lesson.id || "")
  const [progress, setProgress] = useState<Record<string, { answered: number; correct: number }>>({})

  useEffect(() => { setProgress(loadProgress()) }, [])

  const current = flat.find((f) => f.lesson.id === lessonId)?.lesson
  const st = trackStats(track)

  const record = useCallback((lid: string, answered: number, correct: number) => {
    setProgress((prev) => {
      const old = prev[lid]
      // 只保留最好成绩：重做一遍分数更低不该把已有记录冲掉
      if (old && old.correct >= correct) return prev
      const next = { ...prev, [lid]: { answered, correct } }
      saveProgress(next)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>返回</Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">{track.icon || "📘"}</span>
            <span className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">{track.name}</span>
            <LevelTag runner={runner} />
          </div>
          <p className="mt-0.5 mb-0 text-sm text-zinc-500 dark:text-zinc-400">{track.desc}</p>
        </div>
        <div className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {st.stages} 阶段 · {st.lessons} 课时 · {st.quiz} 题
        </div>
      </div>

      {runner && (
        <Alert
          type={runner.level === "ready" ? "success" : runner.level === "heavy" ? "warning" : "info"}
          showIcon
          message={<span className="text-sm">运行方案：{runner.name}（{runner.engine}{runner.size && runner.size !== "—" ? `，${runner.size}` : ""}）</span>}
          description={<span className="text-xs leading-relaxed">{runner.note}</span>}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* 左：阶段 / 课时大纲 */}
        <Card size="small" title="学习大纲" className="!h-fit lg:sticky lg:top-4">
          {track.stages.map((s) => (
            <div key={s.id} className="mb-3 last:mb-0">
              <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{s.name}</div>
              {s.goal && <div className="mb-1.5 text-xs leading-snug text-zinc-400 dark:text-zinc-500">{s.goal}</div>}
              {s.lessons.length === 0 ? (
                <div className="rounded border border-dashed border-zinc-200 px-2 py-1.5 text-xs text-zinc-400 dark:border-zinc-800">
                  内容待补
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {s.lessons.map((l, i) => {
                    const pr = progress[l.id]
                    const active = l.id === lessonId
                    const done = pr && pr.answered > 0 && pr.correct === l.quiz.length && l.quiz.length > 0
                    return (
                      <li key={l.id}>
                        <button type="button" onClick={() => setLessonId(l.id)}
                          className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            active
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                              : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                          }`}>
                          {done
                            ? <CircleCheck size={13} className="shrink-0 text-emerald-500" />
                            : <CircleDot size={13} className="shrink-0 opacity-40" />}
                          <span className="min-w-0 flex-1 truncate">{i + 1}. {l.title}</span>
                          {pr && pr.answered > 0 && (
                            <span className="shrink-0 text-[10px] text-zinc-400">{pr.correct}/{l.quiz.length}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </Card>

        {/* 右：课时内容 */}
        {current ? (
          <LessonView lesson={current} runner={runner} onRecord={record} />
        ) : (
          <Card size="small"><Empty description="这门语言的内容还在准备中 — 架子已就位，知识点待补" /></Card>
        )}
      </div>
    </div>
  )
}

/** 代码块：等宽 + 复制 + 「运行」按钮（点击说明该语言走什么方案，本页不执行代码） */
function CodeBox({ code, lang, runner }: { code: string; lang: string; runner?: Runner }) {
  const [open, setOpen] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("代码已复制")
    } catch {
      toast.error("复制失败，请手动选中")
    }
  }
  const meta = runner ? (LEVEL_META[runner.level] || LEVEL_META.none) : LEVEL_META.none
  return (
    <div className="relative">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{lang}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="small" type="text" icon={<Copy size={13} />} onClick={copy}>复制</Button>
          <Button size="small" type="text" icon={<Play size={13} />} onClick={() => setOpen(true)}>运行</Button>
        </div>
      </div>
      <pre className="m-0 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100 dark:bg-black/60">
        <code className="whitespace-pre-wrap break-words">{code}</code>
      </pre>

      <Modal open={open} onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>知道了</Button>}
        title={`在这台服务器上运行 ${lang} 代码`} width={560}>
        {runner ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{runner.name}</span>
              <Tag className={`!m-0 !border ${meta.cls}`} bordered>{meta.label}</Tag>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              引擎：{runner.engine}{runner.size && runner.size !== "—" ? ` · 体积：${runner.size}` : ""}
            </div>
            <p className="m-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{runner.note}</p>
            <Alert type="info" showIcon message="运行器尚未接入"
              description={<span className="text-xs">架子已经按这套方案设计好（代码片段都是可直接执行的完整片段），接入运行时后这里就会变成真正的运行结果。</span>} />
          </div>
        ) : (
          <span className="text-sm text-zinc-500">这门语言还没有登记运行方案。</span>
        )}
      </Modal>
    </div>
  )
}

function LessonView({ lesson, runner, onRecord }: {
  lesson: Lesson
  runner?: Runner
  onRecord: (lessonId: string, answered: number, correct: number) => void
}) {
  return (
    <Card size="small">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-base font-medium text-zinc-800 dark:text-zinc-100">{lesson.title}</span>
        <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
          <Clock size={12} /> {lesson.minutes} 分钟
        </span>
      </div>

      <MdPreview value={lesson.content} />

      {lesson.code.trim() && (
        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">示例代码</div>
          <CodeBox code={lesson.code} lang={lesson.lang} runner={runner} />
        </div>
      )}

      {lesson.quiz.length > 0 && (
        <div className="mt-5 border-t border-dashed border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">随堂测试</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{lesson.quiz.length} 题 · 选完立即判定</span>
          </div>
          <Quiz lesson={lesson} onRecord={onRecord} />
        </div>
      )}
    </Card>
  )
}

/** 随堂测试：选完立刻判定并显示解析；统计按「答对题数 / 总题数」记进本地进度 */
function Quiz({ lesson, onRecord }: { lesson: Lesson; onRecord: (id: string, answered: number, correct: number) => void }) {
  const [picked, setPicked] = useState<Record<number, number>>({})

  // 换课时要清空选择（lesson.id 变了就是新的一课）
  useEffect(() => { setPicked({}) }, [lesson.id])

  const total = lesson.quiz.length
  const answeredCount = Object.keys(picked).length
  const correctCount = lesson.quiz.reduce((n, q, i) => (picked[i] === q.answer ? n + 1 : n), 0)

  useEffect(() => {
    if (answeredCount > 0) onRecord(lesson.id, answeredCount, correctCount)
  }, [answeredCount, correctCount, lesson.id, onRecord])

  const pick = (qi: number, oi: number) => {
    setPicked((prev) => (prev[qi] !== undefined ? prev : { ...prev, [qi]: oi }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">
          已答 {answeredCount}/{total}
        </span>
        {answeredCount > 0 && (
          <span className={correctCount === total ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}>
            答对 {correctCount}
          </span>
        )}
        {answeredCount > 0 && answeredCount < total && (
          <Button size="small" type="link" className="!px-0" onClick={() => setPicked({})}>重做</Button>
        )}
      </div>

      {lesson.quiz.map((q: QuizItem, qi: number) => {
        const chosen = picked[qi]
        const locked = chosen !== undefined
        return (
          <div key={qi}>
            <div className="mb-1.5 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <span className="shrink-0 text-zinc-400">{qi + 1}.</span>
              <span>{q.q}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answer
                const isChosen = chosen === oi
                let cls = "border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-indigo-950/30"
                if (locked && isAnswer) {
                  cls = "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                } else if (locked && isChosen) {
                  cls = "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                } else if (locked) {
                  cls = "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
                }
                return (
                  <button key={oi} type="button" disabled={locked} onClick={() => pick(qi, oi)}
                    className={`rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${cls} ${locked ? "cursor-default" : ""}`}>
                    <span className="mr-2 font-mono text-xs opacity-60">{"ABCD"[oi] || oi + 1}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
            {locked && (
              <div className={`mt-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                chosen === q.answer
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300"
              }`}>
                <span className="font-medium">{chosen === q.answer ? "答对了。" : `答错了，正确答案是 ${"ABCD"[q.answer] || q.answer + 1}。`}</span>
                {q.explain}
              </div>
            )}
          </div>
        )
      })}

      {answeredCount === total && (
        <Alert
          type={correctCount === total ? "success" : "warning"}
          showIcon
          message={<span className="flex items-center gap-1.5 text-sm"><Users size={14} />
            {correctCount === total ? "这一课全对，可以进入下一课。" : `答对 ${correctCount}/${total}，建议回头再看一遍讲解。`}
          </span>}
        />
      )}
    </div>
  )
}
