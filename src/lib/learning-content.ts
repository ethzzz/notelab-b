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
// 只记「每节课答对几题 / 共答了几题」，够用来验证学习成果。放 localStorage：
// 这是个人学习记录，没必要上后台 —— 换浏览器就没了，可以接受。

const PROGRESS_KEY = "notelab-b.learning.progress"

export type LessonProgress = { answered: number; correct: number }
export type ProgressMap = Record<string, LessonProgress>

export function loadProgress(): ProgressMap {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}") as ProgressMap
  } catch {
    return {}
  }
}

export function saveProgress(p: ProgressMap) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
  } catch {
    /* 隐私模式 / 配额满：进度记不住不影响学习，静默即可 */
  }
}
