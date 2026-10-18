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
}

export const STUDY_DOCS: Record<string, StudyDoc> = {
	java: {
		lang: "java",
		title: "Java · 从零到独立开发",
		subtitle: "16 周，从语法到上线：每周有步骤、有思路、有代码、有报错对照",
		icon: "☕",
		track: "java",
		trackLabel: "Java 课程（带随堂测试）",
	},
	go: {
		lang: "go",
		title: "Go · 8 周路线",
		subtitle: "Java 之后的第二语言：切片/接口/并发/服务/部署，每步都有代码",
		icon: "🐹",
		track: "go",
		trackLabel: "Go 课程",
	},
	react: {
		lang: "react",
		title: "React · 8 周（C 端）",
		subtitle: "面向 notelab-c：匿名访问、首屏预算、URL 即状态、SEO 与上线",
		icon: "⚛️",
		track: "typescript",
		trackLabel: "TypeScript 课程（打底）",
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
	tocIntro: TocItem[]
	tocAppendix: TocItem[]
	totalSteps: number
}
