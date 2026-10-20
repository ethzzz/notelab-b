// 实践项目库（客户端交互层）：筛选 + 列表 + 详情（`?p=<route>/<slug>`）。
//
// 详情用查询参数而不是子路由：B 端页面守卫是 pages.includes(pathname) 的精确匹配，
// 子路由要逐条登记权限；本项目对二级页的既有约定就是 ?id= / ?p=。
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "antd"
import { AdminPage } from "@/components/admin"
import { MD_BODY_CSS } from "@/components/md-preview"
import type { StudyProject } from "@/lib/study-projects"

const FOLD_LABEL: Record<string, string> = { hint: "思路", solution: "参考实现", error: "常见报错" }
const ROUTES = [
	{ id: "all", label: "全部" },
	{ id: "java", label: "Java" },
	{ id: "go", label: "Go" },
	{ id: "react", label: "React" },
	{ id: "nextjs", label: "Next.js" },
] as const

export default function ProjectsView({ projects, pid }: { projects: StudyProject[]; pid: string }) {
	const router = useRouter()

	const [route, setRoute] = useState<string>("all")
	const [direction, setDirection] = useState<string>("all")
	const [q, setQ] = useState("")
	/** 分组方式：默认按「业务方向」（这是读者找项目的入口），可切到按语言 */
	const [groupBy, setGroupBy] = useState<"direction" | "route">("direction")

	const directions = useMemo(
		() => Array.from(new Set(projects.map((p) => p.direction))).sort((a, b) => a.localeCompare(b, "zh")),
		[projects],
	)

	const list = useMemo(() => {
		const kw = q.trim().toLowerCase()
		return projects.filter((p) => {
			if (route !== "all" && p.route !== route) return false
			if (direction !== "all" && p.direction !== direction) return false
			if (!kw) return true
			return [p.title, p.summary, p.tags.join(" ")].some((s) => s.toLowerCase().includes(kw))
		})
	}, [projects, route, direction, q])

	const open = (id: string) => router.push(`/study/projects?p=${encodeURIComponent(id)}`)

	/** 分组：默认按业务方向（读者先想「练什么方向」），也可切到按语言 */
	const groups = useMemo(() => {
		const map = new Map<string, StudyProject[]>()
		for (const p of list) {
			const key = groupBy === "direction" ? p.direction : p.routeLabel
			const arr = map.get(key)
			if (arr) arr.push(p)
			else map.set(key, [p])
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "zh"))
	}, [list, groupBy])

	const back = () => {
		router.push("/study/projects")
		window.setTimeout(() => {
			if (window.location.search.includes("p=")) window.location.href = window.location.pathname
		}, 400)
	}

	const current = pid ? projects.find((p) => p.id === pid) : undefined

	// 正文目录高亮：按滚动位置现算（和路线页同样的做法，不缓存 DOM 引用）
	const [activeSection, setActiveSection] = useState("")
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
	}, [pid, current?.toc])

	if (current) {
		return (
			<AdminPage
				title={
					<span className="proj-title-row">
						<button type="button" className="proj-back" onClick={back} title="返回项目列表" aria-label="返回项目列表">
							←
						</button>
						<span>{current.title}</span>
					</span>
				}
				description={
					<span className="proj-meta-line">
						<span className={`proj-route proj-route-${current.route}`}>{current.routeLabel}</span>
						<span className="proj-meta-sep">·</span>
						<span>{current.direction}</span>
						<span className="proj-meta-sep">·</span>
						<span>{current.level}</span>
						{current.hours && (
							<>
								<span className="proj-meta-sep">·</span>
								<span>约 {current.hours} 小时</span>
							</>
						)}
						{current.weeks && (
							<>
								<span className="proj-meta-sep">·</span>
								<span>对应第 {current.weeks} 周</span>
							</>
						)}
					</span>
				}
			>
				<style>{MD_BODY_CSS}</style>
				<style>{PROJECT_CSS}</style>
				<div className="proj-layout">
					<div className="proj-detail">
						{/* 摘要：整篇文档的「一句话导读」，与正文分开 */}
						{current.summary && <p className="proj-lead">{current.summary}</p>}

						{current.requires.length > 0 && (
							<div className="proj-prereq">
								<span className="proj-prereq-label">先修</span>
								{current.requires.map((r) => (
									<a key={`${r.route}-${r.from}`} className="proj-prereq-link" href={`/admin/study/${r.route}?week=${r.from}`}>
										{r.routeLabel} 第 {r.from}
										{r.to !== r.from ? `–${r.to}` : ""} 周
									</a>
								))}
							</div>
						)}

						<div className="proj-body">
							{current.parts.map((p, i) =>
								p.type === "md" ? (
									<div key={i} className="md-body" dangerouslySetInnerHTML={{ __html: p.html }} />
								) : (
									<details key={i} className="proj-fold">
										<summary>
											<span className={`proj-tag proj-tag-${p.kind}`}>{FOLD_LABEL[p.kind] || "说明"}</span>
											{p.title}
										</summary>
										<div className="md-body" dangerouslySetInnerHTML={{ __html: p.html }} />
									</details>
								),
							)}
						</div>

					{current.tags.length > 0 && (
						<div className="proj-footer">
							<span className="proj-footer-label">标签</span>
							{current.tags.map((t) => (
								<span key={t} className="proj-mini-tag">
									{t}
								</span>
							))}
						</div>
					)}
					</div>

					{current.toc.length > 1 && (
						<aside className="proj-toc">
							<div className="proj-toc-title">本页目录</div>
							{current.toc.map((t) => (
								<a
									key={t.id}
									href={`#${t.id}`}
									onClick={() => setActiveSection(t.id)}
									className={`proj-toc-link${activeSection === t.id ? " is-active" : ""}`}
								>
									{t.text}
								</a>
							))}
						</aside>
					)}
				</div>
			</AdminPage>
		)
	}

	return (
		<AdminPage
			title="实践项目"
			description="按企业真实业务组织，每个项目都是一份可直接开工的需求：目标、契约、验收、参考实现。"
			extra={<span className="study-progress-chip">{projects.length} 个项目</span>}
		>
			<style>{PROJECT_CSS}</style>

			<div className="proj-filters">
				<div className="proj-filter-row">
					<span className="proj-filter-label">路线</span>
					{ROUTES.map((r) => (
						<button
							key={r.id}
							type="button"
							className={`proj-chip${route === r.id ? " is-active" : ""}`}
							onClick={() => setRoute(r.id)}
						>
							{r.label}
						</button>
					))}
				</div>
				{directions.length > 1 && (
					<div className="proj-filter-row">
						<span className="proj-filter-label">方向</span>
						<button
							type="button"
							className={`proj-chip${direction === "all" ? " is-active" : ""}`}
							onClick={() => setDirection("all")}
						>
							全部
						</button>
						{directions.map((d) => (
							<button
								key={d}
								type="button"
								className={`proj-chip${direction === d ? " is-active" : ""}`}
								onClick={() => setDirection(d)}
							>
								{d}
							</button>
						))}
					</div>
				)}
				<div className="proj-filter-row">
					<span className="proj-filter-label">搜索</span>
					<Input allowClear placeholder="标题 / 标签" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
				</div>
				<div className="proj-filter-row">
					<span className="proj-filter-label">分组</span>
					<button type="button" className={`proj-chip${groupBy === "direction" ? " is-active" : ""}`} onClick={() => setGroupBy("direction")}>
						按方向
					</button>
					<button type="button" className={`proj-chip${groupBy === "route" ? " is-active" : ""}`} onClick={() => setGroupBy("route")}>
						按语言
					</button>
				</div>
			</div>

			{list.length === 0 ? (
				<p className="proj-empty">没有匹配的项目。</p>
			) : (
				groups.map(([name, items]) => (
					<section key={name} className="proj-group">
						<h3 className="proj-group-title">
							{name}
							<span className="proj-group-count">{items.length}</span>
						</h3>
						<div className="proj-grid">
							{items.map((p) => (
								<button key={p.id} type="button" className="proj-card" onClick={() => open(p.id)}>
									<div className="proj-card-head">
										<span className="proj-card-title">{p.title}</span>
										<span className={`proj-route proj-route-${p.route}`}>{p.routeLabel}</span>
									</div>
									<div className="proj-card-meta">
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
									</div>
									<p className="proj-card-summary">{p.summary}</p>
									<div className="proj-card-tags">
										{p.tags.slice(0, 4).map((t) => (
											<span key={t} className="proj-mini-tag">
												{t}
											</span>
										))}
									</div>
								</button>
							))}
						</div>
					</section>
				))
			)}

			<p className="proj-hint">
				想加一个项目？在 <code>src/content/study/projects/&lt;route&gt;/</code> 下新建一个 <code>.md</code>，写 7 行
				front-matter + 正文即可，不用改代码。格式见{" "}
				<Link href="/study/java">Java 路线</Link> 附录里的「场景详解（模板）」。
			</p>
		</AdminPage>
	)
}

const PROJECT_CSS = `
.proj-filters{display:flex;flex-direction:column;gap:10px;margin:4px 0 20px}
.proj-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.proj-filter-label{font-size:12px;color:#71717a;min-width:32px}
.dark .proj-filter-label{color:#a1a1aa}
.proj-chip{border:1px solid rgba(128,128,128,.25);background:transparent;color:inherit;border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;transition:.15s}
.proj-chip:hover{border-color:rgba(22,119,255,.45)}
.proj-chip.is-active{background:rgba(22,119,255,.1);border-color:rgba(22,119,255,.45);color:#0958d9}
.dark .proj-chip.is-active{color:#69b1ff}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.proj-group{margin-bottom:26px}
.proj-group-title{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:650;margin:0 0 10px}
.proj-group-title::after{content:"";flex:1;height:1px;background:rgba(128,128,128,.18)}
.proj-group-count{font-size:11px;font-weight:500;color:#71717a}
.dark .proj-group-count{color:#a1a1aa}
.proj-card{display:flex;flex-direction:column;gap:6px;text-align:left;padding:14px 16px;border:1px solid rgba(128,128,128,.2);border-radius:12px;background:var(--card,#fff);cursor:pointer;color:inherit;transition:border-color .16s,box-shadow .16s,transform .16s}
.dark .proj-card{background:#1f1f1f}
.proj-card:hover{border-color:rgba(22,119,255,.45);box-shadow:0 6px 18px rgba(0,0,0,.07);transform:translateY(-1px)}
.dark .proj-card:hover{box-shadow:none}
.proj-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.proj-card-title{font-size:15px;font-weight:600}
.proj-route{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px;background:rgba(128,128,128,.12)}
.proj-route-java{color:#b45309}
.proj-route-go{color:#0891b2}
.proj-route-react{color:#7c3aed}
.proj-route-nextjs{color:#0f172a}
.dark .proj-route-nextjs{color:#e5e7eb}
.proj-card-meta{font-size:12px;color:#71717a;display:flex;gap:6px;flex-wrap:wrap}
.dark .proj-card-meta{color:#a1a1aa}
.proj-card-summary{margin:2px 0 0;font-size:13px;line-height:1.6;color:#52525b}
.dark .proj-card-summary{color:#a1a1aa}
.proj-card-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.proj-mini-tag{font-size:11px;padding:1px 6px;border-radius:5px;background:rgba(128,128,128,.1);color:#71717a}
.dark .proj-mini-tag{color:#a1a1aa}
.proj-empty{padding:40px 0;text-align:center;font-size:13px;color:#71717a}
.proj-hint{margin-top:26px;font-size:12px;line-height:1.8;color:#71717a}
.dark .proj-hint{color:#a1a1aa}
.proj-title-row{display:inline-flex;align-items:center;gap:18px}
.proj-back{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border-radius:9px;border:1px solid rgba(128,128,128,.25);background:rgba(128,128,128,.05);color:inherit;font-size:15px;line-height:1;cursor:pointer;transition:border-color .15s,color .15s}
.proj-back:hover{border-color:rgba(22,119,255,.5);color:#1677ff}
.proj-meta-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:#71717a;margin-top:6px}
.dark .proj-meta-line{color:#a1a1aa}
.proj-meta-line .proj-route{font-size:11px}
.proj-meta-sep{opacity:.5}
.proj-layout{display:flex;align-items:flex-start;gap:40px}
.proj-detail{flex:1;min-width:0;max-width:820px}
.proj-toc{position:sticky;top:72px;flex:none;width:176px;max-height:calc(100vh - 88px);overflow-y:auto;scrollbar-width:thin;padding-left:16px;border-left:1px solid rgba(128,128,128,.18)}
.proj-toc-title{font-size:11px;font-weight:600;letter-spacing:.06em;color:#71717a;margin-bottom:8px}
.dark .proj-toc-title{color:#a1a1aa}
.proj-toc-link{display:block;font-size:12.5px;line-height:1.5;padding:4px 8px;margin:1px 0;border-radius:6px;border-left:2px solid transparent;color:#52525b;text-decoration:none;transition:background .12s,color .12s}
.dark .proj-toc-link{color:#a1a1aa}
.proj-toc-link:hover{background:rgba(128,128,128,.08)}
.proj-toc-link.is-active{color:#0958d9;background:rgba(22,119,255,.08);border-left-color:#1677ff}
.dark .proj-toc-link.is-active{color:#69b1ff;background:rgba(22,119,255,.16)}
@media(max-width:1279px){.proj-toc{display:none}}
.proj-lead{font-size:15px;line-height:1.85;color:#3f3f46;margin:4px 0 18px;padding-left:12px;border-left:3px solid rgba(22,119,255,.35)}
.dark .proj-lead{color:#d4d4d8}
.proj-prereq{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 22px;font-size:12px}
.proj-prereq-label{font-size:11px;font-weight:600;letter-spacing:.06em;color:#71717a}
.dark .proj-prereq-label{color:#a1a1aa}
.proj-prereq-link{font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid rgba(128,128,128,.25);color:inherit;text-decoration:none;transition:border-color .15s,color .15s}
.proj-prereq-link:hover{border-color:rgba(22,119,255,.5);color:#0958d9}
.dark .proj-prereq-link:hover{color:#69b1ff}
.proj-body{padding-top:20px;border-top:1px solid rgba(128,128,128,.18)}
.proj-body .md-body{font-size:14.8px;line-height:1.85}
.proj-body .md-body h2{font-size:1.22em;margin:2em 0 .6em;padding-bottom:.35em;border-bottom:1px solid rgba(128,128,128,.16);scroll-margin-top:88px}
.proj-body .md-body h2:first-child{margin-top:.4em}
.proj-body .md-body h3{font-size:1.05em;margin:1.6em 0 .4em}
.proj-body .md-body p{margin:.7em 0}
.proj-body .md-body ul,.proj-body .md-body ol{padding-left:1.4em;margin:.5em 0}
.proj-body .md-body table{font-size:.94em}
.proj-footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:26px;padding-top:14px;border-top:1px solid rgba(128,128,128,.18)}
.proj-footer-label{font-size:11px;color:#71717a}
.dark .proj-footer-label{color:#a1a1aa}
.proj-fold{margin:12px 0;border:1px solid rgba(128,128,128,.22);border-radius:10px;padding:0 14px;background:rgba(128,128,128,.04)}
.proj-fold>summary{cursor:pointer;padding:10px 0;font-size:13px;display:flex;align-items:center;gap:8px;list-style:none}
.proj-fold>summary::-webkit-details-marker{display:none}
.proj-fold>summary::after{content:"展开";margin-left:auto;font-size:12px;color:#1677ff}
.proj-fold[open]>summary::after{content:"收起"}
.proj-fold .md-body{padding-bottom:12px}
.proj-tag{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px;border:1px solid transparent}
.proj-tag-hint{color:#0958d9;background:rgba(22,119,255,.1);border-color:rgba(22,119,255,.22)}
.proj-tag-solution{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.26)}
.proj-tag-error{color:#ad4e00;background:rgba(250,140,22,.12);border-color:rgba(250,140,22,.28)}
.dark .proj-tag-hint{color:#69b1ff}
.dark .proj-tag-solution{color:#95de64}
.dark .proj-tag-error{color:#ffc069}
`
