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

const FOLD_LABEL: Record<string, string> = { hint: "思路", solution: "参考实现", error: "常见报错", check: "验收脚本" }
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
	const [copied, setCopied] = useState(false)
	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch {
			/* 无剪贴板权限时静默失败，不影响阅读 */
		}
	}
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
			<div className="proj-page">
				<style>{MD_BODY_CSS}</style>
				<style>{PROJECT_CSS}</style>
				<div className="proj-layout">
					<article className="proj-detail proj-sheet">
						{/* 封面：标题 + 元信息 + 操作，并进卡片顶部，不再是「页面标题 + 正文」两张皮 */}
						<header className="proj-cover">
							<div className="proj-cover-row">
								<button type="button" className="proj-back" onClick={back} title="返回项目列表" aria-label="返回项目列表">
									←
								</button>
								<h1 className="proj-cover-title">{current.title}</h1>
								<button type="button" className="proj-copy" onClick={copyLink}>
									{copied ? "已复制" : "复制链接"}
								</button>
							</div>
							<div className="proj-meta-line">
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
							</div>
						</header>

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
					</article>

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
			</div>
		)
	}

	return (
		<AdminPage
			title="实践项目"
			description="按企业真实业务组织，每个项目都是一份可直接开工的需求：目标、契约、验收、参考实现。"
			extra={
				<span className="study-progress-chip">
					{projects.length} 个项目 · {directions.length} 个方向
				</span>
			}
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
				<div className="proj-empty-state">
					<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" className="proj-empty-art">
						<rect x="10" y="14" width="44" height="36" rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity=".28" />
						<path d="M20 26h24M20 34h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".45" />
						<circle cx="44" cy="44" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity=".55" />
						<path d="m50.5 50.5 4.5 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
					</svg>
					<p className="proj-empty-title">没有匹配的项目</p>
					<p className="proj-empty-desc">
						换个关键词试试，或者清除筛选，看看全部 {projects.length} 个项目。
					</p>
					<button
						type="button"
						className="proj-empty-btn"
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
				<div key={`${groupBy}|${route}|${direction}|${q}`} className="proj-groups">
					{groups.map(([name, items]) => (
						<section key={name} className="proj-group">
							<h3 className="proj-group-title">
								{name}
								<span className="proj-group-count">{items.length}</span>
							</h3>
							<div className="proj-grid">
								{items.map((p, i) => (
									<button
										key={p.id}
										type="button"
										className={`proj-card proj-card-${p.route}`}
										style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
										onClick={() => open(p.id)}
									>
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
				))}
				</div>
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
.proj-chip:hover{border-color:color-mix(in srgb,var(--app-accent,#6366f1) 45%,transparent)}
.proj-chip.is-active{background:color-mix(in srgb,var(--app-accent,#6366f1) 10%,transparent);border-color:color-mix(in srgb,var(--app-accent,#6366f1) 45%,transparent);color:var(--app-accent,#4f46e5)}
.dark .proj-chip.is-active{color:var(--app-accent,#818cf8)}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.proj-group{margin-bottom:26px}
.proj-group-title{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:650;margin:0 0 10px}
.proj-group-title::after{content:"";flex:1;height:1px;background:rgba(128,128,128,.18)}
.proj-group-count{font-size:11px;font-weight:500;color:#71717a}
.dark .proj-group-count{color:#a1a1aa}
.proj-card{display:flex;flex-direction:column;gap:6px;text-align:left;padding:14px 16px;border:1px solid rgba(128,128,128,.2);border-left:3px solid var(--card-accent,rgba(128,128,128,.3));border-radius:12px;background:var(--card,#fff);cursor:pointer;color:inherit;transition:border-color .16s,box-shadow .16s,transform .16s}
.proj-card-java{--card-accent:#f59e0b}
.proj-card-go{--card-accent:#06b6d4}
.proj-card-react{--card-accent:#8b5cf6}
.proj-card-nextjs{--card-accent:#334155}
.dark .proj-card-nextjs{--card-accent:#cbd5e1}
.dark .proj-card{background:#232323}
.proj-card:hover{border-color:color-mix(in srgb,var(--app-accent,#6366f1) 45%,transparent);box-shadow:0 6px 18px rgba(0,0,0,.07);transform:translateY(-1px)}
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
/* 空状态：虚线卡片 + 主题色图标 + 一键清除筛选 */
.proj-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:56px 20px 60px;text-align:center;border:1px dashed rgba(128,128,128,.28);border-radius:16px;background:rgba(128,128,128,.03)}
.proj-empty-art{color:var(--app-accent,#6366f1);margin-bottom:6px}
.proj-empty-title{margin:0;font-size:15px;font-weight:600}
.proj-empty-desc{margin:0;font-size:13px;line-height:1.7;color:#71717a;max-width:360px}
.dark .proj-empty-desc{color:#a1a1aa}
.proj-empty-btn{margin-top:10px;border:1px solid color-mix(in srgb,var(--app-accent,#6366f1) 45%,transparent);background:color-mix(in srgb,var(--app-accent,#6366f1) 8%,transparent);color:var(--app-accent,#4f46e5);border-radius:8px;padding:6px 14px;font-size:12.5px;cursor:pointer;transition:background .15s}
.proj-empty-btn:hover{background:color-mix(in srgb,var(--app-accent,#6366f1) 14%,transparent)}
.dark .proj-empty-btn{color:var(--app-accent,#818cf8)}
/* 卡片入场：按顺序轻微上浮，筛选变化时整组重新播放（容器 key 变了） */
@keyframes proj-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.proj-card{animation:proj-in .3s ease both}
@media (prefers-reduced-motion:reduce){.proj-card{animation:none}}
.proj-hint{margin-top:26px;font-size:12px;line-height:1.8;color:#71717a}
.dark .proj-hint{color:#a1a1aa}
.proj-title-row{display:inline-flex;align-items:center;gap:18px}
.proj-back{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border-radius:9px;border:1px solid rgba(128,128,128,.25);background:rgba(128,128,128,.05);color:inherit;font-size:15px;line-height:1;cursor:pointer;transition:border-color .15s,color .15s}
.proj-back:hover{border-color:rgba(22,119,255,.5);color:var(--app-accent,#6366f1)}
.proj-meta-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:#71717a;margin-top:6px}
.dark .proj-meta-line{color:#a1a1aa}
.proj-meta-line .proj-route{font-size:11px}
.proj-meta-sep{opacity:.5}
.proj-layout{display:flex;align-items:flex-start;gap:56px}
.proj-detail{flex:1;min-width:0;max-width:none}
/* 正文纸张：把文档从页面底色里「抬起来」，这是最影响观感的一层 */
.proj-sheet{background:#fff;border:1px solid rgba(17,24,39,.06);border-radius:16px;padding:30px 36px 34px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 28px -18px rgba(16,24,40,.18)}
.dark .proj-sheet{background:#232323;border-color:rgba(255,255,255,.09);box-shadow:none}
/* 封面：标题/元信息/操作并进卡片顶部，用一层很淡的主题色渐变把它和正文分开 */
.proj-cover{margin:-30px -36px 24px;padding:26px 36px 20px;border-radius:16px 16px 0 0;background:linear-gradient(180deg,color-mix(in srgb,var(--app-accent,#6366f1) 7%,transparent),transparent 88%)}
.dark .proj-cover{background:linear-gradient(180deg,color-mix(in srgb,var(--app-accent,#818cf8) 14%,transparent),transparent 88%)}
.proj-cover-row{display:flex;align-items:center;gap:16px}
.proj-cover-title{flex:1;min-width:0;margin:0;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-.02em;color:var(--doc-head,#111827)}
.proj-cover .proj-meta-line{margin-top:8px}
.proj-copy{border:1px solid rgba(128,128,128,.25);background:transparent;color:inherit;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s}
.proj-copy:hover{border-color:var(--app-accent,#6366f1);color:var(--app-accent,#6366f1)}
.proj-toc{position:sticky;top:72px;flex:none;width:196px;max-height:calc(100vh - 88px);overflow-y:auto;scrollbar-width:thin;padding-left:16px;border-left:1px solid rgba(128,128,128,.18)}
.proj-toc-title{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#71717a;margin-bottom:8px}
.dark .proj-toc-title{color:#a1a1aa}
.proj-toc-link{display:block;font-size:12.5px;line-height:1.5;padding:4px 8px;margin:1px 0;border-radius:6px;border-left:2px solid transparent;color:#52525b;text-decoration:none;transition:background .12s,color .12s}
.dark .proj-toc-link{color:#a1a1aa}
.proj-toc-link:hover{background:rgba(128,128,128,.08)}
.proj-toc-link.is-active{color:var(--app-accent,#4f46e5);background:color-mix(in srgb,var(--app-accent,#6366f1) 8%,transparent);border-left-color:var(--app-accent,#6366f1);font-weight:600}
.dark .proj-toc-link.is-active{color:var(--app-accent,#818cf8);background:color-mix(in srgb,var(--app-accent,#6366f1) 16%,transparent)}
@media(max-width:1279px){.proj-toc{display:none}}
.proj-lead{font-size:14.5px;line-height:1.85;color:var(--doc-text,#3f3f46);margin:0 0 20px;padding:12px 16px;border-left:3px solid var(--app-accent,#6366f1);background:color-mix(in srgb,var(--app-accent,#6366f1) 5%,transparent);border-radius:0 10px 10px 0}
.dark .proj-lead{color:#d4d4d8;background:color-mix(in srgb,var(--app-accent,#818cf8) 10%,transparent)}
.proj-prereq{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 22px;font-size:12px}
.proj-prereq-label{font-size:11px;font-weight:600;letter-spacing:.06em;color:#71717a}
.dark .proj-prereq-label{color:#a1a1aa}
.proj-prereq-link{font-size:12px;padding:2px 10px;border-radius:999px;border:1px solid rgba(128,128,128,.25);color:inherit;text-decoration:none;transition:border-color .15s,color .15s}
.proj-prereq-link:hover{border-color:rgba(22,119,255,.5);color:var(--app-accent,#4f46e5)}
.dark .proj-prereq-link:hover{color:var(--app-accent,#818cf8)}
.proj-body{padding-top:22px;border-top:1px solid rgba(128,128,128,.18)}
.proj-body .md-body{font-size:15px;line-height:1.9}
/* 博客式分节：每个 h2 上方一条横贯正文的分隔线（第一个除外），比下划线更像文章分节 */
.proj-body .md-body h2{
  font-size:1.3em;font-weight:650;letter-spacing:-.01em;
  margin:2.6em 0 .9em;padding-top:1.6em;
  border-top:1px solid rgba(128,128,128,.18);
  scroll-margin-top:88px;
}
.proj-body .md-body h2:first-child{margin-top:.2em;padding-top:0;border-top:0}
.proj-body .md-body h3{font-size:1.08em;margin:1.8em 0 .45em}
.proj-body .md-body p{margin:.75em 0}
.proj-body .md-body ul,.proj-body .md-body ol{padding-left:1.5em;margin:.6em 0}
/* 混合排版：表格/代码块通栏（信息密度高），正文段落限宽到 ~860px（约 70 字符，回行不串行） */
.proj-body .md-body p,
.proj-body .md-body ul,
.proj-body .md-body ol,
.proj-body .md-body blockquote{max-width:860px}
.proj-body .md-body table{font-size:.95em;border-collapse:separate;border-spacing:0;border:1px solid var(--doc-line);border-radius:12px;overflow:hidden}
.proj-body .md-body th,.proj-body .md-body td{border:0;border-bottom:1px solid var(--doc-line);padding:.55em .9em}
.proj-body .md-body th:not(:last-child),.proj-body .md-body td:not(:last-child){border-right:1px solid var(--doc-line)}
.proj-body .md-body tbody tr:last-child td{border-bottom:0}
.proj-body .md-body tbody tr:hover{background:color-mix(in srgb,var(--app-accent,#6366f1) 4%,transparent)}
.proj-body .md-body pre{margin:1em 0}
.proj-body .md-body hr{margin:2.4em 0}
.proj-footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:26px;padding-top:14px;border-top:1px solid rgba(128,128,128,.18)}
.proj-footer-label{font-size:11px;color:#71717a}
.dark .proj-footer-label{color:#a1a1aa}

/* ---- 文档配色：避免通篇黑白，用「正文柔黑 + 标题深色 + 强调色」拉出层次 ---- */
.proj-detail{--doc-text:#3f3f46;--doc-head:#111827;--doc-muted:#6b7280;--doc-accent:var(--app-accent,#6366f1);--doc-line:rgba(17,24,39,.10);--doc-code-bg:#f5f7fa}
.dark .proj-detail{--doc-text:#d4d4d8;--doc-head:#f4f4f5;--doc-muted:#a1a1aa;--doc-accent:var(--app-accent,#818cf8);--doc-line:rgba(255,255,255,.12);--doc-code-bg:rgba(255,255,255,.06)}
.proj-body .md-body{color:var(--doc-text)}
.proj-body .md-body h2{color:var(--doc-head);border-top-color:var(--doc-line)}
.proj-body .md-body h2::before{content:"";display:inline-block;width:3px;height:.8em;margin-right:.55em;border-radius:2px;background:var(--doc-accent);vertical-align:.02em}
.proj-body .md-body h3{color:var(--doc-head)}
.proj-body .md-body h4{color:var(--doc-head)}
.proj-body .md-body strong{color:var(--doc-head);font-weight:650}
.proj-body .md-body a{color:var(--doc-accent);text-decoration:none}
.proj-body .md-body a:hover{text-decoration:underline}
.proj-body .md-body code{background:var(--doc-code-bg);color:var(--app-accent,#6366f1)}
.dark .proj-body .md-body code{color:var(--app-accent,#a5b4fc)}
.proj-body .md-body pre{background:var(--doc-code-bg);border:1px solid var(--doc-line);border-radius:12px}
.proj-body .md-body pre code{color:inherit;background:none}
.proj-body .md-body blockquote{border-left-color:var(--doc-accent);color:var(--doc-muted);background:color-mix(in srgb,var(--app-accent,#6366f1) 6%,transparent)}
.dark .proj-body .md-body blockquote{background:color-mix(in srgb,var(--app-accent,#818cf8) 10%,transparent)}
.proj-body .md-body th{background:rgba(17,24,39,.04);color:var(--doc-head)}
.dark .proj-body .md-body th{background:rgba(255,255,255,.05)}
.proj-body .md-body th,.proj-body .md-body td{border-color:var(--doc-line)}
.proj-body .md-body li::marker{color:var(--doc-accent);opacity:.75}
.proj-body .md-body hr{border-top-color:var(--doc-line)}
.proj-fold{margin:12px 0;border:1px solid rgba(128,128,128,.22);border-radius:10px;padding:0 14px;background:rgba(128,128,128,.04)}
.proj-fold>summary{cursor:pointer;padding:10px 0;font-size:13px;display:flex;align-items:center;gap:8px;list-style:none}
.proj-fold>summary::-webkit-details-marker{display:none}
.proj-fold>summary::after{content:"展开";margin-left:auto;font-size:12px;color:var(--app-accent,#6366f1)}
.proj-fold[open]>summary::after{content:"收起"}
.proj-fold .md-body{padding-bottom:12px}
.proj-tag{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px;border:1px solid transparent}
.proj-tag-hint{color:var(--app-accent,#4f46e5);background:color-mix(in srgb,var(--app-accent,#6366f1) 10%,transparent);border-color:color-mix(in srgb,var(--app-accent,#6366f1) 22%,transparent)}
.proj-tag-solution{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.26)}
.proj-tag-error{color:#ad4e00;background:rgba(250,140,22,.12);border-color:rgba(250,140,22,.28)}
.proj-tag-check{color:#0e7490;background:rgba(6,182,212,.12);border-color:rgba(6,182,212,.3)}
.dark .proj-tag-hint{color:var(--app-accent,#818cf8)}
.dark .proj-tag-solution{color:#95de64}
.dark .proj-tag-error{color:#ffc069}
`
