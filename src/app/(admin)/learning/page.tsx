"use client"

// 编程学习 —— 文档式课程区（课程首页 + 课时阅读）。
//
// 结构：track（语言）→ stage（阶段）→ lesson（课时）→ quiz（选择题），
// 整包存 ui_config.learning（见 Java 侧 LearningContentController），本页只读。
//
// 交互约定：
//   · 详情态走 `?track=<code>&lesson=<id>` 查询参数而**不是子路由** ——
//     页面守卫的 pages.includes(pathname) 是精确匹配，/learning/xxx 不在路由表里会被判无权限。
//   · URL 里没带 lesson（或 id 失效）时自动补成「上次学到的那节 / 第一节」，
//     保证每节课都有可分享、可后退的地址。
//   · 「能不能真跑」由 lib/code-runner 的 isRunnable 白名单决定（现在只有 JS/TS 的 Worker 一档）；
//     其余语言的「运行方案」只解释方案，不执行。

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Empty, Spin, Tag } from "antd"
import { CircleCheck, CircleDot, Clock } from "lucide-react"
import { DocCode, DocMarkdown, DocPager, DocShell } from "@/components/doc"
import { toast } from "@/lib/toast"
import {
  LEVEL_META, flattenLessons, lessonNeighbors, lessonStat, loadLearning, loadProgress, loadRecent,
  markStudied, recordSelection, runnerOf, saveRecent, selectionOf, trackCompletion, trackStats,
  type LearningDoc, type Lesson, type LessonRef, type ProgressDoc, type QuizItem, type RecentSpot,
  type Runner, type Selection, type Stage, type Track,
} from "@/lib/learning-content"

export default function LearningPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
      <LearningInner />
    </Suspense>
  )
}

function LearningInner() {
  const sp = useSearchParams()
  const trackCode = sp.get("track") || ""
  const lessonParam = sp.get("lesson") || ""

  const [doc, setDoc] = useState<LearningDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  // 首屏给空进度、挂载后再读 localStorage：SSR 没有 window，
  // 写进 useState 初值会造成 hydration 前后不一致。
  const [progress, setProgress] = useState<ProgressDoc>(() => ({ v: 2, d: {}, last: {} }))
  const [recent, setRecent] = useState<RecentSpot | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setProgress(loadProgress())
    setRecent(loadRecent())
    setReady(true)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError("")
    void loadLearning()
      .then(setDoc)
      .catch((e: unknown) => setError((e as Error)?.message || "加载学习路线失败"))
      .finally(() => setLoading(false))
  }, [reload])

  /** 打开课时：记「学到哪」+ 记「最近一次打开」（两个 key 分开存，见 learning-content.ts） */
  const handleVisit = useCallback((track: string, lesson: string) => {
    setProgress((prev) => markStudied(prev, track, lesson))
    saveRecent(track, lesson)
    setRecent({ track, lesson })
  }, [])

  const record = useCallback((lessonId: string, sel: Selection) => {
    setProgress((prev) => recordSelection(prev, lessonId, sel))
  }, [])

  if (loading || !ready) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Spin /> <span>正在加载学习路线…</span>
      </div>
    )
  }

  if (error) {
    return (
      <Empty description={error}>
        <Button onClick={() => setReload((n) => n + 1)}>重新加载</Button>
      </Empty>
    )
  }

  if (!doc || !doc.tracks.length) {
    return <Empty description="还没有学习内容" />
  }

  const track = doc.tracks.find((t) => t.code === trackCode)
  if (track) {
    return (
      <TrackReader
        key={track.code}
        doc={doc}
        track={track}
        lessonParam={lessonParam}
        progress={progress}
        onVisit={handleVisit}
        onRecord={record}
      />
    )
  }

  return <LearningHome doc={doc} progress={progress} recent={recent} onVisit={handleVisit} />
}

// ------------------------------------------------------------------ 课程首页

function LearningHome({
  doc,
  progress,
  recent,
  onVisit,
}: {
  doc: LearningDoc
  progress: ProgressDoc
  recent: RecentSpot | null
  onVisit: (track: string, lesson: string) => void
}) {
  const router = useRouter()

  const totals = useMemo(() => {
    let lessons = 0
    let minutes = 0
    let quiz = 0
    for (const t of doc.tracks) {
      const st = trackStats(t)
      lessons += st.lessons
      minutes += st.minutes
      quiz += st.quiz
    }
    return { lessons, minutes, quiz }
  }, [doc.tracks])

  // 「继续学习」：最近打开过、且内容还在的课时。内容被删了就安静地不显示。
  const resume = useMemo(() => {
    if (!recent) return null
    const track = doc.tracks.find((t) => t.code === recent.track)
    if (!track) return null
    const ref = flattenLessons(track).find((r) => r.lesson.id === recent.lesson)
    if (!ref) return null
    return { track, ref }
  }, [doc.tracks, recent])

  const openLesson = (trackCode: string, lessonId: string) => {
    onVisit(trackCode, lessonId)
    router.push(`/learning?track=${encodeURIComponent(trackCode)}&lesson=${encodeURIComponent(lessonId)}`)
  }

  const nav = (
    <>
      <div className="doc-nav-title">课程目录</div>
      <div className="doc-nav-section">
        <div className="doc-nav-heading">全部路线</div>
        <div className="doc-nav-list">
          {doc.tracks.map((t) => (
            <button key={t.code} type="button" className="doc-nav-item is-flat" onClick={() => router.push(`/learning?track=${encodeURIComponent(t.code)}`)}>
              <span className="doc-nav-icon">{t.icon || "📘"}</span>
              <span className="doc-nav-text">{t.name}</span>
              <span className="doc-nav-meta">{Math.round(trackCompletion(progress, t.stages) * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <DocShell aside={nav} asideTitle="课程目录">
      <header className="doc-hero">
        <div className="doc-kicker">编程学习 · 课程区</div>
        <h1 className="doc-hero-title">按路线学，学完能上手写</h1>
        <p className="doc-hero-desc">
          每门语言按阶段拆成课时：先读知识讲解，再看可直接运行的示例代码，最后用随堂测试验证。
          进度只记在这台浏览器上，换设备不会串。
        </p>
        <div className="doc-hero-meta">
          <span>{doc.tracks.length} 门路线</span>
          <span>{totals.lessons} 节课</span>
          {totals.quiz > 0 && <span>{totals.quiz} 道随堂题</span>}
          {totals.minutes > 0 && <span>约 {Math.round(totals.minutes / 60)} 小时</span>}
        </div>
      </header>

      {resume && (
        <button
          type="button"
          className="doc-continue"
          onClick={() => openLesson(resume.track.code, resume.ref.lesson.id)}
        >
          <span className="doc-continue-icon">{resume.track.icon || "📘"}</span>
          <span className="doc-continue-main">
            <span className="doc-continue-kicker">继续学习</span>
            <span className="doc-continue-title">{resume.track.name} · {resume.ref.lesson.title}</span>
            <span className="doc-continue-sub">第 {resume.ref.no} 课 · {resume.ref.stage.name}</span>
          </span>
          <span className="doc-continue-go">继续 →</span>
        </button>
      )}

      <section className="doc-section">
        <div className="doc-section-head">
          <h2 className="doc-section-title">全部路线</h2>
          <span className="doc-section-count">{doc.tracks.length} 门</span>
          <span className="doc-section-note">点开一门课，从上次学到的地方接着走</span>
        </div>
        <div className="doc-track-list">
          {doc.tracks.map((t) => {
            const st = trackStats(t)
            const pct = Math.round(trackCompletion(progress, t.stages) * 100)
            return (
              <button key={t.code} type="button" className="doc-track-row" onClick={() => router.push(`/learning?track=${encodeURIComponent(t.code)}`)}>
                <span className="doc-track-icon">{t.icon || "📘"}</span>
                <span className="doc-track-main">
                  <span className="doc-track-name">{t.name}</span>
                  <span className="doc-track-desc">{t.desc}</span>
                  <span className="doc-track-meta">
                    {st.stages} 个阶段 · {st.lessons} 节课
                    {st.minutes > 0 ? ` · 约 ${st.minutes} 分钟` : ""}
                    {st.quiz > 0 ? ` · ${st.quiz} 题` : ""}
                    {st.lessons === 0 ? " · 内容待补" : ""}
                  </span>
                </span>
                <span className="doc-track-progress">
                  <span className="doc-track-pct">{pct}%</span>
                  <span className="doc-bar"><span className="doc-bar-fill" style={{ width: `${pct}%` }} /></span>
                </span>
                <span className="doc-track-arrow">→</span>
              </button>
            )
          })}
        </div>
      </section>

      <RunnerCatalog runners={doc.runners} />
    </DocShell>
  )
}

/** 运行能力表 —— 直接回答「哪些语言能在网页里跑代码」 */
function RunnerCatalog({ runners }: { runners: Runner[] }) {
  if (!runners.length) return null
  return (
    <section className="doc-section">
      <div className="doc-section-head">
        <h2 className="doc-section-title">在浏览器里跑代码</h2>
        <span className="doc-section-note">能力表由后端维护，只读</span>
      </div>
      <div className="doc-runners">
        {runners.map((r) => {
          const meta = LEVEL_META[r.level] || LEVEL_META.none
          return (
            <div key={r.id} className="doc-runner">
              <div className="doc-runner-head">
                <span className="doc-runner-name">{r.name}</span>
                <Tag className={`!m-0 !border ${meta.cls}`} bordered>{meta.label}</Tag>
              </div>
              <div className="doc-runner-engine">{r.engine}{r.size && r.size !== "—" ? ` · ${r.size}` : ""}</div>
              <p className="doc-runner-note">{r.note}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ 课时阅读

function TrackReader({
  doc,
  track,
  lessonParam,
  progress,
  onVisit,
  onRecord,
}: {
  doc: LearningDoc
  track: Track
  lessonParam: string
  progress: ProgressDoc
  onVisit: (track: string, lesson: string) => void
  onRecord: (lessonId: string, selection: Selection) => void
}) {
  const router = useRouter()
  const runner = runnerOf(doc, track.runner)

  const flat = useMemo(() => flattenLessons(track), [track])
  const refById = useMemo(() => new Map(flat.map((r) => [r.lesson.id, r])), [flat])

  const valid = refById.has(lessonParam)
  // URL 没带 / 带错时：优先上次学到的那节，其次第一节
  const lastId = progress.last[track.code]
  const lessonId = valid ? lessonParam : refById.has(lastId) ? lastId : flat[0]?.lesson.id || ""
  const current = lessonId ? refById.get(lessonId) : undefined

  const goLesson = useCallback(
    (id: string) => {
      router.push(`/learning?track=${encodeURIComponent(track.code)}&lesson=${encodeURIComponent(id)}`)
    },
    [router, track.code],
  )

  // 补全 URL：保证每节课都有可直接分享的地址，刷新 / 后退都落在同一节
  useEffect(() => {
    if (!current) return
    if (valid) return
    router.replace(`/learning?track=${encodeURIComponent(track.code)}&lesson=${encodeURIComponent(current.lesson.id)}`)
  }, [current, valid, router, track.code])

  // 打开课时 = 续学位置（state 在父层，返回首页时「继续学习」立即反映）
  useEffect(() => {
    if (current) onVisit(track.code, current.lesson.id)
  }, [current, onVisit, track.code])

  // 切课回顶部（浏览器默认保留滚动位置，读下一课时很别扭）
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [lessonId])

  const trackPct = Math.round(trackCompletion(progress, track.stages) * 100)

  const nav = (
    <>
      <div className="doc-nav-title">课程目录</div>
      <div className="doc-nav-section">
        <div className="doc-nav-heading">全部路线</div>
        <div className="doc-nav-list">
          {doc.tracks.map((t) => (
            <button
              key={t.code}
              type="button"
              className={`doc-nav-item is-flat${t.code === track.code ? " is-active" : ""}`}
              onClick={() => t.code !== track.code && router.push(`/learning?track=${encodeURIComponent(t.code)}`)}
            >
              <span className="doc-nav-icon">{t.icon || "📘"}</span>
              <span className="doc-nav-text">{t.name}</span>
              <span className="doc-nav-meta">{Math.round(trackCompletion(progress, t.stages) * 100)}%</span>
            </button>
          ))}
        </div>
      </div>

      <div className="doc-nav-section">
        {track.stages.map((stage) => (
          <div key={stage.id} className="mb-3 last:mb-0">
            <div className="doc-nav-stage">{stage.name}</div>
            {stage.lessons.length === 0 ? (
              <div className="doc-nav-empty">内容待补</div>
            ) : (
              <div className="doc-nav-list">
                {stage.lessons.map((l) => {
                  const ref = refById.get(l.id)
                  const stat = lessonStat(l, selectionOf(progress, l.id))
                  const active = l.id === lessonId
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={`doc-nav-item is-sub${active ? " is-active" : ""}`}
                      onClick={() => goLesson(l.id)}
                      title={l.title}
                    >
                      <span className="doc-nav-num">{ref?.no ?? "·"}</span>
                      <span className="doc-nav-text">{l.title}</span>
                      {stat.allDone
                        ? <CircleCheck size={12} className="shrink-0 text-emerald-500" />
                        : stat.answered > 0
                          ? <span className="doc-nav-meta">{stat.correct}/{stat.total}</span>
                          : <CircleDot size={11} className="shrink-0 opacity-30" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="doc-nav-item is-flat" onClick={() => router.push("/learning")}>
        <span className="doc-nav-icon">←</span>
        <span className="doc-nav-text">返回课程首页</span>
      </button>
    </>
  )

  return (
    <DocShell aside={nav} asideTitle="课程目录">
      {!current ? (
        <Empty description="这门路线的内容还在准备中 — 架子已就位，知识点待补" />
      ) : (
        <LessonArticle
          track={track}
          stage={current.stage}
          lesson={current.lesson}
          no={current.no}
          total={flat.length}
          progress={progress}
          runner={runner}
          trackPct={trackPct}
          onRecord={onRecord}
          prev={flat[current.no - 2]}
          next={flat[current.no]}
          onGo={goLesson}
        />
      )}
    </DocShell>
  )
}

function LessonArticle({
  track,
  stage,
  lesson,
  no,
  total,
  progress,
  runner,
  trackPct,
  onRecord,
  prev,
  next,
  onGo,
}: {
  track: Track
  stage: Stage
  lesson: Lesson
  no: number
  total: number
  progress: ProgressDoc
  runner?: Runner
  trackPct: number
  onRecord: (lessonId: string, selection: Selection) => void
  prev?: LessonRef
  next?: LessonRef
  onGo: (id: string) => void
}) {
  const selection = selectionOf(progress, lesson.id)
  const stat = lessonStat(lesson, selection)
  const runnerMeta = runner ? LEVEL_META[runner.level] || LEVEL_META.none : null

  return (
    <article>
      <header className="doc-article-head">
        <div className="doc-kicker">{track.name} · {stage.name}</div>
        <h1 className="doc-article-title">{lesson.title}</h1>
        <div className="doc-article-meta">
          <span className="doc-chip">第 {no} / {total} 课</span>
          <span className="doc-chip"><Clock size={12} /> {lesson.minutes} 分钟</span>
          {lesson.quiz.length > 0 && <span className="doc-chip">{lesson.quiz.length} 道随堂题</span>}
          {stat.allDone && <span className="doc-chip is-ok"><CircleCheck size={12} /> 已完成</span>}
          <span className="doc-chip">路线完成度 {trackPct}%</span>
        </div>
      </header>

      <DocMarkdown value={lesson.content} />

      {lesson.code.trim() && (
        <section className="doc-lesson-section">
          <h2 className="doc-lesson-section-title">
            示例代码
            {runnerMeta && (
              <span className="doc-section-note" style={{ marginLeft: 0 }}>
                {runnerMeta.label}{runner?.id === "worker" ? " · 可直接运行" : ""}
              </span>
            )}
          </h2>
          <DocCode code={lesson.code} lang={lesson.lang} runner={runner} />
        </section>
      )}

      {lesson.quiz.length > 0 && (
        <section className="doc-quiz">
          <div className="doc-quiz-head">
            <span className="doc-quiz-title">随堂测试</span>
            <span>{lesson.quiz.length} 题 · 选完立即判定</span>
          </div>
          <Quiz lesson={lesson} selection={selection} onRecord={onRecord} />
        </section>
      )}

      <DocPager
        prev={prev ? { label: "上一课", title: `${prev.no}. ${prev.lesson.title}`, onClick: () => onGo(prev.lesson.id) } : undefined}
        next={next ? { label: "下一课", title: `${next.no}. ${next.lesson.title}`, onClick: () => onGo(next.lesson.id) } : undefined}
      />
    </article>
  )
}

/** 题干 / 选项里的两种 inline 标记：`code` 与 **粗体**（块级内容走 DocMarkdown） */
function Inline({ text }: { text: string }) {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        }
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
          return <code key={i} className="rounded bg-black/[0.06] px-1 py-[1px] font-mono text-[0.92em] dark:bg-white/10">{p.slice(1, -1)}</code>
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
  const [picked, setPicked] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    selection.forEach((v, i) => { if (v !== null && v !== undefined) init[i] = v })
    return init
  })

  // 换课时用新一课的作答重新初始化
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
      onRecord(lesson.id, toSelection(next))
      return next
    })
  }

  const redo = () => {
    setPicked({})
    onRecord(lesson.id, [])
  }

  return (
    <>
      <div className="doc-quiz-head">
        <span>已答 {answeredCount}/{total}</span>
        {answeredCount > 0 && <span>答对 {correctCount}</span>}
        {answeredCount > 0 && (
          <Button size="small" type="link" className="!px-0" onClick={redo}>重做</Button>
        )}
      </div>

      <div className="doc-quiz-list">
        {lesson.quiz.map((q: QuizItem, qi: number) => {
          const chosen = picked[qi]
          const locked = chosen !== undefined
          return (
            <div key={qi}>
              <div className="doc-quiz-q">
                <span className="doc-quiz-no">{qi + 1}.</span>
                <div className="min-w-0 flex-1"><DocMarkdown value={q.q} /></div>
              </div>
              <div className="doc-quiz-options">
                {q.options.map((opt, oi) => {
                  const isAnswer = oi === q.answer
                  const isChosen = chosen === oi
                  let cls = "doc-option"
                  if (locked && isAnswer) cls += " is-right"
                  else if (locked && isChosen) cls += " is-wrong"
                  else if (locked) cls += " is-muted"
                  return (
                    <button key={oi} type="button" className={cls} disabled={locked} onClick={() => pick(qi, oi)}>
                      <span className="doc-option-key">{"ABCD"[oi] || oi + 1}</span>
                      <Inline text={opt} />
                    </button>
                  )
                })}
              </div>
              {locked && (
                <div className={`doc-quiz-explain${chosen === q.answer ? " is-right" : ""}`}>
                  <div className="doc-quiz-explain-title">
                    {chosen === q.answer ? "答对了。" : `答错了，正确答案是 ${"ABCD"[q.answer] || q.answer + 1}。`}
                  </div>
                  <DocMarkdown value={q.explain} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {answeredCount === total && (
        <div className={`doc-quiz-summary${correctCount === total ? " is-ok" : ""}`} style={{ marginTop: 18 }}>
          {correctCount === total
            ? "这一课全对，可以进入下一课。"
            : `答对 ${correctCount}/${total}，建议回头再看一遍讲解。`}
        </div>
      )}
    </>
  )
}
