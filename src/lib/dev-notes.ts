// 项目实践 · 项目开发总结：整包存取 ui_config.dev_notes（POST /api/dev-notes）。
//
// ⚠️ 后端是手工白名单 + 整包覆盖写：提交时必须带上**全部**项目，漏一个就等于删了它。
// 所以页面上任何一次保存都是提交 state 里的整份文档，不做增量。
import { apiJson, postJson } from "./api"

/** 条目性质：阻断 / 缺陷 / 坑 / 备忘 */
export type Severity = "blocker" | "bug" | "pitfall" | "note"

export const SEVERITIES: Severity[] = ["blocker", "bug", "pitfall", "note"]

export const SEVERITY_LABEL: Record<Severity, string> = {
  blocker: "阻断", bug: "缺陷", pitfall: "坑", note: "备忘",
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  blocker: "red", bug: "orange", pitfall: "gold", note: "blue",
}

/** 一条技术难点记录 */
export interface DevEntry {
  id: string
  /** 一句话说清是什么难点（会作为列表标题） */
  title: string
  /** 所属阶段 / 模块，如「W1 · B 端配置页」 */
  stage: string
  severity: Severity
  /** 现象：报错原文 / 表现（怎么发现的） */
  symptom: string
  /** 原因：为什么会这样 */
  cause: string
  /** 解决方案：怎么修 / 怎么绕 */
  solution: string
  /** 相关代码片段（可执行的那种，别贴伪码） */
  code: string
  tags: string[]
  date: string
}

/** 一个项目下的一组记录 */
export interface DevProject {
  code: string
  name: string
  desc: string
  entries: DevEntry[]
}

export interface DevNotesDoc {
  projects: DevProject[]
}

export const toSeverity = (v: unknown): Severity =>
  SEVERITIES.includes(v as Severity) ? (v as Severity) : "pitfall"

const str = (v: unknown, dft = "") => (typeof v === "string" ? v : dft)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : []

/** 本地日期 YYYY-MM-DD（用本地时区，别用 toISOString——那是 UTC，夜里会差一天） */
export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 唯一 id（新建条目/项目用），与后端 id 规则无关，只要项目内唯一即可 */
export const uid36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)

export function normalizeEntry(raw: any, fallbackId: string): DevEntry | null {
  if (!raw || typeof raw !== "object") return null
  const title = str(raw.title).trim()
  if (!title) return null
  return {
    id: str(raw.id).trim() || fallbackId,
    title,
    stage: str(raw.stage),
    severity: toSeverity(raw.severity),
    symptom: str(raw.symptom),
    cause: str(raw.cause),
    solution: str(raw.solution),
    code: str(raw.code),
    tags: strArr(raw.tags),
    date: str(raw.date, today()),
  }
}

export function normalizeProject(raw: any): DevProject | null {
  if (!raw || typeof raw !== "object") return null
  const code = str(raw.code).trim()
  const name = str(raw.name).trim()
  if (!code || !name) return null
  const entries: DevEntry[] = []
  const seen = new Set<string>()
  for (const e of Array.isArray(raw.entries) ? raw.entries : []) {
    const n = normalizeEntry(e, `e-${uid36()}`)
    if (!n || seen.has(n.id)) continue
    seen.add(n.id)
    entries.push(n)
  }
  return { code, name, desc: str(raw.desc), entries }
}

export function blankEntry(): DevEntry {
  return {
    id: `e-${uid36()}`, title: "", stage: "", severity: "pitfall",
    symptom: "", cause: "", solution: "", code: "", tags: [], date: today(),
  }
}

export function blankProject(): DevProject {
  return { code: `p-${uid36()}`, name: "", desc: "", entries: [] }
}

export async function loadDevNotes(): Promise<DevNotesDoc> {
  try {
    const d = await apiJson("/api/dev-notes")
    const projects: DevProject[] = []
    const seen = new Set<string>()
    for (const p of Array.isArray(d.projects) ? d.projects : []) {
      const n = normalizeProject(p)
      if (!n || seen.has(n.code)) continue
      seen.add(n.code)
      projects.push(n)
    }
    return { projects }
  } catch {
    // 拉取失败给空文档，页面显示空态而不是崩掉；重新加载即可
    return { projects: [] }
  }
}

export function saveDevNotes(doc: DevNotesDoc) {
  return postJson("/api/dev-notes", {
    projects: doc.projects.map((p) => ({
      code: p.code, name: p.name, desc: p.desc,
      entries: p.entries.map((e) => ({
        id: e.id, title: e.title, stage: e.stage, severity: e.severity,
        symptom: e.symptom, cause: e.cause, solution: e.solution,
        code: e.code, tags: e.tags, date: e.date,
      })),
    })),
  })
}
