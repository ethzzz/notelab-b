"use client"
// 学习路线阅读器（周计划）：总览（周列表 / 进度）/ 单周（步骤 + 折叠区）/ 步骤打勾。
//
// 分工：Markdown 解析与语法高亮在服务端（study-render.ts），这里只处理交互与状态。
// 周用 ?week=N 切换，而不是子路由 —— 页面守卫是 page 精确匹配，子路由要逐条登记权限（见 page.tsx 注释）。
//
// 排版与「编程学习」「实践项目」共用 DocShell / DOC_CSS：
// 左侧常驻整条路线的周次目录（替代原先只列当前页章节的目录），
// 当前周会展开「本周步骤」锚点；正文用文档排版，折叠区是正文里的分隔行。
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Checkbox } from "antd"
import { DocHtml, DocPager, DocShell } from "@/components/doc"
import { FOLD_LABELS, type StudyData, type StudyDoc, type StudyPart, type StudyWeek } from "@/lib/study"

const FOLD_META = {
	hint: { tag: FOLD_LABELS.hint, hint: "想不明白再点开" },
	solution: { tag: FOLD_LABELS.solution, hint: "参考实现" },
	error: { tag: FOLD_LABELS.error, hint: "报错了对着看" },
	check: { tag: FOLD_LABELS.check, hint: "跑一遍看结果" },
} as const

export default function StudyReader({ doc, data }: { doc: StudyDoc; data: StudyData }) {
	const router = useRouter()
	const sp = useSearchParams()
	const raw = sp.get("week")
	const weekN = raw && /^\d+$/.test(raw) ? Number(raw) : null
	const week = weekN === null ? null : data.weeks.find((w) => w.n === weekN) || null

	const [open, setOpen] = useState<Record<string, boolean>>({})
	const [progress, setProgress] = useState<Record<string, boolean>>({})
	const [activeStep, setActiveStep] = useState("")
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

	const goWeek = useCallback(
		(n: number | null) => {
			router.push(n === null ? `/study/${doc.lang}` : `/study/${doc.lang}?week=${n}`, { scroll: false })
		},
		[router, doc.lang],
	)

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
			if (p.type === "md") return <DocHtml key={i} html={p.html} />
			const key = `${scope}:${i}`
			const isOpen = !!open[key]
			const meta = FOLD_META[p.kind]
			return (
				<div key={i} className={`doc-fold doc-fold-${p.kind}`}>
					<button
						type="button"
						className="doc-fold-head"
						aria-expanded={isOpen}
						onClick={() => setOpen((s) => ({ ...s, [key]: !isOpen }))}
					>
						<span className="doc-fold-tag">{meta.tag}</span>
						<span className="doc-fold-title">{p.title || meta.hint}</span>
						<span className="doc-fold-arrow">{isOpen ? "收起" : "展开"}</span>
					</button>
					{isOpen && <div className="doc-fold-body"><DocHtml html={p.html} /></div>}
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
			Object.entries(data.stageIntros).forEach(([name, parts]) => collect(parts, `st:${name}`))
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

	// ---------------------------------------------------------------- 当前步骤高亮

	/**
	 * 当前步骤高亮。
	 *
	 * 不用 IntersectionObserver：它观察的是**挂载时抓到的那些 DOM 节点**，而本页正文
	 * 用 dangerouslySetInnerHTML 渲染，内容一旦被整体替换（数据刷新、Suspense 重挂载），
	 * 观察器手里就是一批已经脱离文档的旧节点。
	 * 改成滚动时按位置现算：每次 getElementById 重新取，节点被换掉也不影响。
	 */
	useEffect(() => {
		if (!week) return
		let raf = 0
		const ids = week.steps.map((s) => `step-${s.id}`)
		const compute = () => {
			raf = 0
			const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
			if (!els.length) return
			// 判定线放在 Header（56）下方一点：最后一个「顶边越过这条线」的章节就是当前章节
			const line = 88
			let current = els[0].id
			for (const el of els) {
				if (el.getBoundingClientRect().top <= line) current = el.id
				else break
			}
			setActiveStep(current)
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
	}, [week])

	// ---------------------------------------------------------------- 侧栏

	/** 按阶段分组（顺序即文档顺序） */
	const groups = useMemo(() => {
		const out: { stage: string; weeks: StudyWeek[] }[] = []
		for (const w of data.weeks) {
			const last = out[out.length - 1]
			if (last && last.stage === w.stage) last.weeks.push(w)
			else out.push({ stage: w.stage, weeks: [w] })
		}
		return out
	}, [data.weeks])

	const nav = (
		<>
			<div className="doc-nav-title">学习路线</div>
			<div className="doc-nav-section">
				<button
					type="button"
					className={`doc-nav-item is-flat${!week ? " is-active" : ""}`}
					onClick={backToOverview}
				>
					<span className="doc-nav-icon">{doc.icon}</span>
					<span className="doc-nav-text">总览</span>
					<span className="doc-nav-meta">{pct}%</span>
				</button>
			</div>

			{groups.map((g, gi) => (
				<div key={`${g.stage || "main"}-${gi}`} className="doc-nav-section">
					<div className="doc-nav-heading">{g.stage || "主线"}</div>
					<div className="doc-nav-list">
						{g.weeks.map((w) => {
							const done = doneOf(w)
							const allDone = done === w.steps.length && done > 0
							return (
								<Fragment key={w.n}>
									<button
										type="button"
										data-week={w.n}
										className={`doc-nav-item is-flat${week?.n === w.n ? " is-active" : ""}`}
										onClick={() => goWeek(w.n)}
										title={`第 ${w.n} 周 · ${w.title}`}
									>
										<span className="doc-nav-num">{String(w.n).padStart(2, "0")}</span>
										<span className="doc-nav-text">{w.title}</span>
										<span className="doc-nav-meta">{allDone ? "✓" : `${done}/${w.steps.length}`}</span>
									</button>
									{/* 本周步骤紧跟当前周展开，而不是堆到整条路线的末尾 */}
									{week && week.n === w.n && week.steps.length > 0 && (
										<div className="doc-nav-sub">
											{week.steps.map((s) => {
												const id = `step-${s.id}`
												return (
													<a
														key={s.id}
														href={`#${id}`}
														className={`doc-nav-item is-sub${activeStep === id ? " is-active" : ""}`}
														onClick={() => setActiveStep(id)}
														title={s.title}
													>
														<span className="doc-nav-num">{s.label.replace(/^步骤\s*/, "")}</span>
														<span className="doc-nav-text">{s.title}</span>
														{progress[s.id] && <span className="doc-nav-meta">✓</span>}
													</a>
												)
											})}
										</div>
									)}
								</Fragment>
							)
						})}
					</div>
				</div>
			))}

			{doc.track && (
				<Link href={`/learning?track=${doc.track}`} className="doc-nav-item is-flat">
					<span className="doc-nav-icon">🎓</span>
					<span className="doc-nav-text">{doc.trackLabel || "配套课程"}</span>
				</Link>
			)}
		</>
	)

	// 当前周可能排到目录很靠下的位置（第 17 周），把侧栏滚到它附近；只动侧栏，不带动正文
	useEffect(() => {
		if (!week) return
		document.querySelectorAll<HTMLElement>(".doc-aside").forEach((box) => {
			const el = box.querySelector<HTMLElement>(`[data-week="${week.n}"]`)
			if (!el) return
			const r = el.getBoundingClientRect()
			const c = box.getBoundingClientRect()
			if (r.top < c.top + 8) box.scrollTop -= c.top + 8 - r.top
			else if (r.bottom > c.bottom - 8) box.scrollTop += r.bottom - c.bottom + 8
		})
	}, [week])

	return (
		<>
			<DocShell aside={nav} asideTitle="学习路线">
				{week ? (
					<WeekView
						doc={doc}
						week={week}
						progress={progress}
						onToggle={toggleStep}
						renderParts={renderParts}
						prev={data.weeks[data.weeks.findIndex((w) => w.n === week.n) - 1]}
						next={data.weeks[data.weeks.findIndex((w) => w.n === week.n) + 1]}
						onGo={goWeek}
						foldCount={allFoldKeys.length}
						anyOpen={anyOpen}
						onToggleAll={toggleAll}
					/>
				) : (
					<Overview
						doc={doc}
						data={data}
						groups={groups}
						pct={pct}
						doneTotal={doneTotal}
						renderParts={renderParts}
						doneOf={doneOf}
						onOpen={goWeek}
					/>
				)}
			</DocShell>

			{/* 长文档滚到任何位置都能一键回总览：头部入口会滚出视口 */}
			{week && (
				<button type="button" className="doc-fab" onClick={backToOverview} title="返回全部周次">
					← 返回总览
				</button>
			)}
		</>
	)
}

// --------------------------------------------------------------------- 总览

function Overview({
	doc,
	data,
	groups,
	pct,
	doneTotal,
	renderParts,
	doneOf,
	onOpen,
}: {
	doc: StudyDoc
	data: StudyData
	groups: { stage: string; weeks: StudyWeek[] }[]
	pct: number
	doneTotal: number
	renderParts: (parts: StudyPart[], scope: string) => ReactNode
	doneOf: (w: StudyWeek) => number
	onOpen: (n: number) => void
}) {
	return (
		<article>
			<header className="doc-hero">
				<div className="doc-kicker">学习路线 · 周计划</div>
				<h1 className="doc-hero-title">{doc.icon} {doc.title}</h1>
				<p className="doc-hero-desc">{doc.subtitle}</p>
				<div className="doc-hero-meta">
					<span>{data.weeks.length} 周</span>
					<span>{data.totalSteps} 个步骤</span>
					<span>已完成 {doneTotal}/{data.totalSteps}</span>
					{doc.track && (
						<Link className="doc-chip" href={`/learning?track=${doc.track}`}>
							{doc.trackLabel || "配套课程"} →
						</Link>
					)}
				</div>
			</header>

			<div className="doc-overview-top">
				<div className="doc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
					<div className="doc-bar-fill" style={{ width: `${pct}%` }} />
				</div>
				<span className="doc-overview-pct">{pct}%</span>
			</div>

			<div className="doc-flow">{renderParts(data.intro, "intro")}</div>

			<section id="weeks" className="doc-section">
				<div className="doc-section-head">
					<h2 className="doc-section-title">全部周次</h2>
					<span className="doc-section-count">{data.weeks.length} 周 · {data.totalSteps} 步</span>
				</div>
				{groups.map((g, gi) => (
					<div key={`${g.stage || "main"}-${gi}`} className="doc-stage">
						<div className="doc-stage-name">{g.stage || "主线"}</div>
						{data.stageIntros[g.stage] && (
							<div className="doc-stage-intro">{renderParts(data.stageIntros[g.stage], `st:${g.stage}`)}</div>
						)}
						<div className="doc-week-list">
							{g.weeks.map((w) => {
								const done = doneOf(w)
								const allDone = done === w.steps.length && done > 0
								return (
									<button key={w.n} type="button" className="doc-week-row" onClick={() => onOpen(w.n)}>
										<span className={`doc-week-no${allDone ? " is-done" : ""}`}>
											{String(w.n).padStart(2, "0")}
										</span>
										<span className="doc-week-main">
											<span className="doc-week-title">{w.title}</span>
											{w.goal && <span className="doc-week-goal">{w.goal}</span>}
										</span>
										<span className="doc-week-side">
											<span className={`doc-week-count${done > 0 ? " is-done" : ""}`}>
												{done > 0 ? `${done}/${w.steps.length}` : `${w.steps.length} 步`}
											</span>
											<span className="doc-week-arrow">→</span>
										</span>
									</button>
								)
							})}
						</div>
					</div>
				))}
			</section>

			<div className="doc-flow">{renderParts(data.appendix, "appendix")}</div>
		</article>
	)
}

// --------------------------------------------------------------------- 单周

function WeekView({
	doc,
	week,
	progress,
	onToggle,
	renderParts,
	prev,
	next,
	onGo,
	foldCount,
	anyOpen,
	onToggleAll,
}: {
	doc: StudyDoc
	week: StudyWeek
	progress: Record<string, boolean>
	onToggle: (id: string) => void
	renderParts: (parts: StudyPart[], scope: string) => ReactNode
	prev?: StudyWeek
	next?: StudyWeek
	onGo: (n: number | null) => void
	foldCount: number
	anyOpen: boolean
	onToggleAll: () => void
}) {
	const done = week.steps.filter((s) => progress[s.id]).length

	return (
		<article>
			<header className="doc-article-head">
				<div className="doc-kicker">{doc.title}{week.stage ? ` · ${week.stage}` : ""}</div>
				<h1 className="doc-article-title">第 {week.n} 周 · {week.title}</h1>
				<div className="doc-article-meta">
					<span className="doc-chip">{week.steps.length} 个步骤</span>
					<span className={`doc-chip${done === week.steps.length && done > 0 ? " is-ok" : ""}`}>
						已完成 {done}/{week.steps.length}
					</span>
					{foldCount > 0 && (
						<Button size="small" onClick={onToggleAll}>
							{anyOpen ? "全部收起" : "全部展开"}
						</Button>
					)}
					{doc.track && (
						<Link className="doc-chip" href={`/learning?track=${doc.track}`}>
							{doc.trackLabel || "配套课程"} →
						</Link>
					)}
				</div>
			</header>

			<div className="doc-week-head">
				<p className="doc-week-head-goal">
					<span className="doc-week-goal-label">本周目标</span>
					{week.goal || "按步骤完成本周任务，最后过一遍验收清单。"}
				</p>
				<span className="doc-chip">{done}/{week.steps.length} 步</span>
			</div>

			{week.parts.length > 0 && <div className="doc-flow">{renderParts(week.parts, `w${week.n}`)}</div>}

			{week.steps.map((s) => {
				const isDone = !!progress[s.id]
				return (
					<section key={s.id} id={`step-${s.id}`} className="doc-step">
						<div className="doc-step-head">
							<span className="doc-step-no">{s.label.replace(/^步骤\s*/, "")}</span>
							<h2 className="doc-step-title">{s.title}</h2>
							<Checkbox className="doc-step-check" checked={isDone} onChange={() => onToggle(s.id)}>
								{isDone ? "已完成" : "完成"}
							</Checkbox>
						</div>
						<div className="doc-step-body">{renderParts(s.parts, `s${s.id}`)}</div>
					</section>
				)
			})}

			{week.outro.length > 0 && (
				<div className="doc-week-outro">{renderParts(week.outro, `o${week.n}`)}</div>
			)}

			<DocPager
				prev={prev ? { label: "上一周", title: `第 ${prev.n} 周 · ${prev.title}`, onClick: () => onGo(prev.n) } : undefined}
				next={next ? { label: "下一周", title: `第 ${next.n} 周 · ${next.title}`, onClick: () => onGo(next.n) } : undefined}
			/>
		</article>
	)
}
