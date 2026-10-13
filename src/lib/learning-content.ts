// 编程学习 —— 数据层。
//
// 分层：语言（track）→ 阶段（stage）→ 课时（lesson）→ 随堂测试题（quiz）。
// 后端整包存 ui_config.learning 单键（见 LearningContentController），两个接口：GET / POST。
//
// ⚠️ runners（运行能力表）是**只读**的：它由 Java 侧 LearningSeed.RUNNERS 维护，
//    提交时不要带上（带了也会被后端白名单丢掉）。它描述「这门语言能不能在浏览器里真跑」。
import { apiJson, postJson } from "./api"

export type QuizItem = {
  q: string
  options: string[]
  /** 正确选项的**下标**（0 起） */
  answer: number
  explain: string
}

export type Lesson = {
  id: string
  title: string
  /** 预计学习时长（分钟） */
  minutes: number
  /** 知识讲解，Markdown */
  content: string
  /** 示例代码（完整可运行片段） */
  code: string
  /** 代码语言（给运行器与高亮用） */
  lang: string
  quiz: QuizItem[]
}

export type Stage = {
  id: string
  name: string
  goal: string
  lessons: Lesson[]
}

export type Track = {
  code: string
  name: string
  icon: string
  desc: string
  /** 运行方案 id，指向 Runner.id */
  runner: string
  stages: Stage[]
}

/** 运行方案能力：这门语言在浏览器里能不能真跑、走什么方案、代价是什么 */
export type Runner = {
  id: string
  name: string
  /** ready=浏览器内可跑 / heavy=能跑但代价大 / server=必须后端沙箱 / none=只能讲解 */
  level: "ready" | "heavy" | "server" | "none"
  engine: string
  size: string
  note: string
}

export type LearningDoc = {
  runners: Runner[]
  tracks: Track[]
}

export async function loadLearning(): Promise<LearningDoc> {
  const j = await apiJson<LearningDoc>("/api/learning")
  return { runners: j.runners || [], tracks: j.tracks || [] }
}

/** 保存整包 tracks（runners 是只读的，不提交） */
export async function saveLearning(tracks: Track[]): Promise<{ tracks?: number; lessons?: number }> {
  return postJson("/api/learning", { tracks })
}

export function runnerOf(doc: LearningDoc, id: string): Runner | undefined {
  return doc.runners.find((r) => r.id === id)
}

/** 语言的能力档位 → 展示用的文字与配色（页面多处共用，改配色只改这一处） */
export const LEVEL_META: Record<Runner["level"], { label: string; cls: string; hint: string }> = {
  ready: {
    label: "浏览器内可跑",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    hint: "自托管 + 离线可用，代码改完立刻能跑。",
  },
  heavy: {
    label: "能跑但代价大",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    hint: "方案可行，但要接受体积或外部依赖的代价。",
  },
  server: {
    label: "需要后端沙箱",
    cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    hint: "浏览器里没有实用方案，要真跑只能上服务器容器。",
  },
  none: {
    label: "暂不执行",
    cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    hint: "只做知识讲解与随堂测试。",
  },
}

export function trackStats(t: Track) {
  let lessons = 0
  let minutes = 0
  let quiz = 0
  for (const s of t.stages) {
    lessons += s.lessons.length
    for (const l of s.lessons) {
      minutes += l.minutes || 0
      quiz += l.quiz.length
    }
  }
  return { stages: t.stages.length, lessons, minutes, quiz }
}

// ---------------- 学习进度（本地） ----------------
// ⚠️ 与 C 端（notelab-c 的 lib/learn-progress）**用同一套 schema**，两端行为保持一致：
//    存的是「每道题选了什么」这份**原始输入** + 「学到哪一步」，
//    「答对几题 / 完成度」全部由它 + **当前内容**现算 —— 所以以后加课、加题、改答案都不用迁移。
//    key 不同是有意的：B 端与 C 端是两个页面，各记各的。
//
// 结构：{ v:2, d: { "js-01": [2, null, 0] }, last: { "javascript": "js-02" } }
//   d    ：课时 id → 每题选中项（null = 未作答；末尾的 null 会被裁掉，不占空间）
//   last ：语言 code → 最近学到的课时 id（续学位置）

const PROGRESS_KEY = "notelab-b.learning.progress"
const PROGRESS_VERSION = 2
const MAX_OPTION = 20

/** 某节课的作答输入：每题的选中项下标，null = 未作答 */
export type Selection = (number | null)[]

export interface ProgressDoc {
  v: number
  d: Record<string, Selection>
  last: Record<string, string>
}

function emptyProgress(): ProgressDoc {
  return { v: PROGRESS_VERSION, d: {}, last: {} }
}

/** 裁掉末尾的「未作答」；中间的空洞保留（位置必须与题序对齐） */
function trimSel(sel: Selection): Selection {
  let end = sel.length
  while (end > 0 && sel[end - 1] === null) end--
  return sel.slice(0, end)
}

function toOption(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(x)
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  return i >= 0 && i <= MAX_OPTION ? i : null
}

/**
 * 读进度。
 *
 * ⚠️ **版本不符就整份丢弃**：v1 存的是 `[答对, 已答]` 计数，与 v2 的「每题选中项」
 * 是不同语义 —— `[1, 0]` 在 v1 是「答对 1 / 已答 0」，在 v2 会被读成「第 1 题选 B、
 * 第 2 题选 A」。硬迁移会张冠李戴，而 v1 的计数根本无法反推用户选了什么，只能丢弃。
 * 脏数据一律退化成空进度，绝不让它把页面搞崩。
 */
export function loadProgress(): ProgressDoc {
  if (typeof window === "undefined") return emptyProgress()
  try {
    const raw = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null") as unknown
    if (!raw || typeof raw !== "object") return emptyProgress()
    const o = raw as { v?: unknown; d?: unknown; last?: unknown }
    if (Number(o.v) !== PROGRESS_VERSION) return emptyProgress()

    const doc = emptyProgress()
    if (o.d && typeof o.d === "object") {
      for (const [id, val] of Object.entries(o.d as Record<string, unknown>)) {
        if (!id || !Array.isArray(val)) continue
        const sel = trimSel(val.map(toOption))
        if (sel.some((x) => x !== null)) doc.d[id] = sel
      }
    }
    if (o.last && typeof o.last === "object") {
      for (const [code, id] of Object.entries(o.last as Record<string, unknown>)) {
        if (code && typeof id === "string" && id) doc.last[code] = id
      }
    }
    return doc
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(doc: ProgressDoc) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(doc))
  } catch {
    /* 隐私模式 / 配额满：进度记不住不影响学习，静默即可 */
  }
}

/** 某节课的原始作答输入（没答过返回空数组） */
export function selectionOf(doc: ProgressDoc, lessonId: string): Selection {
  return doc.d[lessonId] ?? []
}

/** 记一次作答（**以最后一次输入为准**），返回新文档 */
export function recordSelection(doc: ProgressDoc, lessonId: string, sel: Selection): ProgressDoc {
  const next: ProgressDoc = { ...doc, d: { ...doc.d }, last: { ...doc.last } }
  const trimmed = trimSel(sel)
  if (trimmed.some((x) => x !== null)) next.d[lessonId] = trimmed
  else delete next.d[lessonId]
  saveProgress(next)
  return next
}

/** 记「学到哪一步」（打开某节课时调用） */
export function markStudied(doc: ProgressDoc, trackCode: string, lessonId: string): ProgressDoc {
  if (doc.last[trackCode] === lessonId) return doc
  const next: ProgressDoc = { ...doc, d: { ...doc.d }, last: { ...doc.last, [trackCode]: lessonId } }
  saveProgress(next)
  return next
}

/** 一节课的统计（由**输入 + 当前内容**现算：改了正确答案，对错自动跟着变） */
export function lessonStat(lesson: Lesson, sel: Selection) {
  const total = lesson.quiz.length
  let answered = 0
  let correct = 0
  for (let i = 0; i < total; i++) {
    const pick = sel[i]
    if (pick === null || pick === undefined) continue
    answered++
    if (pick === lesson.quiz[i].answer) correct++
  }
  return { answered, correct, total, allDone: total > 0 && answered === total }
}

/**
 * 整门语言的完成度 0..1：**各节课完成度等权平均**。
 * 入参是当前内容的 stages，所以新加的课自动进分母、删掉的课不留幽灵进度。
 */
export function trackCompletion(doc: ProgressDoc, stages: Stage[]): number {
  let sum = 0
  let n = 0
  for (const s of stages) {
    for (const l of s.lessons) {
      const st = lessonStat(l, selectionOf(doc, l.id))
      sum += st.total > 0 ? st.answered / st.total : 0
      n++
    }
  }
  return n > 0 ? sum / n : 0
}
