"use client"
// 学习路线阅读器：概览（周列表）/ 单周（步骤卡片）/ 折叠的「思路 · 代码答案 · 常见报错」/ 步骤打勾。
//
// 分工：Markdown 解析与语法高亮在服务端（study-render.ts），这里只处理交互与状态。
// 周用 ?week=N 切换，而不是子路由 —— 页面守卫是 page 精确匹配，子路由要逐条登记权限（见 page.tsx 注释）。
//
// 视觉原则（2026-10-18 重排）：**只允许一层盒子**。
//   步骤卡片 = 唯一的容器；思路/代码/报错 = 卡片内的分隔行（不是又一个盒子）；
//   代码块自带边框，所以它外面的折叠区必须保持无边框，否则就是三层嵌套。
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Checkbox } from "antd"
import { AdminPage } from "@/components/admin"
import type { StudyData, StudyDoc, StudyPart, StudyWeek, TocItem } from "@/lib/study"

const FOLD_META = {
	hint: { tag: "思路", hint: "想不明白再点开" },
	solution: { tag: "代码 / 答案", hint: "参考实现" },
	error: { tag: "常见报错", hint: "报错了对着看" },
} as const

type NavItem = TocItem & { no?: string }

export default function StudyReader({ doc, data }: { doc: StudyDoc; data: StudyData }) {
	const router = useRouter()
	const sp = useSearchParams()
	const raw = sp.get("week")
	const weekN = raw && /^\d+$/.test(raw) ? Number(raw) : null
	const week = weekN === null ? null : data.weeks.find((w) => w.n === weekN) || null

	const [open, setOpen] = useState<Record<string, boolean>>({})
	const [progress, setProgress] = useState<Record<string, boolean>>({})
	const storageKey = `study.progress.${doc.lang}${doc.rev ? `.${doc.rev}` : ""}`

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

	/**
	 * 回「全部周次」。
	 *
	 * 为什么要带兜底：周是 `?week=N` 的查询参数，而"回到没有查询参数的同一个路径"依赖客户端路由
	 * 真的把 search 清掉。实际用下来出现过点了没反应的情况（尤其从菜单再点一次、或页面被缓存时）。
	 * 所以先走客户端路由（快），400ms 后如果地址栏还带着 week=，就直接整页跳转 —— 一定会回到概览。
	 */
	const backToOverview = useCallback(() => {
		router.push(`/study/${doc.lang}`)
		window.setTimeout(() => {
			if (window.location.search.includes("week=")) {
				window.location.href = window.location.pathname
			}
		}, 400)
	}, [router, doc.lang])

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
			collect(week.outro, `o${week.n}`)
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

	const toc: NavItem[] = useMemo(() => {
		if (week) {
			return week.steps.map((s) => ({
				id: `step-${s.id}`,
				text: s.title,
				level: 3,
				no: s.label.replace(/^步骤\s*/, ""),
			}))
		}
		return [...data.tocIntro, { id: "weeks", text: "全部周次", level: 2 }, ...data.tocAppendix]
	}, [week, data])

	const [active, setActive] = useState("")
	const tocRef = useRef<HTMLElement | null>(null)

	/**
	 * 当前章节高亮。
	 *
	 * 不用 IntersectionObserver：它观察的是**挂载时抓到的那些 DOM 节点**，而本页的正文是
	 * dangerouslySetInnerHTML 渲染的，内容一旦被整体替换（数据刷新、Suspense 重挂载），
	 * 观察器手里就是一批已经脱离文档的旧节点 —— 表现正是「只有 React 渲染的 #weeks 会亮，其余永远不亮」。
	 *
	 * 改成滚动时按位置现算：每次都用 getElementById 重新取当前节点，节点被换掉也不影响；
	 * 13 个标题的 getBoundingClientRect 开销可以忽略，且用 rAF 合并滚动事件。
	 */
	useEffect(() => {
		let raf = 0
		const compute = () => {
			raf = 0
			const els = toc.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => el !== null)
			if (!els.length) return
			// 判定线放在 Header（56）下方一点：最后一个「顶边越过这条线」的标题就是当前章节
			const line = 88
			let current = els[0].id
			for (const el of els) {
				if (el.getBoundingClientRect().top <= line) current = el.id
				else break
			}
			setActive(current)
		}
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(compute)
		}
		compute()
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("resize", onScroll)
		return () => {
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("resize", onScroll)
			if (raf) cancelAnimationFrame(raf)
		}
	}, [toc])

	// 高亮项如果滚出目录可视区，把目录自己滚过去（不带动页面；页面上长文档一滚，目录就会「跟丢」）
	useEffect(() => {
		if (!active) return
		const box = tocRef.current
		if (!box) return
		const link = box.querySelector<HTMLElement>(`.study-toc-link[href="#${CSS.escape(active)}"]`)
		if (!link) return
		const r = link.getBoundingClientRect()
		const c = box.getBoundingClientRect()
		if (r.top < c.top + 4) box.scrollTop -= c.top + 4 - r.top
		else if (r.bottom > c.bottom - 4) box.scrollTop += r.bottom - c.bottom + 4
	}, [active])

	const nav = (
		<>
			<div className="study-toc-title">{week ? "本周步骤" : "目录"}</div>
			<nav className="study-toc-list">
				{toc.map((t) => (
					<a
						key={t.id}
						href={`#${t.id}`}
						onClick={() => setActive(t.id)}
						className={`study-toc-link${active === t.id ? " is-active" : ""}`}
						title={t.text}
					>
						{t.no && <span className="study-toc-no">{t.no}</span>}
						<span className="study-toc-text">{t.text}</span>
					</a>
				))}
			</nav>
		</>
	)

	const headerExtra = (
		<span className="study-actions">
			<span className="study-progress-chip">
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
				<span className="study-title">
					{week && (
						<button
							type="button"
							className="study-back-btn"
							onClick={backToOverview}
							title="返回全部周次"
							aria-label="返回全部周次"
						>
							←
						</button>
					)}
					<span className="study-title-icon">{doc.icon}</span>
					<span>{week ? `第 ${week.n} 周 · ${week.title}` : doc.title}</span>
				</span>
			}
			description={week ? week.stage || `本周 ${week.steps.length} 个步骤` : doc.subtitle}
			extra={headerExtra}
		>
			<style>{STUDY_CSS}</style>
			<div className="study-doc">
				<div className="study-layout">
					<aside className="study-toc" ref={tocRef}>{nav}</aside>
					<article className="study-content">
						<details className="study-mobile-toc">
							<summary>{week ? "本周步骤" : "目录"}</summary>
							<div className="study-mobile-toc-body">{nav}</div>
						</details>

						{week ? (
							<WeekView
								week={week}
								progress={progress}
								onToggle={toggleStep}
								renderParts={renderParts}
								prev={data.weeks[data.weeks.findIndex((w) => w.n === week.n) - 1]}
								next={data.weeks[data.weeks.findIndex((w) => w.n === week.n) + 1]}
								onGo={goWeek}
							/>
						) : (
							<Overview data={data} pct={pct} doneTotal={doneTotal} renderParts={renderParts} doneOf={doneOf} onOpen={goWeek} />
						)}
					</article>
				</div>

				{/* 长文档滚到任何位置都能一键回概览：正文顶部的按钮会滚出视口 */}
				{week && (
					<button type="button" className="study-fab" onClick={backToOverview} title="返回全部周次">
						← 返回概览
					</button>
				)}
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
			<div className="study-overview-top">
				<div className="study-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
					<div className="study-bar-fill" style={{ width: `${pct}%` }} />
				</div>
				<span className="study-overview-pct">
					{doneTotal}/{data.totalSteps} 步
				</span>
			</div>

			<div className="study-flow">{renderParts(data.intro, "intro")}</div>

			<section id="weeks">
				<h2 className="study-section-title">全部周次</h2>
				{groups.map((g) => (
					<div key={g.stage || "all"} className="study-stage">
						<div className="study-stage-name">{g.stage || "主线"}</div>
						<div className="study-week-list">
							{g.weeks.map((w) => {
								const done = doneOf(w)
								return (
									<button key={w.n} type="button" className="study-week-row" onClick={() => onOpen(w.n)}>
										<span className={`study-week-no${done === w.steps.length && done > 0 ? " is-done" : ""}`}>
											{String(w.n).padStart(2, "0")}
										</span>
										<span className="study-week-main">
											<span className="study-week-title">{w.title}</span>
											{w.goal && <span className="study-week-goal">{w.goal}</span>}
										</span>
										<span className="study-week-side">
											{done > 0 ? (
												<span className="study-week-count is-done">
													{done}/{w.steps.length}
												</span>
											) : (
												<span className="study-week-count">{w.steps.length} 步</span>
											)}
											<span className="study-week-arrow">→</span>
										</span>
									</button>
								)
							})}
						</div>
					</div>
				))}
			</section>

			<div className="study-flow">{renderParts(data.appendix, "appendix")}</div>
		</>
	)
}

// --------------------------------------------------------------------- 单周

function WeekView({
	week,
	progress,
	onToggle,
	renderParts,
	prev,
	next,
	onGo,
}: {
	week: StudyWeek
	progress: Record<string, boolean>
	onToggle: (id: string) => void
	renderParts: (parts: StudyPart[], scope: string) => ReactNode
	prev?: StudyWeek
	next?: StudyWeek
	onGo: (n: number | null) => void
}) {
	const done = week.steps.filter((s) => progress[s.id]).length

	return (
		<div className="study-week">
			<div className="study-week-head">
				<p className="study-week-goal">
					<span className="study-week-goal-label">本周目标</span>
					{week.goal || "按步骤完成本周任务，最后过一遍验收清单。"}
				</p>
				<span className="study-week-count">
					{done}/{week.steps.length} 步
				</span>
			</div>

			{week.parts.length > 0 && <div className="study-flow">{renderParts(week.parts, `w${week.n}`)}</div>}

			<div className="study-steps">
				{week.steps.map((s) => {
					const isDone = !!progress[s.id]
					return (
						<section key={s.id} id={`step-${s.id}`} className={`study-step${isDone ? " is-done" : ""}`}>
							<div className="study-step-head">
								<span className="study-step-no">{s.label.replace(/^步骤\s*/, "")}</span>
								<h4 className="study-step-title">{s.title}</h4>
								<Checkbox className="study-step-check" checked={isDone} onChange={() => onToggle(s.id)}>
									{isDone ? "已完成" : "完成"}
								</Checkbox>
							</div>
							<div className="study-step-body">{renderParts(s.parts, `s${s.id}`)}</div>
						</section>
					)
				})}
			</div>

			{week.outro.length > 0 && <div className="study-flow study-week-outro">{renderParts(week.outro, `o${week.n}`)}</div>}

			<nav className="study-pager">
				{prev ? (
					<button type="button" className="study-pager-btn" onClick={() => onGo(prev.n)}>
						<span className="study-pager-dir">上一周</span>
						<span className="study-pager-title">
							第 {prev.n} 周 · {prev.title}
						</span>
					</button>
				) : (
					<span />
				)}
				{next ? (
					<button type="button" className="study-pager-btn is-next" onClick={() => onGo(next.n)}>
						<span className="study-pager-dir">下一周</span>
						<span className="study-pager-title">
							第 {next.n} 周 · {next.title}
						</span>
					</button>
				) : (
					<span />
				)}
			</nav>
		</div>
	)
}

// --------------------------------------------------------------------- 样式

/**
 * 阅读区样式（只作用于 `.study-doc`，不动全局 MD_BODY_CSS）。
 *
 * 结构上只留一层盒子：卡片（步骤 / 周行）之外不再套边框；折叠区是卡片内的分隔行。
 * 颜色一律 currentColor + 半透明灰，`--card` 是唯一需要区分深浅色的变量。
 */
const STUDY_CSS = `
.study-doc{
  --line:rgba(128,128,128,.18);
  --line-strong:rgba(128,128,128,.3);
  --soft:rgba(128,128,128,.06);
  --code:rgba(128,128,128,.09);
  --card:#ffffff;
  --accent:#1677ff;
  --ok:#237804;
  /* 目录：亮色下要「深而清楚」，深色下要「浅而清楚」——所以两组值分开给，不靠 opacity 压暗 */
  --toc-text:#3f3f46;
  --toc-sub:#71717a;
  --toc-active:#0958d9;
  --toc-active-bg:rgba(22,119,255,.08);
  --toc-hover:#0958d9;
  --toc-hover-bg:rgba(22,119,255,.06);
  --muted:#6b7280;
}
.dark .study-doc{
  --line:rgba(255,255,255,.12);
  --line-strong:rgba(255,255,255,.22);
  --soft:rgba(255,255,255,.06);
  --code:rgba(255,255,255,.07);
  --card:#1f1f1f;
  --ok:#95de64;
  --toc-text:#e4e4e7;
  --toc-sub:#a1a1aa;
  --toc-active:#69b1ff;
  --toc-active-bg:rgba(22,119,255,.18);
  --toc-hover:#69b1ff;
  --toc-hover-bg:rgba(255,255,255,.07);
  --muted:#a1a1aa;
}

/* ---- 布局 ---- */
.study-layout{display:flex;align-items:flex-start;gap:34px}
/* sticky 的 top 必须让开 56px 的固定 Header，否则滚动后目录上半截会被 Header 盖住 */
.study-toc{position:sticky;top:72px;flex:none;width:236px;max-height:calc(100vh - 88px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding-right:18px;border-right:1px solid var(--line)}
.study-toc-title{font-size:11px;font-weight:600;letter-spacing:.09em;color:var(--toc-sub);padding:0 10px;margin-bottom:10px}
.study-toc-list{display:flex;flex-direction:column;gap:1px}
.study-toc-link{display:flex;align-items:baseline;gap:8px;padding:7px 10px;border-radius:8px;border-left:2px solid transparent;color:var(--toc-text);text-decoration:none;font-size:13px;line-height:1.5;transition:background .12s,color .12s}
.study-toc-link:hover{background:var(--toc-hover-bg);color:var(--toc-hover)}
.study-toc-link.is-active{color:var(--toc-active);background:var(--toc-active-bg);border-left-color:var(--toc-active);font-weight:600}
.study-toc-no{flex:none;min-width:24px;font-size:11px;font-variant-numeric:tabular-nums;color:var(--toc-sub);font-weight:500}
.study-toc-link.is-active .study-toc-no{color:inherit;opacity:.85}
.study-toc-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-content{min-width:0;flex:1}
.study-mobile-toc{display:none;margin-bottom:18px;border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.study-mobile-toc summary{cursor:pointer;font-size:13px;color:var(--toc-text)}
.study-mobile-toc-body{padding-top:10px}
@media(max-width:1279px){
  .study-toc{display:none}
  .study-mobile-toc{display:block}
}

/* ---- 标题区 ---- */
.study-title{display:inline-flex;align-items:center;gap:10px}
.study-title-icon{font-size:1.1em}
.study-actions{display:inline-flex;align-items:center;gap:10px}
.study-progress-chip{font-size:12px;color:var(--muted);background:var(--soft);border-radius:999px;padding:3px 10px;white-space:nowrap}

/* ---- 正文排版 ---- */
.study-doc .md-body{font-size:15.5px;line-height:1.85;letter-spacing:.005em;max-width:860px}
.study-doc .md-body h2{font-size:1.42em;font-weight:650;letter-spacing:-.01em;margin:2.2em 0 .7em;padding-bottom:.3em;border-bottom:1px solid var(--line)}
.study-doc .md-body h2:first-child{margin-top:.3em}
.study-doc .md-body h3{font-size:1.14em;font-weight:650;margin:1.8em 0 .5em}
.study-doc .md-body h4{font-size:1em;font-weight:650;margin:1.4em 0 .4em}
.study-doc .md-body p{margin:.7em 0}
.study-doc .md-body ul,.study-doc .md-body ol{padding-left:1.45em;margin:.55em 0}
.study-doc .md-body li{margin:.3em 0}
.study-doc .md-body li>p{margin:.2em 0}
.study-doc .md-body strong{font-weight:650}
.study-doc .md-body code{background:var(--code);padding:.16em .4em;border-radius:5px;font-size:.875em;font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
.study-doc .md-body pre{background:var(--code);border:1px solid var(--line);padding:14px 16px;border-radius:10px;overflow:auto;margin:.9em 0;line-height:1.62}
.study-doc .md-body pre code{background:none;padding:0;font-size:.86em}
.study-doc .md-body blockquote{margin:1.1em 0;padding:12px 16px;border-left:3px solid rgba(22,119,255,.45);background:rgba(22,119,255,.05);border-radius:0 10px 10px 0}
.study-doc .md-body blockquote p{margin:.25em 0}
.study-doc .md-body table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.93em}
.study-doc .md-body th,.study-doc .md-body td{border:1px solid var(--line);padding:.5em .78em;text-align:left;vertical-align:top}
.study-doc .md-body thead th{background:var(--soft);font-weight:600;white-space:nowrap}
.study-doc .md-body tbody tr:nth-child(2n){background:rgba(128,128,128,.04)}
.study-doc .md-body hr{border:none;border-top:1px solid var(--line);margin:2em 0}
.study-doc .md-body a{color:var(--accent);text-decoration:none}
.study-doc .md-body a:hover{text-decoration:underline}
.study-doc .md-body img{max-width:100%;border-radius:8px}
.study-doc .md-body h2,.study-doc .md-body h3{scroll-margin-top:76px}

/* ---- 折叠行（卡片内分隔行，不再套盒子） ---- */
.study-fold{margin:0;padding:0;border:0;background:none}
.study-fold-head{display:flex;align-items:center;gap:10px;width:100%;padding:11px 0;border:0;border-top:1px solid var(--line);background:none;cursor:pointer;text-align:left;color:inherit;font-size:13.5px;line-height:1.5}
.study-fold:first-child .study-fold-head{border-top:0}
.study-fold-head:hover .study-fold-title{opacity:1;color:var(--accent)}
.study-fold-tag{flex:none;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:600;border:1px solid transparent;letter-spacing:.02em}
.study-fold-hint .study-fold-tag{color:#0958d9;background:rgba(22,119,255,.1);border-color:rgba(22,119,255,.22)}
.study-fold-solution .study-fold-tag{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.26)}
.study-fold-error .study-fold-tag{color:#ad4e00;background:rgba(250,140,22,.12);border-color:rgba(250,140,22,.28)}
.study-fold-title{flex:1;min-width:0;opacity:.82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .12s,opacity .12s}
.study-fold-arrow{flex:none;font-size:12px;color:var(--accent);opacity:.85}
.study-fold-body{padding:2px 0 12px}

/* ---- 概览 ---- */
.study-overview-top{display:flex;align-items:center;gap:14px;max-width:900px;margin:0 0 26px}
.study-bar{flex:1;height:6px;border-radius:999px;background:rgba(128,128,128,.16);overflow:hidden}
.study-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#1677ff,#52c41a);transition:width .3s}
.study-overview-pct{font-size:12px;color:var(--muted);white-space:nowrap}
.study-flow{max-width:860px}
.study-section-title{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:600;margin:40px 0 18px;scroll-margin-top:76px}
.study-section-title::after{content:"";flex:1;height:1px;background:var(--line)}
.study-stage{margin-bottom:26px}
.study-stage-name{display:flex;align-items:center;gap:12px;font-size:11.5px;font-weight:600;letter-spacing:.08em;color:var(--muted);margin:0 0 10px}
.study-stage-name::after{content:"";flex:1;height:1px;background:var(--line)}
.study-week-list{display:flex;flex-direction:column;gap:10px;max-width:900px}
.study-week-row{display:flex;align-items:center;gap:14px;width:100%;padding:13px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card);cursor:pointer;text-align:left;color:inherit;transition:border-color .16s,box-shadow .16s,transform .16s}
.study-week-row:hover{border-color:rgba(22,119,255,.45);box-shadow:0 6px 18px rgba(0,0,0,.07);transform:translateY(-1px)}
.dark .study-week-row:hover{box-shadow:none}
.study-week-no{flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--soft);color:var(--accent);font-size:14px;font-weight:650;font-variant-numeric:tabular-nums}
.study-week-no.is-done{background:rgba(82,196,26,.14);color:var(--ok)}
.study-week-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.study-week-title{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-goal{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-week-side{flex:none;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)}
.study-week-count.is-done{color:var(--ok);background:rgba(82,196,26,.14);border-radius:999px;padding:1px 8px}
.study-week-arrow{color:var(--accent);opacity:0;transform:translateX(-4px);transition:.16s;font-size:14px}
.study-week-row:hover .study-week-arrow{opacity:1;transform:none}

/* ---- 单周 ---- */
.study-week-head{display:flex;align-items:flex-start;gap:16px;max-width:900px;padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:22px}
.study-week-goal{flex:1;margin:0;font-size:14px;line-height:1.75;opacity:.92}
.study-week-goal-label{display:inline-block;margin-right:8px;padding:1px 7px;border-radius:6px;background:rgba(22,119,255,.1);color:var(--accent);font-size:11px;font-weight:600;letter-spacing:.04em;vertical-align:1px}
.study-week-head .study-week-count{flex:none;font-size:12px;color:var(--muted);padding-top:3px;white-space:nowrap}
.study-steps{display:flex;flex-direction:column;gap:18px;max-width:900px;margin-top:22px}
.study-step{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);scroll-margin-top:76px;transition:border-color .18s}
.dark .study-step{box-shadow:none}
.study-step:hover{border-color:var(--line-strong)}
.study-step.is-done{border-color:rgba(82,196,26,.45)}
.study-step-head{display:flex;align-items:center;gap:10px;padding:14px 18px 0}
.study-step-no{flex:none;display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:40px;padding:0 8px;border-radius:7px;background:rgba(22,119,255,.1);color:var(--accent);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.study-step-title{flex:1;margin:0;font-size:15.5px;font-weight:600;line-height:1.5}
.study-step-check{flex:none;font-size:12px;opacity:.8}
.study-step-check .ant-checkbox-wrapper,.study-step-check.ant-checkbox-wrapper{font-size:12px}
.study-step-body{padding:6px 18px 14px}
.study-step-body .md-body{font-size:14.5px;line-height:1.8}
.study-week-outro{margin-top:26px}
.study-pager{display:flex;justify-content:space-between;gap:14px;max-width:900px;margin:34px 0 8px}
.study-pager-btn{display:flex;flex-direction:column;gap:2px;align-items:flex-start;max-width:46%;padding:11px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:inherit;cursor:pointer;text-align:left;transition:border-color .16s}
.study-pager-btn:hover{border-color:rgba(22,119,255,.45)}
.study-pager-btn.is-next{align-items:flex-end;text-align:right;margin-left:auto}
.study-pager-dir{font-size:11px;letter-spacing:.06em;color:var(--muted)}
.study-pager-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}

/* ---- 返回入口（头部按钮 + 悬浮球） ---- */
.study-back-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:8px;border:1px solid var(--line);background:var(--soft);color:inherit;font-size:15px;line-height:1;cursor:pointer;transition:border-color .15s,color .15s}
.study-back-btn:hover{border-color:rgba(22,119,255,.5);color:var(--accent)}
.study-fab{position:fixed;right:24px;bottom:24px;z-index:30;display:inline-flex;align-items:center;gap:.35em;padding:.55em 1em;border-radius:999px;border:1px solid rgba(22,119,255,.4);background:#1677ff;color:#fff;font-size:13px;line-height:1.4;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)}
.study-fab:hover{background:#0958d9}

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
