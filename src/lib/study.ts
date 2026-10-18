// 学习路线文档的元数据（语言 → 文档）。
//
// 为什么放在前端而不是 Java 种子：这些是**长文档**，和「编程学习」里带随堂测试的课程不是一回事。
// 文档随 git 走（可 review、可回滚、可 diff），课程内容走 ui_config（可在线编辑）。
//
// ⚠️ 这里每加一个 lang，必须同步做三件事，漏一件就是「菜单点进去 404」或「谁都看不见」：
//   1) src/content/study/<lang>.md 放正文；
//   2) Java 侧 MenuTree.MENUS 加菜单节点；
//   3) Java 侧 PageRoutes.PAGE_ROUTES 加 /study/<lang>（漏了叶子会被 RBAC 过滤）。
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
		subtitle: "16 周，从语法到上线：每周有任务、有验收、有坑清单",
		icon: "☕",
		track: "java",
		trackLabel: "Java 课程（带随堂测试）",
	},
	go: {
		lang: "go",
		title: "Go · 4 周专项",
		subtitle: "Java 之后的第二语言：并发、部署形态与真实落点",
		icon: "🐹",
		track: "go",
		trackLabel: "Go 课程",
	},
	react: {
		lang: "react",
		title: "React · 4 周专项",
		subtitle: "面向本项目前端：状态、副作用、服务端边界与交付",
		icon: "⚛️",
		track: "typescript",
		trackLabel: "TypeScript 课程（打底）",
	},
}

export const STUDY_LANGS = Object.keys(STUDY_DOCS)
