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
// ⚠️ 分清两件事：
//    · 「这门语言能不能跑、走什么方案」→ 后端的 runners 能力表（只读，页面只展示）
//    · 「能不能在这个页面上跑」→ lib/code-runner 的 isRunnable（白名单，现在只有 worker 一档：
//      JS/TS，用 Blob Worker 执行）。接了运行器的语言点「运行」是**真跑**；其余仍弹方案说明。

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, Card, Empty, Modal, Spin, Tag } from "antd"
import { ArrowLeft, CircleCheck, CircleDot, Clock, Copy, Play, Users } from "lucide-react"
import { AdminPage } from "@/components/admin"
import { MdPreview } from "@/components/md-editor"
import { toast } from "@/lib/toast"
import { DEFAULT_TIMEOUT_MS, isRunnable, runCode, type RunLog, type RunResult } from "@/lib/code-runner"
import {
  LEVEL_META, lessonStat, loadLearning, loadProgress, markStudied, recordSelection, runnerOf,
  selectionOf, trackCompletion, trackStats,
  type LearningDoc, type Lesson, type ProgressDoc, type QuizItem, type Runner, type Selection, type Track,
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

function TrackList({ doc, onOpen }: { doc: LearningDoc; onOpen: (code: string) => void }) {
  return (
    <AdminPage
      title="编程学习"
      description="按语言分阶段的学习流程：知识讲解 → 示例代码 → 随堂测试。答题结果会记在本地，用来验证学没学会。"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {doc.tracks.map((t) => {
          const st = trackStats(t)
          return (
            <Card key={t.code} size="small" hoverable onClick={() => onOpen(t.code)}
              className="!cursor-pointer transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{t.icon || "📘"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium text-zinc-800 dark:text-zinc-100">{t.name}</span>
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
  // 首屏给空进度、挂载后再读 localStorage：SSR 时没有 window，
  // 写进 useState 初值会造成 hydration 前后不一致。
  const [progress, setProgress] = useState<ProgressDoc>(() => ({ v: 2, d: {}, last: {} }))

  useEffect(() => { setProgress(loadProgress()) }, [])

  const current = flat.find((f) => f.lesson.id === lessonId)?.lesson
  const st = trackStats(track)
  const completion = trackCompletion(progress, track.stages)

  // 作答：以**最后一次输入**为准（进度展示由输入 + 当前内容派生，见 learning-content.ts）
  const record = useCallback((lid: string, sel: Selection) => {
    setProgress((prev) => recordSelection(prev, lid, sel))
  }, [])

  // 记「学到哪一步」：切课时就写一次，下次进来能接着学
  useEffect(() => {
    if (lessonId) setProgress((prev) => markStudied(prev, track.code, lessonId))
  }, [track.code, lessonId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>返回</Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">{track.icon || "📘"}</span>
            <span className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">{track.name}</span>
          </div>
          <p className="mt-0.5 mb-0 text-sm text-zinc-500 dark:text-zinc-400">{track.desc}</p>
        </div>
        <div className="ml-auto text-right text-xs text-zinc-400 dark:text-zinc-500">
          <div>{st.stages} 阶段 · {st.lessons} 课时 · {st.quiz} 题</div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            完成度 <b className="text-zinc-700 dark:text-zinc-200">{Math.round(completion * 100)}%</b>
          </div>
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
                    const pr = lessonStat(l, selectionOf(progress, l.id))
                    const active = l.id === lessonId
                    return (
                      <li key={l.id}>
                        <button type="button" onClick={() => setLessonId(l.id)}
                          className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            active
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                              : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                          }`}>
                          {pr.allDone
                            ? <CircleCheck size={13} className="shrink-0 text-emerald-500" />
                            : <CircleDot size={13} className="shrink-0 opacity-40" />}
                          <span className="min-w-0 flex-1 truncate">{i + 1}. {l.title}</span>
                          {pr.answered > 0 && (
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
          <LessonView lesson={current} runner={runner} selection={selectionOf(progress, current.id)} onRecord={record} />
        ) : (
          <Card size="small"><Empty description="这门语言的内容还在准备中 — 架子已就位，知识点待补" /></Card>
        )}
      </div>
    </div>
  )
}

/** 代码块：等宽 + 复制 + 「运行」按钮（点击说明该语言走什么方案，本页不执行代码） */
/** 运行输出的配色（深色代码区里的浅色文字） */
const LOG_CLS: Record<RunLog["level"], string> = {
  log: "text-zinc-100",
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-rose-400",
}

function CodeBox({ code, lang, runner }: { code: string; lang: string; runner?: Runner }) {
  const [explainOpen, setExplainOpen] = useState(false)
  // 运行面板的 state 放在**这里**而不是面板组件内：Modal 关闭后内容不会销毁，
  // 只有放在外层才能在「每次打开」时重置成课程里的原始代码。
  const [runOpen, setRunOpen] = useState(false)
  const [src, setSrc] = useState(code)
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)

  const canRun = isRunnable(runner?.id)
  const meta = runner ? (LEVEL_META[runner.level] || LEVEL_META.none) : LEVEL_META.none

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("代码已复制")
    } catch {
      toast.error("复制失败，请手动选中")
    }
  }

  const openRunner = () => {
    setSrc(code)
    setResult(null)
    setRunOpen(true)
  }

  const doRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      setResult(await runCode(src, lang))
    } catch (e) {
      setResult({ ok: false, logs: [], error: e instanceof Error ? e.message : String(e), ms: 0, timedOut: false })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="relative">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{lang}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="small" type="text" icon={<Copy size={13} />} onClick={copy}>复制</Button>
          {/* 接了运行器 → 真跑；没接 → 弹方案说明（按钮文案也跟着变，别让人以为点了能跑） */}
          <Button size="small" type="text" icon={<Play size={13} />}
            onClick={() => (canRun ? openRunner() : setExplainOpen(true))}>
            {canRun ? "运行" : "运行方案"}
          </Button>
        </div>
      </div>
      <pre className="m-0 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100 dark:bg-black/60">
        <code className="whitespace-pre">{code}</code>
      </pre>

      {/* ---- 真运行面板（已接运行器的语言） ---- */}
      {canRun && (
        <Modal open={runOpen} onCancel={() => setRunOpen(false)} width={720}
          title={`运行 ${lang} 代码`}
          footer={
            <div className="flex items-center gap-2">
              <span className="mr-auto text-xs text-zinc-400 dark:text-zinc-500">
                {running ? "执行中…" : result ? (result.timedOut ? "已强制中断" : `耗时 ${result.ms} ms`) : ""}
              </span>
              <Button onClick={() => { setSrc(code); setResult(null) }} disabled={running}>重置</Button>
              <Button type="primary" data-run-exec="" icon={<Play size={13} />} loading={running}
                onClick={() => void doRun()}>运行</Button>
            </div>
          }>
          <div className="flex flex-col gap-2">
            {/* 刻意用原生 textarea 而不是代码编辑器组件：这一步要的是「能改一行试试」，
                引一个编辑器（Monaco/CodeMirror）在上面这个体积上不划算 */}
            <textarea value={src} spellCheck={false} data-run-input="" onChange={(e) => setSrc(e.target.value)}
              className="h-52 w-full resize-y rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100 outline-none dark:bg-black/60"
              style={{ tabSize: 2 }} />
            <div data-run-output=""
              className="max-h-56 min-h-[72px] overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed dark:bg-black/60">
              {!result ? (
                <span className="text-zinc-500">改代码试试，点「运行」看输出</span>
              ) : (
                <>
                  {result.logs.map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap break-words ${LOG_CLS[l.level]}`}>{l.text}</div>
                  ))}
                  {result.error && (
                    <div className="whitespace-pre-wrap break-words text-rose-400">{result.error}</div>
                  )}
                  {!result.logs.length && !result.error && (
                    <span className="text-zinc-500">（没有输出 —— 代码里没有 console.log？）</span>
                  )}
                </>
              )}
            </div>
            <p className="m-0 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              代码在独立的 Worker 线程里执行，{Math.round(DEFAULT_TIMEOUT_MS / 1000)} 秒超时强制中断。
              ⚠️ 它<b>不是安全沙箱</b>（同源网络仍可达），本页仅后台登录用户可用。
            </p>
          </div>
        </Modal>
      )}

      {/* ---- 方案说明（还没接运行器的语言） ---- */}
      <Modal open={explainOpen} onCancel={() => setExplainOpen(false)}
        footer={<Button onClick={() => setExplainOpen(false)}>知道了</Button>}
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

/**
 * 课时正文的阅读排版（只作用于本页的 `.learning-doc`）。
 *
 * 不走全局 MD_BODY_CSS：那份样式同时服务笔记 / 练习等页面，
 * 在这里统一放大字号与段距会顺带改变那些页面的密度。
 */
const LEARNING_DOC_CSS = `
.learning-doc .md-body{font-size:15px;line-height:1.9;letter-spacing:.01em}
.learning-doc .md-body p{margin:.85em 0}
.learning-doc .md-body li{margin:.3em 0}
.learning-doc .md-body ul,.learning-doc .md-body ol{margin:.6em 0}
.learning-doc .md-body pre{margin:.9em 0;padding:.9rem 1.1rem;line-height:1.8}
.learning-doc .md-body h2{margin:1.2em 0 .5em}
.learning-doc .md-body h3{margin:1em 0 .4em}
.learning-doc .md-body>:first-child{margin-top:0}
.learning-doc .md-body>:last-child{margin-bottom:0}
.quiz-explain .md-body{font-size:12px;line-height:1.7}
.quiz-explain .md-body p{margin:.35em 0}
.quiz-explain .md-body>:first-child{margin-top:0}
.quiz-explain .md-body>:last-child{margin-bottom:0}
`

function LessonView({ lesson, runner, selection, onRecord }: {
  lesson: Lesson
  runner?: Runner
  /** 该课已保存的作答（每题选中项，null=未答） */
  selection: Selection
  onRecord: (lessonId: string, selection: Selection) => void
}) {
  return (
    <Card size="small">
      <style>{LEARNING_DOC_CSS}</style>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{lesson.title}</span>
        <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Clock size={12} /> {lesson.minutes} 分钟
        </span>
      </div>

      <div className="learning-doc"><MdPreview value={lesson.content} /></div>

      {lesson.code.trim() && (
        <div className="mt-5">
          <div className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">示例代码</div>
          <CodeBox code={lesson.code} lang={lesson.lang} runner={runner} />
        </div>
      )}

      {lesson.quiz.length > 0 && (
        <div className="mt-6 border-t border-dashed border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">随堂测试</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{lesson.quiz.length} 题 · 选完立即判定</span>
          </div>
          <Quiz lesson={lesson} selection={selection} onRecord={onRecord} />
        </div>
      )}
    </Card>
  )
}

/** 随堂测试：选完立刻判定并显示解析；统计按「答对题数 / 总题数」记进本地进度 */
/**
 * 题干 / 选项 / 解析里的两种 inline 标记：`code` 与 **粗体**。
 *
 * <p>⚠️ 不能直接上 {@link MdPreview}：它是**块级**元素（自带段落间距），塞进选项按钮里
 * 会把行高撑坏。所以这里手写最小解析 —— 只认这两种标记，其余原样输出。
 *
 * <p>之所以要做这一步：这三处走的是 JSX 纯文本插值，不写这个的话，
 * 内容里写的反引号和星号会**原样显示**出来（`local` 会连着反引号一起出现）。
 * 而内容是 Markdown 风格写的（讲解部分走 MdPreview 渲染正常），
 * 两处口径不一致会让人以为「哪里写坏了」。
 */
function Inline({ text }: { text: string }) {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        }
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
          return (
            <code key={i} className="rounded bg-black/[0.06] px-1 py-[1px] font-mono text-[0.92em] dark:bg-white/10">
              {p.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function Quiz({ lesson, selection, onRecord }: {
  lesson: Lesson
  selection: Selection
  onRecord: (id: string, selection: Selection) => void
}) {
  // 初始值来自已保存的作答 —— 每次选择都写回 localStorage，
  // 所以刷新 / 切走再回来仍能看到自己选过哪一项（「练习题的输入数据」也是进度的一部分）。
  const [picked, setPicked] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    selection.forEach((v, i) => { if (v !== null && v !== undefined) init[i] = v })
    return init
  })

  // 换课时要重新用新一课的作答初始化（lesson.id 变了就是新的一课）
  useEffect(() => {
    const init: Record<number, number> = {}
    selection.forEach((v, i) => { if (v !== null && v !== undefined) init[i] = v })
    setPicked(init)
  }, [lesson.id, selection])

  const total = lesson.quiz.length
  const answeredCount = Object.keys(picked).length
  const correctCount = lesson.quiz.reduce((n, q, i) => (picked[i] === q.answer ? n + 1 : n), 0)

  const toSelection = (p: Record<number, number>): Selection => {
    const out: Selection = []
    for (let i = 0; i < total; i++) out.push(p[i] ?? null)
    return out
  }

  const pick = (qi: number, oi: number) => {
    setPicked((prev) => {
      if (prev[qi] !== undefined) return prev // 一题只判一次
      const next = { ...prev, [qi]: oi }
      onRecord(lesson.id, toSelection(next)) // 立刻落盘
      return next
    })
  }

  const redo = () => {
    setPicked({})
    onRecord(lesson.id, []) // 清空也要落盘，否则刷新一遍又回来了
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
        {answeredCount > 0 && (
          <Button size="small" type="link" className="!px-0" onClick={redo}>重做</Button>
        )}
      </div>

      {lesson.quiz.map((q: QuizItem, qi: number) => {
        const chosen = picked[qi]
        const locked = chosen !== undefined
        return (
          <div key={qi}>
            <div className="mb-1.5 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <span className="shrink-0 text-zinc-400">{qi + 1}.</span>
              {/* 题干含围栏代码块（多数题目都是），必须块级渲染；外层给 min-w-0 才能正常收缩 */}
              <div className="min-w-0 flex-1"><MdPreview value={q.q} /></div>
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
                    <Inline text={opt} />
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
                <div className="font-medium">{chosen === q.answer ? "答对了。" : `答错了，正确答案是 ${"ABCD"[q.answer] || q.answer + 1}。`}</div>
                <div className="quiz-explain mt-1"><MdPreview value={q.explain} /></div>
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
