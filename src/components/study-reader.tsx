"use client"
// 学习路线阅读器：概览（周列表）/ 单周（步骤卡片）/ 折叠的「思路 · 代码答案 · 常见报错」/ 步骤打勾。
//
// 分工：Markdown 解析与语法高亮在服务端（study-render.ts），这里只处理交互与状态。
// 周用 ?week=N 切换，而不是子路由 —— 页面守卫是 page 精确匹配，子路由要逐条登记权限（见 page.tsx 注释）。
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Checkbox } from "antd"
import { AdminPage } from "@/components/admin"
import type { StudyData, StudyDoc, StudyPart, StudyStep, StudyWeek, TocItem } from "@/lib/study"

const FOLD_META = {
	hint: { tag: "思路", hint: "想不明白再点开" },
	solution: { tag: "代码 / 答案", hint: "参考实现" },
	error: { tag: "常见报错", hint: "报错了对着看" },
} as const

export default function StudyReader({ doc, data }: { doc: StudyDoc; data: StudyData }) {
	const router = useRouter()
	const sp = useSearchParams()
	const raw = sp.get("week")
	const weekN = raw && /^\d+$/.test(raw) ? Number(raw) : null
	const week = weekN === null ? null : data.weeks.find((w) => w.n === weekN) || null

	const [open, setOpen] = useState<Record<string, boolean>>({})
	const [progress, setProgress] = useState<Record<string, boolean>>({})
	const storageKey = `study.progress.${doc.lang}`

	// 进度存本地：跨设备不同步，但不需要登录态、也不会因为误点污染服务端
	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) || "{}")
			setProgress(saved && typeof saved === "object" ? saved : {})
		} catch {
			setProgress({})
		}
	}, [storageKey])

	// 切周后回到顶部（浏览器会保留滚动位置，读下一周时很别扭）
	useEffect(() => {
		window.scrollTo({ top: 0 })
	}, [weekN])

	const toggleStep = useCallback(
		(id: string) => {
			setProgress((prev) => {
				const next = { ...prev, [id]: !prev[id] }
				try {
					localStorage.setItem(storageKey, JSON.stringify(next))
				} catch {
					/* 隐私模式下写不进去，忽略 */
				}
				return next
			})
		},
		[storageKey],
	)

	const doneOf = (w: StudyWeek) => w.steps.filter((s) => progress[s.id]).length
	const doneTotal = data.weeks.reduce((n, w) => n + doneOf(w), 0)
	const pct = data.totalSteps ? Math.round((doneTotal / data.totalSteps) * 100) : 0

	const goWeek = (n: number | null) => {
		router.push(n === null ? `/study/${doc.lang}` : `/study/${doc.lang}?week=${n}`, { scroll: false })
	}

	// ---------------------------------------------------------------- 折叠块

	const renderParts = (parts: StudyPart[], scope: string) =>
		parts.map((p, i) => {
			if (p.type === "md") return <div key={i} className="md-body" dangerouslySetInnerHTML={{ __html: p.html }} />
			const key = `${scope}:${i}`
			const isOpen = !!open[key]
			const meta = FOLD_META[p.kind]
			return (
				<div key={i} className={`study-fold study-fold-${p.kind}`}>
					<button
						type="button"
						className="study-fold-head"
						aria-expanded={isOpen}
						onClick={() => setOpen((s) => ({ ...s, [key]: !isOpen }))}
					>
						<span className="study-fold-tag">{meta.tag}</span>
						<span className="study-fold-title">{p.title || meta.hint}</span>
						<span className="study-fold-arrow">{isOpen ? "收起" : "展开"}</span>
					</button>
					{isOpen && <div className="md-body study-fold-body" dangerouslySetInnerHTML={{ __html: p.html }} />}
				</div>
			)
		})

	const allFoldKeys = useMemo(() => {
		const keys: string[] = []
		const collect = (parts: StudyPart[], scope: string) =>
			parts.forEach((p, i) => {
				if (p.type === "fold") keys.push(`${scope}:${i}`)
			})
		if (week) {
			collect(week.parts, `w${week.n}`)
			week.steps.forEach((s) => collect(s.parts, `s${s.id}`))
		} else {
			collect(data.intro, "intro")
			collect(data.appendix, "appendix")
		}
		return keys
	}, [week, data])

	const anyOpen = allFoldKeys.some((k) => open[k])
	const toggleAll = () => {
		const next: Record<string, boolean> = { ...open }
		const target = !anyOpen
		allFoldKeys.forEach((k) => {
			next[k] = target
		})
		setOpen(next)
	}

	// ---------------------------------------------------------------- 目录

	const toc: TocItem[] = useMemo(() => {
		if (week) {
			return week.steps.map((s) => ({ id: `step-${s.id}`, text: `${s.label} ${s.title}`, level: 3 }))
		}
		return [
			...data.tocIntro,
			{ id: "weeks", text: "全部周次", level: 2 },
			...data.tocAppendix,
		]
	}, [week, data])

	const [active, setActive] = useState("")
	useEffect(() => {
		const els = toc.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => el !== null)
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
				<li key={t.id}>
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

	const headerExtra = (
		<span className="inline-flex items-center gap-2">
			<span className="study-progress-text">
				已完成 {doneTotal}/{data.totalSteps}
			</span>
			<Button size="small" onClick={toggleAll} disabled={!allFoldKeys.length}>
				{anyOpen ? "全部收起" : "全部展开"}
			</Button>
			{doc.track && (
				<Link href={`/learning?track=${doc.track}`}>
					<Button size="small">{doc.trackLabel || "配套课程"}</Button>
				</Link>
			)}
		</span>
	)

	return (
		<AdminPage
			title={
				<span className="inline-flex items-center gap-2">
					<span>{doc.icon}</span>
					<span>{week ? `第 ${week.n} 周 · ${week.title}` : doc.title}</span>
				</span>
			}
			description={week ? week.stage || `本周 ${week.steps.length} 个步骤` : doc.subtitle}
			extra={headerExtra}
		>
			<style>{STUDY_CSS}</style>
			<div className="study-doc flex items-start gap-6">
				<nav className="sticky top-4 hidden max-h-[calc(100vh-7rem)] w-60 shrink-0 overflow-y-auto border-r border-zinc-200 pr-3 dark:border-zinc-800 xl:block">
					<div className="mb-2 px-2 text-xs font-medium text-zinc-400">{week ? "本周步骤" : "目录"}</div>
					{nav}
				</nav>
				<article className="min-w-0 flex-1">
					<details className="mb-4 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 xl:hidden">
						<summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">{week ? "本周步骤" : "目录"}</summary>
						<div className="mt-2">{nav}</div>
					</details>

					{week ? (
						<WeekView
							week={week}
							progress={progress}
							onToggle={toggleStep}
							renderParts={renderParts}
							onBack={() => goWeek(null)}
							prev={data.weeks[data.weeks.findIndex((w) => w.n === week.n) - 1]}
							next={data.weeks[data.weeks.findIndex((w) => w.n === week.n) + 1]}
							onGo={goWeek}
						/>
					) : (
						<Overview
							data={data}
							pct={pct}
							doneTotal={doneTotal}
							renderParts={renderParts}
							doneOf={doneOf}
							onOpen={goWeek}
						/>
					)}
				</article>
			</div>
		</AdminPage>
	)
}

// --------------------------------------------------------------------- 概览

function Overview({
	data,
	pct,
	doneTotal,
	renderParts,
	doneOf,
	onOpen,
}: {
	data: StudyData
	pct: number
	doneTotal: number
	renderParts: (parts: StudyPart[], scope: string) => ReactNode
	doneOf: (w: StudyWeek) => number
	onOpen: (n: number) => void
}) {
	// 按阶段分组（顺序即文档顺序）
	const groups = useMemo(() => {
		const out: { stage: string; weeks: StudyWeek[] }[] = []
		for (const w of data.weeks) {
			const last = out[out.length - 1]
			if (last && last.stage === w.stage) last.weeks.push(w)
			else out.push({ stage: w.stage, weeks: [w] })
		}
		return out
	}, [data.weeks])

	return (
		<>
			<div className="study-overview-progress">
				<div className="study-bar">
					<div className="study-bar-fill" style={{ width: `${pct}%` }} />
				</div>
				<span className="study-progress-text">
					{doneTotal}/{data.totalSteps} 步已完成
				</span>
			</div>

			<div className="max-w-[860px]">{renderParts(data.intro, "intro")}</div>

			<div id="weeks" className="study-weeks">
				<div className="study-section-title">全部周次</div>
				{groups.map((g) => (
					<div key={g.stage || "all"} className="study-stage">
						<div className="study-stage-name">{g.stage || "主线"}</div>
						<div className="study-week-list">
							{g.weeks.map((w) => {
								const done = doneOf(w)
								return (
									<button key={w.n} type="button" className="study-week-row" onClick={() => onOpen(w.n)}>
										<span className="study-week-no">第 {w.n} 周</span>
										<span className="study-week-main">
											<span className="study-week-title">{w.title}</span>
											{w.goal && <span className="study-week-goal">{w.goal}</span>}
										</span>
										<span className="study-week-meta">
											{done > 0 && (
												<span className="study-week-done">
													{done}/{w.steps.length}
												</span>
											)}
											<span>{w.steps.length} 步</span>
										</span>
									</button>
								)
							})}
						</div>
					</div>
				))}
			</div>

			<div className="max-w-[860px]">{renderParts(data.appendix, "appendix")}</div>
		</>
	)
}

// --------------------------------------------------------------------- 单周

function WeekView({
	week,
	progress,
	onToggle,
	renderParts,
	onBack,
	prev,
	next,
	onGo,
}: {
	week: StudyWeek
	progress: Record<string, boolean>
	onToggle: (id: string) => void
	renderParts: (parts: StudyPart[], scope: string) => ReactNode
	onBack: () => void
	prev?: StudyWeek
	next?: StudyWeek
	onGo: (n: number | null) => void
}) {
	const done = week.steps.filter((s) => progress[s.id]).length

	return (
		<>
			<div className="mb-3 flex items-center gap-3">
				<Button size="small" onClick={onBack}>
					← 路线概览
				</Button>
				<span className="study-progress-text">
					本周 {done}/{week.steps.length} 步
				</span>
			</div>

			<div className="max-w-[860px]">{renderParts(week.parts, `w${week.n}`)}</div>

			<div className="study-steps">
				{week.steps.map((s) => {
					const isDone = !!progress[s.id]
					return (
						<section key={s.id} id={`step-${s.id}`} className={`study-step${isDone ? " is-done" : ""}`}>
							<div className="study-step-head">
								<Checkbox checked={isDone} onChange={() => onToggle(s.id)} aria-label={`标记${s.label}完成`} />
								<span className="study-step-label">{s.label}</span>
								<h4 className="study-step-title">{s.title}</h4>
							</div>
							<div className="study-step-body">{renderParts(s.parts, `s${s.id}`)}</div>
						</section>
					)
				})}
			</div>

			<nav className="study-pager">
				{prev ? (
					<Button onClick={() => onGo(prev.n)}>
						← 第 {prev.n} 周 · {prev.title}
					</Button>
				) : (
					<span />
				)}
				{next ? (
					<Button type="primary" onClick={() => onGo(next.n)}>
						第 {next.n} 周 · {next.title} →
					</Button>
				) : (
					<span />
				)}
			</nav>
		</>
	)
}

// --------------------------------------------------------------------- 样式

/**
 * 阅读区样式（只作用于 `.study-doc`，不动全局 MD_BODY_CSS）。
 *
 * 三块：正文排版 / 折叠块 / 步骤与周列表；末尾是 highlight.js 的 token 配色
 * （不引它的主题 CSS：主题文件是全局 `.hljs` 选择器，会污染笔记页，而且深浅色要各引一份）。
 */
const STUDY_CSS = `
.study-doc{--line:rgba(128,128,128,.22);--soft:rgba(128,128,128,.08);--code:rgba(128,128,128,.1);--accent:#1677ff}
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
.study-doc .md-body pre code{background:none;padding:0;font-size:.86em;color:inherit}
.study-doc .md-body blockquote{margin:1em 0;padding:.6em 1em;border-left:3px solid rgba(128,128,128,.5);background:var(--soft);border-radius:0 8px 8px 0}
.study-doc .md-body blockquote p{margin:.2em 0}
.study-doc .md-body table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.94em}
.study-doc .md-body th,.study-doc .md-body td{border:1px solid var(--line);padding:.5em .8em;text-align:left;vertical-align:top}
.study-doc .md-body thead th{background:var(--soft);font-weight:600;white-space:nowrap}
.study-doc .md-body tbody tr:nth-child(2n){background:rgba(128,128,128,.045)}
.study-doc .md-body hr{border:none;border-top:1px solid var(--line);margin:2.2em 0}
.study-doc .md-body a{color:var(--accent);text-decoration:none}
.study-doc .md-body a:hover{text-decoration:underline}
.study-doc .md-body img{max-width:100%;border-radius:8px}
.study-doc .md-body h2,.study-doc .md-body h3{scroll-margin-top:76px}

/* ---- 折叠块 ---- */
.study-fold{margin:1em 0;border:1px solid var(--line);border-radius:10px;background:rgba(128,128,128,.035);overflow:hidden}
.study-fold-head{display:flex;align-items:center;gap:.6em;width:100%;padding:.7em .9em;background:none;border:0;cursor:pointer;text-align:left;color:inherit;font-size:14px;line-height:1.5}
.study-fold-head:hover{background:rgba(128,128,128,.06)}
.study-fold-tag{flex:none;border-radius:999px;padding:.1em .6em;font-size:12px;font-weight:600;border:1px solid transparent}
.study-fold-hint .study-fold-tag{color:#0958d9;background:rgba(22,119,255,.1);border-color:rgba(22,119,255,.25)}
.study-fold-solution .study-fold-tag{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.28)}
.study-fold-error .study-fold-tag{color:#ad4e00;background:rgba(250,140,22,.12);border-color:rgba(250,140,22,.3)}
.study-fold-title{flex:1;min-width:0;color:rgba(128,128,128,1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-fold-arrow{flex:none;font-size:12px;color:var(--accent)}
.study-fold-body{padding:.2em 1em 1em;border-top:1px dashed var(--line);margin-top:.1em}
.study-fold-body>*:first-child{margin-top:.8em}

/* ---- 概览 ---- */
.study-overview-progress{display:flex;align-items:center;gap:.75em;margin:.4em 0 1.4em;max-width:860px}
.study-bar{flex:1;height:6px;border-radius:999px;background:rgba(128,128,128,.18);overflow:hidden}
.study-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#1677ff,#52c41a);transition:width .3s}
.study-progress-text{font-size:12px;color:rgba(128,128,128,1);white-space:nowrap}
.study-weeks{margin:2.4em 0 2em;max-width:860px}
.study-section-title{font-size:1.15em;font-weight:650;margin-bottom:.8em}
.study-stage{margin-bottom:1.4em}
.study-stage-name{font-size:12px;font-weight:600;letter-spacing:.04em;color:rgba(128,128,128,1);margin:.2em 0 .6em;padding-left:.2em}
.study-week-list{display:flex;flex-direction:column;gap:.5em}
.study-week-row{display:flex;align-items:center;gap:.9em;width:100%;text-align:left;padding:.75em .9em;border:1px solid var(--line);border-radius:10px;background:rgba(128,128,128,.03);cursor:pointer;color:inherit;transition:border-color .15s,background .15s}
.study-week-row:hover{border-color:rgba(22,119,255,.45);background:rgba(22,119,255,.06)}
.study-week-no{flex:none;font-size:12px;font-weight:600;color:var(--accent);min-width:4.2em}
.study-week-main{display:flex;flex-direction:column;gap:.15em;min-width:0;flex:1}
.study-week-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-goal{font-size:12px;color:rgba(128,128,128,1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-meta{flex:none;display:inline-flex;gap:.6em;align-items:center;font-size:12px;color:rgba(128,128,128,1)}
.study-week-done{color:#237804;background:rgba(82,196,26,.14);border-radius:999px;padding:.05em .5em}

/* ---- 步骤 ---- */
.study-steps{display:flex;flex-direction:column;gap:1.6em;margin-top:1.6em}
.study-step{border:1px solid var(--line);border-left:3px solid rgba(128,128,128,.35);border-radius:10px;padding:1em 1.2em 1.2em;scroll-margin-top:76px;transition:border-color .2s}
.study-step.is-done{border-left-color:#52c41a;background:rgba(82,196,26,.045)}
.study-step-head{display:flex;align-items:center;gap:.6em}
.study-step-label{font-size:12px;font-weight:600;color:var(--accent);white-space:nowrap}
.study-step-title{margin:0;font-size:1.05em;font-weight:650;line-height:1.5}
.study-step.is-done .study-step-title{color:rgba(128,128,128,1)}
.study-step-body{margin-top:.2em}
.study-pager{display:flex;justify-content:space-between;gap:1em;margin:2.6em 0 1em}

/* ---- highlight.js token（亮色） ---- */
.study-doc .hljs-comment,.study-doc .hljs-quote{color:#6e7781;font-style:italic}
.study-doc .hljs-keyword,.study-doc .hljs-selector-tag,.study-doc .hljs-literal,.study-doc .hljs-doctag{color:#cf222e}
.study-doc .hljs-string,.study-doc .hljs-regexp,.study-doc .hljs-addition{color:#0a3069}
.study-doc .hljs-number,.study-doc .hljs-symbol,.study-doc .hljs-bullet{color:#0550ae}
.study-doc .hljs-title,.study-doc .hljs-section,.study-doc .hljs-name{color:#8250df}
.study-doc .hljs-attr,.study-doc .hljs-attribute,.study-doc .hljs-variable,.study-doc .hljs-template-variable{color:#953800}
.study-doc .hljs-type,.study-doc .hljs-built_in,.study-doc .hljs-class .hljs-title{color:#953800}
.study-doc .hljs-tag{color:#116329}
.study-doc .hljs-meta{color:#6e7781}
.study-doc .hljs-deletion{color:#82071e;background:rgba(255,129,130,.1)}
.study-doc .hljs-emphasis{font-style:italic}
.study-doc .hljs-strong{font-weight:700}

/* ---- highlight.js token（深色） ---- */
.dark .study-doc .hljs-comment,.dark .study-doc .hljs-quote{color:#8b949e}
.dark .study-doc .hljs-keyword,.dark .study-doc .hljs-selector-tag,.dark .study-doc .hljs-literal,.dark .study-doc .hljs-doctag{color:#ff7b72}
.dark .study-doc .hljs-string,.dark .study-doc .hljs-regexp,.dark .study-doc .hljs-addition{color:#a5d6ff}
.dark .study-doc .hljs-number,.dark .study-doc .hljs-symbol,.dark .study-doc .hljs-bullet{color:#79c0ff}
.dark .study-doc .hljs-title,.dark .study-doc .hljs-section,.dark .study-doc .hljs-name{color:#d2a8ff}
.dark .study-doc .hljs-attr,.dark .study-doc .hljs-attribute,.dark .study-doc .hljs-variable,.dark .study-doc .hljs-template-variable{color:#ffa657}
.dark .study-doc .hljs-type,.dark .study-doc .hljs-built_in,.dark .study-doc .hljs-class .hljs-title{color:#ffa657}
.dark .study-doc .hljs-tag{color:#7ee787}
.dark .study-doc .hljs-meta{color:#8b949e}
`
