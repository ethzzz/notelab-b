// 学习路线文档的元数据与数据结构（**类型必须保持纯数据，客户端组件会 import 它**）。
//
// 渲染（Markdown → HTML、语法高亮）在服务端做，见 study-render.ts —— 那个模块绝不能从客户端引入，
// 否则 highlight.js 会被打进浏览器包。
export type StudyDoc = {
	/** URL 段与文件名，如 java → /admin/study/java */
	lang: string
	title: string
	subtitle: string
	icon: string
	/** 配套的「编程学习」课程 code（见 /learning?track=）；没有就留空 */
	track?: string
	trackLabel?: string
	/**
	 * 内容修订号。**大纲被重写时必须递增**：进度是按「步骤 id」存在 localStorage 里的，
	 * 而步骤 id（1.1、1.2…）会复用 —— 内容换了、id 没换，旧勾选就会错误地落到新步骤上。
	 * 递增后旧进度键被弃用，等于从零开始，而不是显示一堆「已完成」的陌生步骤。
	 */
	rev?: string
}

export const STUDY_DOCS: Record<string, StudyDoc> = {
	java: {
		lang: "java",
		title: "Java · 熟练路线",
		subtitle: "17 周：语言内核 → 工程与数据 → 框架与服务 → 交付 → JVM 诊断",
		icon: "☕",
		track: "java",
		trackLabel: "Java 课程（带随堂测试）",
	},
	go: {
		lang: "go",
		title: "Go · 熟练路线",
		subtitle: "9 周：切片/接口/并发/服务/交付，外加 GMP 调度与 GC 观察",
		icon: "🐹",
		track: "go",
		trackLabel: "Go 课程",
	},
	react: {
		lang: "react",
		title: "React · 熟练路线（C 端）",
		subtitle: "9 周：渲染策略、首屏预算、URL 状态、SEO 与并发渲染",
		icon: "⚛️",
		track: "typescript",
		trackLabel: "TypeScript 课程（打底）",
		// 2026-10-19 大纲从「B 端语境」重写为「C 端语境」，步骤含义整体变了 → 进度作废重来
		rev: "2",
	},
}

export const STUDY_LANGS = Object.keys(STUDY_DOCS)

// ---------------------------------------------------------------------------
// 结构：一个文档 = 概览（intro）+ 若干周 + 附录（appendix）
// 每周内部 = 周级内容（本周目标 / 验收）+ 若干步骤；步骤内部 = 普通段落 + 折叠块
// ---------------------------------------------------------------------------

export type FoldKind = "hint" | "solution" | "error"

export type StudyPart = { type: "md"; html: string } | { type: "fold"; kind: FoldKind; title: string; html: string }

export type StudyStep = {
	/** 文档内唯一，如 "0.1"；用于锚点与本地进度键 */
	id: string
	/** 侧栏/卡片上显示的编号，如 "步骤 0.1" */
	label: string
	title: string
	parts: StudyPart[]
}

export type StudyWeek = {
	n: number
	title: string
	/** 所属阶段（来自最近一个「阶段X」h2），没有则空串 */
	stage: string
	/** 周首内容（本周目标等），渲染在步骤之前 */
	parts: StudyPart[]
	/** 周尾内容（验收清单等），渲染在步骤之后 —— 与 parts 分开是因为它天然该收尾 */
	outro: StudyPart[]
	steps: StudyStep[]
	/** 本周要能做到（取「本周目标」行，用于概览页摘要） */
	goal?: string
}

export type TocItem = { id: string; text: string; level: number }

export type StudyData = {
	intro: StudyPart[]
	weeks: StudyWeek[]
	appendix: StudyPart[]
	/** 阶段说明（key = 阶段标题）：写在 `## 阶段X` 与第一个 `### 第 N 周` 之间的内容 */
	stageIntros: Record<string, StudyPart[]>
	tocIntro: TocItem[]
	tocAppendix: TocItem[]
	totalSteps: number
}
