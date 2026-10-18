"use client"
// 学习路线阅读器：左侧章节导航 + 右侧长文 + 可折叠的「思路 / 代码答案」。
//
// 文档里的折叠块用自定义围栏标记（不是 <details>），因为 marked 会把裸 HTML 块整段透传、
// 里面的 Markdown 不再解析 —— 而我们要在折叠块里放代码块、列表和表格。
//
// 约定（三份文档共用）：
//   :::hint 标题        ← 思路 / 为什么这么做
//   ...任意 Markdown...
//   :::
//
//   :::solution 标题    ← 参考代码 / 答案
//   ...任意 Markdown...
//   :::
//
// 默认全部收起：先自己想，卡住了再展开。这也是「傻瓜式」不等于「抄答案」的分界线。
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "antd"
import { renderMd } from "@/components/md-preview"
import { AdminPage } from "@/components/admin"
import type { StudyDoc } from "@/lib/study"

type TocItem = { id: string; text: string; level: number }

type Block =
	| { kind: "md"; html: string }
	| { kind: "hint" | "solution"; html: string; title: string }

/** 把标题文本变成可放进 href 的锚点；重名追加 -2、-3，保证 id 唯一 */
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

/** 给 md 片段里的 h2/h3 补锚点 id，顺便收进目录（保持文档顺序） */
function renderSegment(md: string, used: Set<string>, toc: TocItem[]): string {
	const raw = renderMd(md)
	return raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
		const text = inner.replace(/<[^>]+>/g, "").trim()
		const id = makeId(text, used)
		toc.push({ id, text, level: Number(level) })
		return `<h${level} id="${id}">${inner}</h${level}>`
	})
}

/**
 * 把整篇 Markdown 切成「普通段落 / 思路块 / 答案块」。
 *
 * 只认行首的 `:::hint` / `:::solution` 与单独的 `:::` 结束行 ——
 * 代码里出现 `:::` 的概率极低，而且必须在行首才算，不会误伤三目运算符。
 */
function splitBlocks(markdown: string, used: Set<string>, toc: TocItem[]): Block[] {
	const lines = markdown.replace(/^\uFEFF?#\s+[^\n]*\n+/, "").split(/\r?\n/)
	const out: Block[] = []
	let buf: string[] = []

	const flush = () => {
		const text = buf.join("\n")
		buf = []
		if (text.trim()) out.push({ kind: "md", html: renderSegment(text, used, toc) })
	}

	for (let i = 0; i < lines.length; i++) {
		const open = lines[i].match(/^:::(hint|solution)\s*(.*)$/)
		if (!open) {
			buf.push(lines[i])
			continue
		}
		flush()
		const kind = open[1] as "hint" | "solution"
		const title = (open[2] || "").trim()
		const body: string[] = []
		for (i++; i < lines.length && !/^:::\s*$/.test(lines[i]); i++) body.push(lines[i])
		const inner = body.join("\n")
		// 折叠块内部的标题不进目录（它们不是章节），但正文还是要正常渲染
		out.push({ kind, title, html: renderMd(inner) })
	}
	flush()
	return out
}

export default function StudyReader({ doc, markdown }: { doc: StudyDoc; markdown: string }) {
	const { blocks, toc } = useMemo(() => {
		const used = new Set<string>()
		const items: TocItem[] = []
		return { blocks: splitBlocks(markdown, used, items), toc: items }
	}, [markdown])

	const [active, setActive] = useState("")
	// 折叠状态按块下标记；`allOpen` 只用于「一键展开/收起」，不覆盖用户单独点开的块
	const [open, setOpen] = useState<Record<number, boolean>>({})
	const hasFold = blocks.some((b) => b.kind !== "md")
	const anyOpen = Object.values(open).some(Boolean)

	// 高亮当前章节：只关心「离顶部最近且仍在视口内」的那个标题
	useEffect(() => {
		const els = toc
			.map((t) => document.getElementById(t.id))
			.filter((el): el is HTMLElement => el !== null)
		if (!els.length) return
		const io = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
				if (visible[0]) setActive(visible[0].target.id)
			},
			{ rootMargin: "-72px 0px -68% 0px" },
		)
		els.forEach((el) => io.observe(el))
		return () => io.disconnect()
	}, [toc])

	function toggleAll(next: boolean) {
		const map: Record<number, boolean> = {}
		blocks.forEach((b, i) => {
			if (b.kind !== "md") map[i] = next
		})
		setOpen(map)
	}

	const folded = (idx: number, kind: "hint" | "solution", title: string, html: string) => {
		const isOpen = !!open[idx]
		return (
			<div key={idx} className={`study-fold study-fold-${kind}`}>
				<button type="button" className="study-fold-head" aria-expanded={isOpen} onClick={() => setOpen((s) => ({ ...s, [idx]: !isOpen }))}>
					<span className="study-fold-tag">{kind === "hint" ? "思路" : "代码 / 答案"}</span>
					<span className="study-fold-title">{title || (kind === "hint" ? "想不明白再点开" : "参考实现")}</span>
					<span className="study-fold-arrow">{isOpen ? "收起" : "展开"}</span>
				</button>
				{isOpen && <div className="md-body study-fold-body" dangerouslySetInnerHTML={{ __html: html }} />}
			</div>
		)
	}

	const nav = (
		<ul className="m-0 list-none p-0 text-sm">
			{toc.map((t) => (
				<li key={t.id} className={t.level === 3 ? "pl-3" : ""}>
					<a
						href={`#${t.id}`}
						onClick={() => setActive(t.id)}
						className={`block truncate rounded px-2 py-1.5 transition-colors ${
							active === t.id
								? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
								: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
						}`}
						title={t.text}
					>
						{t.text}
					</a>
				</li>
			))}
		</ul>
	)

	return (
		<AdminPage
			title={
				<span className="inline-flex items-center gap-2">
					<span>{doc.icon}</span>
					<span>{doc.title}</span>
				</span>
			}
			description={doc.subtitle}
			extra={
				<span className="inline-flex items-center gap-2">
					{hasFold && (
						<Button size="small" onClick={() => toggleAll(!anyOpen)}>
							{anyOpen ? "全部收起" : "全部展开"}
						</Button>
					)}
					{doc.track && (
						<Link href={`/learning?track=${doc.track}`}>
							<Button size="small">{doc.trackLabel || "配套课程"}</Button>
						</Link>
					)}
				</span>
			}
		>
			<style>{STUDY_CSS}</style>
			<div className="study-doc flex items-start gap-6">
				<nav className="sticky top-4 hidden max-h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto border-r border-zinc-200 pr-3 dark:border-zinc-800 xl:block">
					<div className="mb-2 px-2 text-xs font-medium text-zinc-400">目录</div>
					{nav}
				</nav>
				<article className="min-w-0 flex-1">
					{/* 移动端：目录折叠，避免长文档一进来就被目录淹没 */}
					<details className="mb-4 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 xl:hidden">
						<summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">目录</summary>
						<div className="mt-2">{nav}</div>
					</details>
					{blocks.map((b, i) =>
						b.kind === "md" ? (
							<div key={i} className="md-body" dangerouslySetInnerHTML={{ __html: b.html }} />
						) : (
							folded(i, b.kind, b.title, b.html)
						),
					)}
				</article>
			</div>
		</AdminPage>
	)
}

/**
 * 阅读区排版（只作用于 `.study-doc`，不动全局 MD_BODY_CSS）。
 *
 * 为什么单独一套：笔记与课程预览用的是紧凑版（14px），而这里是**长文档**——
 * 字号 15.5px、行高 1.85、正文最大 860px 更接近阅读器的体感；颜色一律用
 * currentColor + 半透明灰，免得再为 light/dark 各写一遍。
 */
const STUDY_CSS = `
.study-doc{--line:rgba(128,128,128,.22);--soft:rgba(128,128,128,.08);--code:rgba(128,128,128,.11)}
.study-doc .md-body{font-size:15.5px;line-height:1.85;letter-spacing:.005em;max-width:860px}
.study-doc .md-body h2{font-size:1.5em;font-weight:650;letter-spacing:-.01em;margin:2.4em 0 .8em;padding-bottom:.35em;border-bottom:1px solid var(--line)}
.study-doc .md-body h2:first-child{margin-top:.4em}
.study-doc .md-body h3{font-size:1.16em;font-weight:650;margin:1.9em 0 .55em}
.study-doc .md-body h4{font-size:1em;font-weight:650;margin:1.5em 0 .45em}
.study-doc .md-body p{margin:.7em 0}
.study-doc .md-body ul,.study-doc .md-body ol{padding-left:1.5em;margin:.6em 0}
.study-doc .md-body li{margin:.32em 0}
.study-doc .md-body li>p{margin:.2em 0}
.study-doc .md-body strong{font-weight:650}
.study-doc .md-body code{background:var(--code);padding:.18em .42em;border-radius:5px;font-size:.875em;font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
.study-doc .md-body pre{background:var(--code);border:1px solid var(--line);padding:14px 16px;border-radius:10px;overflow:auto;margin:.9em 0;line-height:1.62}
.study-doc .md-body pre code{background:none;padding:0;font-size:.86em}
.study-doc .md-body blockquote{margin:1em 0;padding:.6em 1em;border-left:3px solid rgba(128,128,128,.5);background:var(--soft);border-radius:0 8px 8px 0}
.study-doc .md-body blockquote p{margin:.2em 0}
.study-doc .md-body table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.94em}
.study-doc .md-body th,.study-doc .md-body td{border:1px solid var(--line);padding:.5em .8em;text-align:left;vertical-align:top}
.study-doc .md-body thead th{background:var(--soft);font-weight:600;white-space:nowrap}
.study-doc .md-body tbody tr:nth-child(2n){background:rgba(128,128,128,.045)}
.study-doc .md-body hr{border:none;border-top:1px solid var(--line);margin:2.2em 0}
.study-doc .md-body a{color:#1677ff;text-decoration:none}
.study-doc .md-body a:hover{text-decoration:underline}
.study-doc .md-body img{max-width:100%;border-radius:8px}
.study-doc .md-body h2,.study-doc .md-body h3{scroll-margin-top:76px}

.study-fold{margin:1em 0;border:1px solid var(--line);border-radius:10px;background:rgba(128,128,128,.035);overflow:hidden}
.study-fold-head{display:flex;align-items:center;gap:.6em;width:100%;padding:.7em .9em;background:none;border:0;cursor:pointer;text-align:left;color:inherit;font-size:14px;line-height:1.5}
.study-fold-head:hover{background:rgba(128,128,128,.06)}
.study-fold-tag{flex:none;border-radius:999px;padding:.1em .6em;font-size:12px;font-weight:600;border:1px solid transparent}
.study-fold-hint .study-fold-tag{color:#0958d9;background:rgba(22,119,255,.1);border-color:rgba(22,119,255,.25)}
.study-fold-solution .study-fold-tag{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.28)}
.study-fold-title{flex:1;min-width:0;color:rgba(128,128,128,1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-fold-arrow{flex:none;font-size:12px;color:#1677ff}
.study-fold-body{padding:.2em 1em 1em;border-top:1px dashed var(--line);margin-top:.1em}
.study-fold-body>*:first-child{margin-top:.8em}
`
