// 实践项目库的加载层（服务端）。
//
// 内容约定（**加一个项目 = 加一个 .md，不改代码**）：
//   src/content/study/projects/<route>/<slug>.md
//   route ∈ java | go | react
//
// 文件头是极简 front-matter（只认 `key: value`，不支持嵌套）：
//   ---
//   title: 订单与库存
//   route: java
//   direction: 交易
//   level: L3
//   weeks: 9-12
//   tags: 事务, 幂等, 并发
//   summary: 一句话说明这个项目在练什么
//   ---
//
// 正文用路线文档同一套语法：普通 Markdown + `:::hint` / `:::solution` / `:::error` 折叠。
// 缺字段不报错（用兜底值），但会在服务端日志里点名，方便补。
import fs from "node:fs/promises"
import path from "node:path"
import { renderDoc } from "@/lib/study-render"
import type { StudyPart } from "@/lib/study"

export type ProjectRoute = "java" | "go" | "react" | "nextjs"

/** 先修：指向某条路线的某一周区间，详情页渲成可点的深链 */
export type Prereq = { route: string; routeLabel: string; from: number; to: number }

export type StudyProject = {
	/** 稳定 id：`route/slug`，用于 ?p= 深链 */
	id: string
	route: ProjectRoute
	routeLabel: string
	title: string
	/** 业务方向：交易 / 异步 / 基础设施 / 内容 / 增长 / 平台 … */
	direction: string
	level: string
	weeks: string
	/** 预计工时，如 "6-8"（小时）；空串表示未标注 */
	hours: string
	/** 先修周次，来自 front-matter 的 `requires: java:9-12, java:5-8` */
	requires: Prereq[]
	tags: string[]
	summary: string
	parts: StudyPart[]
}

const ROOT = path.join(process.cwd(), "src", "content", "study", "projects")
const ROUTE_LABEL: Record<string, string> = { java: "Java", go: "Go", react: "React", nextjs: "Next.js" }
const ROUTE_ORDER: Record<string, number> = { java: 0, go: 1, react: 2, nextjs: 3 }

/** `java:9-12, go:5-6` → [{route:java,from:9,to:12}, …]；格式不对的项忽略（不阻塞加载） */
function parseRequires(raw: string): Prereq[] {
	if (!raw) return []
	const out: Prereq[] = []
	for (const part of raw.split(/[,，]/)) {
		const m = part.trim().match(/^([a-z]+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?$/i)
		if (!m) continue
		const route = m[1].toLowerCase()
		const from = Number(m[2])
		const to = Number(m[3] ?? m[2])
		if (!ROUTE_LABEL[route] || Number.isNaN(from) || Number.isNaN(to)) continue
		out.push({ route, routeLabel: ROUTE_LABEL[route], from: Math.min(from, to), to: Math.max(from, to) })
	}
	return out
}

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
	if (!m) return { meta: {}, body: raw }
	const meta: Record<string, string> = {}
	for (const line of m[1].split(/\r?\n/)) {
		const i = line.indexOf(":")
		if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
	}
	return { meta, body: raw.slice(m[0].length) }
}

export async function loadProjects(): Promise<StudyProject[]> {
	let routes: string[] = []
	try {
		routes = (await fs.readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
	} catch {
		return []
	}

	const out: StudyProject[] = []
	for (const route of routes) {
		const dir = path.join(ROOT, route)
		const files = (await fs.readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"))
		for (const file of files) {
			const raw = await fs.readFile(path.join(dir, file), "utf8")
			const { meta, body } = parseFrontMatter(raw)
			const slug = file.replace(/\.md$/, "")
			const missing = ["title", "direction", "summary"].filter((k) => !meta[k])
			if (missing.length) console.warn(`[projects] ${route}/${file} 缺字段：${missing.join(", ")}`)
			out.push({
				id: `${route}/${slug}`,
				route: route as ProjectRoute,
				routeLabel: ROUTE_LABEL[route] ?? route,
				title: meta.title || slug,
				direction: meta.direction || "未分类",
				level: meta.level || "L3",
				weeks: meta.weeks || "",
				hours: meta.hours || "",
				requires: parseRequires(meta.requires || ""),
				tags: (meta.tags || "")
					.split(/[,，]/)
					.map((s) => s.trim())
					.filter(Boolean),
				summary: meta.summary || "",
				parts: renderDoc(body),
			})
		}
	}

	return out.sort(
		(a, b) => (ROUTE_ORDER[a.route] ?? 9) - (ROUTE_ORDER[b.route] ?? 9) || a.title.localeCompare(b.title, "zh"),
	)
}
