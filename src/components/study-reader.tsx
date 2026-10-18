"use client"
// 学习路线阅读器：左侧章节导航 + 右侧长文。
//
// 为什么不直接用 MdPreview：目录要能点击跳转，而 MdPreview 输出的标题没有 id。
// 这里折中成「自己渲染一次 + 给 h2/h3 补 id」，比改公共组件影响面小（MdPreview 还被笔记/课程页用着）。
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "antd"
import { MD_BODY_CSS, renderMd } from "@/components/md-preview"
import { AdminPage } from "@/components/admin"
import type { StudyDoc } from "@/lib/study"

type TocItem = { id: string; text: string; level: number }

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

export default function StudyReader({ doc, markdown }: { doc: StudyDoc; markdown: string }) {
	// 正文开头的 H1 已经由页面标题承载，重复渲染会让目录里多出一个同名项
	const { html, toc } = useMemo(() => {
		const used = new Set<string>()
		const items: TocItem[] = []
		const body = markdown.replace(/^\uFEFF?#\s+[^\n]*\n+/, "")
		const raw = renderMd(body)
		const withIds = raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
			const text = inner.replace(/<[^>]+>/g, "").trim()
			const id = makeId(text, used)
			items.push({ id, text, level: Number(level) })
			return `<h${level} id="${id}">${inner}</h${level}>`
		})
		return { html: withIds, toc: items }
	}, [markdown])

	const [active, setActive] = useState("")

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

	const nav = (
		<ul className="m-0 list-none p-0 text-sm">
			{toc.map((t) => (
				<li key={t.id} className={t.level === 3 ? "pl-3" : ""}>
					<a
						href={`#${t.id}`}
						onClick={() => setActive(t.id)}
						className={`block truncate rounded px-2 py-1 transition-colors ${
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
				doc.track ? (
					<Link href={`/learning?track=${doc.track}`}>
						<Button size="small">{doc.trackLabel || "配套课程"}</Button>
					</Link>
				) : null
			}
		>
			<div className="flex items-start gap-6">
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
					<style>{MD_BODY_CSS}</style>
					<style>{".md-body h2,.md-body h3{scroll-margin-top:76px}"}</style>
					<div className="md-body max-w-4xl" dangerouslySetInnerHTML={{ __html: html }} />
				</article>
			</div>
		</AdminPage>
	)
}
