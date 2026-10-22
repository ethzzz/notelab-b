// 实践项目库（客户端交互层）：文档式索引 + 详情（`?p=<route>/<slug>`）。
//
// 详情用查询参数而不是子路由：B 端页面守卫是 pages.includes(pathname) 的精确匹配，
// 子路由要逐条登记权限；本项目对二级页的既有约定就是 ?id= / ?p=。
//
// 排版与「学习路线」「课程区」共用 DocShell / DOC_CSS：
// 左侧常驻整库目录（按业务方向分组），详情态在下方追加当前项目的正文目录。
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "antd"
import { DocHtml, DocPager, DocShell } from "@/components/doc"
import { FOLD_LABELS, type StudyPart } from "@/lib/study"
import type { StudyProject } from "@/lib/study-projects"

const ROUTES = [
	{ id: "all", label: "全部" },
	{ id: "java", label: "Java" },
	{ id: "go", label: "Go" },
	{ id: "react", label: "React" },
	{ id: "nextjs", label: "Next.js" },
] as const

const ROUTE_ORDER: Record<string, number> = { java: 0, go: 1, react: 2, nextjs: 3 }

function byTitle(a: StudyProject, b: StudyProject) {
	return a.title.localeCompare(b.title, "zh")
}

export default function ProjectsView({ projects, pid }: { projects: StudyProject[]; pid: string }) {
	const router = useRouter()

	const [route, setRoute] = useState<string>("all")
	const [direction, setDirection] = useState<string>("all")
	const [q, setQ] = useState("")
	/** 分组方式：默认按「业务方向」（这是读者找项目的入口），可切到按语言 */
	const [groupBy, setGroupBy] = useState<"direction" | "route">("direction")

	const [activeSection, setActiveSection] = useState("")
	const [copied, setCopied] = useState(false)

	const current = pid ? projects.find((p) => p.id === pid) : undefined

	/** 左侧目录：始终是全库，不随筛选变化（筛选只影响正文列表，导航不应跟着晃） */
	const sidebarGroups = useMemo(() => {
		const map = new Map<string, StudyProject[]>()
		for (const p of projects) {
			const arr = map.get(p.direction)
			if (arr) arr.push(p)
			else map.set(p.direction, [p])
		}
		const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "zh"))
		for (const [, items] of entries) items.sort(byTitle)
		return entries
	}, [projects])

	const directions = useMemo(() => sidebarGroups.map(([name]) => name), [sidebarGroups])

	const list = useMemo(() => {
		const kw = q.trim().toLowerCase()
		return projects.filter((p) => {
			if (route !== "all" && p.route !== route) return false
			if (direction !== "all" && p.direction !== direction) return false
			if (!kw) return true
			return [p.title, p.summary, p.direction, p.routeLabel, p.tags.join(" ")].some((s) =>
				s.toLowerCase().includes(kw),
			)
		})
	}, [projects, route, direction, q])

	const groups = useMemo(() => {
		const map = new Map<string, StudyProject[]>()
		for (const p of list) {
			const key = groupBy === "direction" ? p.direction : p.routeLabel
			const arr = map.get(key)
			if (arr) arr.push(p)
			else map.set(key, [p])
		}
		const entries = Array.from(map.entries())
		for (const [, items] of entries) items.sort(byTitle)
		if (groupBy === "route") {
			entries.sort((a, b) => (ROUTE_ORDER[a[1][0].route] ?? 9) - (ROUTE_ORDER[b[1][0].route] ?? 9))
		} else {
			entries.sort(([a], [b]) => a.localeCompare(b, "zh"))
		}
		return entries
	}, [list, groupBy])

	/** 详情页的上一项 / 下一项：按「方向 → 语言 → 标题」排全库，与左侧目录一致 */
	const ordered = useMemo(
		() =>
			[...projects].sort(
				(a, b) =>
					a.direction.localeCompare(b.direction, "zh") ||
					(ROUTE_ORDER[a.route] ?? 9) - (ROUTE_ORDER[b.route] ?? 9) ||
					a.title.localeCompare(b.title, "zh"),
			),
		[projects],
	)

	const idx = current ? ordered.findIndex((p) => p.id === current.id) : -1
	const prev = idx > 0 ? ordered[idx - 1] : undefined
	const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : undefined

	const open = (id: string) => {
		if (id === pid) return
		router.push(`/study/projects?p=${encodeURIComponent(id)}`)
	}

	const back = () => {
		router.push("/study/projects")
		window.setTimeout(() => {
			if (window.location.search.includes("p=")) window.location.href = window.location.pathname
		}, 400)
	}

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch {
			/* 无剪贴板权限时静默失败，不影响阅读 */
		}
	}

	// 切项目回顶部（浏览器默认保留滚动位置，读下一个项目时很别扭）
	useEffect(() => {
		window.scrollTo({ top: 0 })
		setActiveSection("")
	}, [pid])

	// 正文目录高亮：按滚动位置现算（和路线页同样的做法，不缓存 DOM 引用）
	useEffect(() => {
		const toc = current?.toc
		if (!toc || toc.length < 2) return
		let raf = 0
		const compute = () => {
			raf = 0
			const els = toc.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => el !== null)
			if (!els.length) return
			let cur = els[0].id
			for (const el of els) {
				if (el.getBoundingClientRect().top <= 96) cur = el.id
				else break
			}
			setActiveSection(cur)
		}
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(compute)
		}
		compute()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			if (raf) cancelAnimationFrame(raf)
		}
	}, [current])

	const nav = (
		<>
			<div className="doc-nav-title">项目目录</div>

			{/* 当前项目目录放在最上面：整库有 20+ 项，放到末尾要点进详情后先滚到底才看得见 */}
			{current && current.toc.length > 1 && (
				<div className="doc-nav-section">
					<div className="doc-nav-heading">本页目录</div>
					<div className="doc-nav-list">
						{current.toc.map((t) => (
							<a
								key={t.id}
								href={`#${t.id}`}
								className={`doc-nav-item is-sub${activeSection === t.id ? " is-active" : ""}`}
								onClick={() => setActiveSection(t.id)}
							>
								<span className="doc-nav-text">{t.text}</span>
							</a>
						))}
					</div>
				</div>
			)}

			<div className="doc-nav-section">
				<div className="doc-nav-heading">索引</div>
				<div className="doc-nav-list">
					<button
						type="button"
						className={`doc-nav-item is-flat${current ? "" : " is-active"}`}
						onClick={back}
					>
						<span className="doc-nav-icon">▤</span>
						<span className="doc-nav-text">全部项目</span>
						<span className="doc-nav-meta">{projects.length}</span>
					</button>
				</div>
			</div>

			{sidebarGroups.map(([name, items]) => (
				<div key={name} className="doc-nav-section">
					<div className="doc-nav-heading">{name}</div>
					<div className="doc-nav-list">
						{items.map((p) => (
							<button
								key={p.id}
								type="button"
								title={p.title}
								className={`doc-nav-item${p.id === current?.id ? " is-active" : ""}`}
								onClick={() => open(p.id)}
							>
								<span className="doc-nav-text">{p.title}</span>
								<span className="doc-nav-meta">{p.routeLabel}</span>
							</button>
						))}
					</div>
				</div>
			))}
		</>
	)

	if (current) {
		return (
			<DocShell aside={nav} asideTitle="项目目录">
				<article>
					<header className="doc-article-head">
						<div className="doc-head-row">
							<button
								type="button"
								className="doc-back-btn"
								onClick={back}
								title="返回项目列表"
								aria-label="返回项目列表"
							>
								←
							</button>
							<span className="doc-kicker">
								{current.routeLabel} · {current.direction}
							</span>
						</div>
						<h1 className="doc-article-title">{current.title}</h1>
						<div className="doc-article-meta">
							<span className="doc-chip">{current.level}</span>
							{current.hours && <span className="doc-chip">约 {current.hours} 小时</span>}
							{current.weeks && <span className="doc-chip">对应第 {current.weeks} 周</span>}
							{current.toc.length > 0 && <span className="doc-chip">{current.toc.length} 个章节</span>}
							<button type="button" className="doc-filter" onClick={copyLink}>
								{copied ? "已复制" : "复制链接"}
							</button>
						</div>
					</header>

					{current.summary && <p className="doc-lead">{current.summary}</p>}

					{current.requires.length > 0 && (
						<div className="doc-prereq">
							<span className="doc-prereq-label">先修</span>
							{current.requires.map((r) => (
								<Link key={`${r.route}-${r.from}`} className="doc-chip" href={`/study/${r.route}?week=${r.from}`}>
									{r.routeLabel} 第 {r.from}
									{r.to !== r.from ? `–${r.to}` : ""} 周
								</Link>
							))}
						</div>
					)}

					<div className="doc-proj-body">
						{current.parts.map((p, i) => (
							<Part key={i} part={p} />
						))}
					</div>

					{current.tags.length > 0 && (
						<div className="doc-proj-footer">
							<span className="doc-proj-footer-label">标签</span>
							{current.tags.map((t) => (
								<span key={t} className="doc-tag">
									{t}
								</span>
							))}
						</div>
					)}

					<DocPager
						prev={prev && { label: "上个项目", title: prev.title, onClick: () => open(prev.id) }}
						next={next && { label: "下个项目", title: next.title, onClick: () => open(next.id) }}
					/>
				</article>
			</DocShell>
		)
	}

	return (
		<DocShell aside={nav} asideTitle="项目目录">
			<header className="doc-hero">
				<div className="doc-kicker">实践项目 · 项目库</div>
				<h1 className="doc-hero-title">用真实需求，把路线练成手上的活</h1>
				<p className="doc-hero-desc">
					每个项目都是一份可直接开工的需求单：功能目标、接口契约、验收标准与参考实现。
					按业务方向找项目，或者按语言筛出你正在学的那条线。
				</p>
				<div className="doc-hero-meta">
					<span>{projects.length} 个项目</span>
					<span>{directions.length} 个业务方向</span>
					<span>加项目只需新增一个 .md</span>
				</div>
			</header>

			<div className="doc-filters">
				<div className="doc-filter-row">
					<span className="doc-filter-label">路线</span>
					{ROUTES.map((r) => (
						<button
							key={r.id}
							type="button"
							className={`doc-filter${route === r.id ? " is-active" : ""}`}
							onClick={() => setRoute(r.id)}
						>
							{r.label}
						</button>
					))}
				</div>

				{directions.length > 1 && (
					<div className="doc-filter-row">
						<span className="doc-filter-label">方向</span>
						<button
							type="button"
							className={`doc-filter${direction === "all" ? " is-active" : ""}`}
							onClick={() => setDirection("all")}
						>
							全部
						</button>
						{directions.map((d) => (
							<button
								key={d}
								type="button"
								className={`doc-filter${direction === d ? " is-active" : ""}`}
								onClick={() => setDirection(d)}
							>
								{d}
							</button>
						))}
					</div>
				)}

				<div className="doc-filter-row">
					<span className="doc-filter-label">搜索</span>
					<Input
						allowClear
						size="small"
						placeholder="标题 / 摘要 / 标签"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						style={{ width: 240 }}
					/>
				</div>

				<div className="doc-filter-row">
					<span className="doc-filter-label">分组</span>
					<button
						type="button"
						className={`doc-filter${groupBy === "direction" ? " is-active" : ""}`}
						onClick={() => setGroupBy("direction")}
					>
						按方向
					</button>
					<button
						type="button"
						className={`doc-filter${groupBy === "route" ? " is-active" : ""}`}
						onClick={() => setGroupBy("route")}
					>
						按语言
					</button>
				</div>
			</div>

			{list.length === 0 ? (
				<div className="doc-empty">
					<p className="doc-empty-title">没有匹配的项目</p>
					<p className="doc-empty-desc">换个关键词试试，或者清除筛选，看看全部 {projects.length} 个项目。</p>
					<button
						type="button"
						className="doc-empty-btn"
						onClick={() => {
							setRoute("all")
							setDirection("all")
							setQ("")
						}}
					>
						清除筛选
					</button>
				</div>
			) : (
				groups.map(([name, items]) => (
					<section key={name} className="doc-section">
						<div className="doc-section-head">
							<h2 className="doc-section-title">{name}</h2>
							<span className="doc-section-count">{items.length} 个</span>
						</div>
						<div className="doc-project-list">
							{items.map((p) => (
								<button key={p.id} type="button" className="doc-project-row" onClick={() => open(p.id)}>
									<span className="doc-project-main">
										<span className="doc-project-head">
											<span className="doc-project-title">{p.title}</span>
											<span className={`doc-route doc-route-${p.route}`}>{p.routeLabel}</span>
										</span>
										{p.summary && <span className="doc-project-summary">{p.summary}</span>}
										<span className="doc-project-meta">
											<span>{p.direction}</span>
											<span>·</span>
											<span>{p.level}</span>
											{p.hours && (
												<>
													<span>·</span>
													<span>约 {p.hours} 小时</span>
												</>
											)}
											{p.weeks && (
												<>
													<span>·</span>
													<span>第 {p.weeks} 周</span>
												</>
											)}
										</span>
										{p.tags.length > 0 && (
											<span className="doc-project-tags">
												{p.tags.slice(0, 4).map((t) => (
													<span key={t} className="doc-tag">
														{t}
													</span>
												))}
											</span>
										)}
									</span>
									<span className="doc-project-arrow">→</span>
								</button>
							))}
						</div>
					</section>
				))
			)}

			<p className="doc-hint">
				想加一个项目？在 <code>src/content/study/projects/&lt;route&gt;/</code> 下新建一个 <code>.md</code>
				，写 7 行 front-matter + 正文即可，不用改代码。格式见 <Link href="/study/java">Java 路线</Link>{" "}
				附录里的「场景详解（模板）」。
			</p>
		</DocShell>
	)
}

function Part({ part }: { part: StudyPart }) {
	if (part.type === "md") return <DocHtml html={part.html} />
	return (
		<details className={`doc-fold doc-fold-${part.kind}`}>
			<summary className="doc-fold-head">
				<span className="doc-fold-tag">{FOLD_LABELS[part.kind]}</span>
				<span className="doc-fold-title">{part.title || FOLD_LABELS[part.kind]}</span>
				<span className="doc-fold-arrow">›</span>
			</summary>
			<DocHtml html={part.html} className="doc-fold-body" />
		</details>
	)
}
