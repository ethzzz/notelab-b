// 学习路线文档的**服务端渲染与结构化**（只在 page.tsx 里用，绝不能从客户端组件 import）。
//
// 为什么放服务端：
//   1) 语法高亮要 highlight.js，打进客户端包是几十上百 KB，而这个页面本来就该是静态的；
//   2) 结构解析（周 / 步骤 / 折叠块）只依赖文本，构建时做一次即可，浏览器只负责展开与打勾。
import { marked } from "marked"
import { markedHighlight } from "marked-highlight"
import hljs from "highlight.js/lib/core"
import java from "highlight.js/lib/languages/java"
import go from "highlight.js/lib/languages/go"
import typescript from "highlight.js/lib/languages/typescript"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import bash from "highlight.js/lib/languages/bash"
import powershell from "highlight.js/lib/languages/powershell"
import sql from "highlight.js/lib/languages/sql"
import yaml from "highlight.js/lib/languages/yaml"
import ini from "highlight.js/lib/languages/ini"
import markdown from "highlight.js/lib/languages/markdown"
import xml from "highlight.js/lib/languages/xml"
import plaintext from "highlight.js/lib/languages/plaintext"
import type { FoldKind, StudyData, StudyPart, StudyStep, StudyWeek, TocItem } from "@/lib/study"

// 只注册文档里实际用到的语言：全量 highlight.js 有 190+ 种，构建时间和内存都白花
const LANGS = { java, go, typescript, javascript, json, bash, powershell, sql, yaml, ini, markdown, xml, plaintext }
for (const [name, lang] of Object.entries(LANGS)) hljs.registerLanguage(name, lang)

// 文档里常见的别名 → highlight.js 的语言名
const ALIAS: Record<string, string> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	sh: "bash",
	shell: "bash",
	yml: "yaml",
	text: "plaintext",
	txt: "plaintext",
	ini: "ini",
	conf: "ini",
	nginx: "ini", // nginx 配置按 ini 着色够用，省一个语言包
	html: "xml",
}

marked.use(
	markedHighlight({
		langPrefix: "hljs language-",
		highlight(code, lang) {
			const raw = (lang || "").trim().toLowerCase()
			const key = ALIAS[raw] || raw
			if (key && hljs.getLanguage(key)) {
				try {
					return hljs.highlight(code, { language: key, ignoreIllegals: true }).value
				} catch {
					/* 落到纯文本 */
				}
			}
			return escapeHtml(code)
		},
	}),
)
marked.setOptions({ gfm: true, breaks: true })

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------

/** 锚点 id：小写、去符号、空白转连字符；重名追加 -2、-3。中文原样保留（浏览器支持） */
function makeId(text: string, used: Set<string>): string {
	const base =
		text
			.trim()
			.toLowerCase()
			.replace(/[^\u4e00-\u9fa5a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "section"
	let id = base
	let n = 2
	while (used.has(id)) id = `${base}-${n++}`
	used.add(id)
	return id
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * 渲染一段 Markdown，并给 h2/h3 补锚点 id（目录要能跳）。
 *
 * 注意：这里**不做 XSS 消毒** —— 输入只来自仓库里的 .md 文件（不是用户提交），
 * 而 DOMPurify 在 Node 里没有 DOM 会原样返回，加了也是假的安全感。
 */
function renderMd(text: string, used: Set<string>, toc?: TocItem[]): string {
	const raw = marked.parse(text) as string
	return raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
		const plain = inner.replace(/<[^>]+>/g, "").trim()
		const id = makeId(plain, used)
		toc?.push({ id, text: plain, level: Number(level) })
		return `<h${level} id="${id}">${inner}</h${level}>`
	})
}

// ---------------------------------------------------------------------------
// 结构解析
// ---------------------------------------------------------------------------

const WEEK_RE = /^#{2,3}\s+第\s*(\d+)\s*周\s*[：:]\s*(.+?)\s*$/
const STEP_RE = /^####\s+步骤\s*([0-9]+(?:\.[0-9]+)*)?\s*(.+?)\s*$/
const FOLD_RE = /^:::(hint|solution|error)\s*(.*)$/
const HEADING_RE = /^#{2,3}\s+/

type Mode = "intro" | "week" | "appendix"

export function parseStudy(markdown: string): StudyData {
	const used = new Set<string>()
	const seenStepIds = new Set<string>()
	const lines = markdown.replace(/^\uFEFF?#\s+[^\n]*\n+/, "").split(/\r?\n/)

	const intro: StudyPart[] = []
	const weeks: StudyWeek[] = []
	const appendix: StudyPart[] = []
	const tocIntro: TocItem[] = []
	const tocAppendix: TocItem[] = []

	let mode: Mode = "intro"
	let week: StudyWeek | null = null
	let step: StudyStep | null = null
	let stage = ""
	let buf: string[] = []
	let seq = 0
	/** 是否已经在「验收」之后：之后的段落归 week.outro，渲染在步骤下方 */
	let inOutro = false

	const target = (): StudyPart[] =>
		step ? step.parts : week ? (inOutro ? week.outro : week.parts) : mode === "intro" ? intro : appendix

	const flush = () => {
		const text = buf.join("\n")
		buf = []
		if (!text.trim()) return
		const toc = mode === "intro" ? tocIntro : mode === "appendix" ? tocAppendix : undefined
		target().push({ type: "md", html: renderMd(text, used, toc) })
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		const weekMatch = line.match(WEEK_RE)
		if (weekMatch) {
			flush()
			step = null
			inOutro = false
			const n = Number(weekMatch[1])
			week = { n, title: weekMatch[2], stage, parts: [], outro: [], steps: [] }
			weeks.push(week)
			mode = "week"
			continue
		}

		const stepMatch = line.match(STEP_RE)
		if (stepMatch && week) {
			flush()
			const no = stepMatch[1] || `${week.n}.${++seq}`
			let id = no
			let k = 2
			while (seenStepIds.has(id)) id = `${no}-${k++}`
			seenStepIds.add(id)
			step = { id, label: `步骤 ${no}`, title: stepMatch[2].replace(/`/g, ""), parts: [] }
			week.steps.push(step)
			continue
		}

		// 「验收」是周级别的收尾：之后的段落归 outro，渲染在步骤下方
		if (/^\*\*验收\*\*/.test(line.trim())) {
			flush()
			step = null
			inOutro = true
			buf.push(line)
			continue
		}

		// 本周目标：抽出来给「周首信息栏」与概览摘要用，正文里不再重复渲染
		if (week && /^\*\*本周目标\*\*/.test(line.trim())) {
			flush()
			week.goal = line
				.replace(/^\*\*本周目标\*\*[：:]\s*/, "")
				.replace(/\*\*/g, "")
				.replace(/`/g, "")
				.trim()
			continue
		}

		const foldMatch = line.match(FOLD_RE)
		if (foldMatch) {
			flush()
			const kind = foldMatch[1] as FoldKind
			const body: string[] = []
			for (i++; i < lines.length && !/^:::\s*$/.test(lines[i]); i++) body.push(lines[i])
			target().push({ type: "fold", kind, title: foldMatch[2].trim(), html: renderMd(body.join("\n"), used) })
			continue
		}

		if (HEADING_RE.test(line)) {
			const text = line.replace(/^#{2,3}\s+/, "").trim()
			// 「阶段X」是分组标题（结构信息，不进正文）——周列表按它分组。
			// 用命名约定判断而不是看下一个标题，是为了让「第一个阶段」也能被识别（它前面没有周）。
			if (/^阶段/.test(text)) {
				flush()
				step = null
				stage = text
				continue
			}
			if (mode === "week") {
				// 周走完之后再出现的标题 = 附录开始
				flush()
				step = null
				week = null
				mode = "appendix"
			}
			flush()
			buf.push(line)
			continue
		}

		if (mode === "appendix") {
			// 附录里的内容不再归到某一周
			week = null
			step = null
		}
		buf.push(line)
	}
	flush()

	const totalSteps = weeks.reduce((sum, w) => sum + w.steps.length, 0)
	return { intro, weeks, appendix, tocIntro, tocAppendix, totalSteps }
}
