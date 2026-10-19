// 实践项目库（客户端交互层）：筛选 + 列表 + 详情（`?p=<route>/<slug>`）。
//
// 详情用查询参数而不是子路由：B 端页面守卫是 pages.includes(pathname) 的精确匹配，
// 子路由要逐条登记权限；本项目对二级页的既有约定就是 ?id= / ?p=。
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Input, Tag } from "antd"
import { AdminPage } from "@/components/admin"
import { MD_BODY_CSS } from "@/components/md-preview"
import type { StudyProject } from "@/lib/study-projects"

const FOLD_LABEL: Record<string, string> = { hint: "思路", solution: "参考实现", error: "常见报错" }
const ROUTES = [
	{ id: "all", label: "全部" },
	{ id: "java", label: "Java" },
	{ id: "go", label: "Go" },
	{ id: "react", label: "React" },
] as const

export default function ProjectsView({ projects }: { projects: StudyProject[] }) {
	const router = useRouter()
	const sp = useSearchParams()
	const pid = sp.get("p")

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

	if (current) {
		return (
			<AdminPage
				title={
					<span className="inline-flex items-center gap-2">
						<button type="button" className="study-back-btn" onClick={back} title="返回项目列表" aria-label="返回项目列表">
							←
						</button>
						<span>{current.title}</span>
					</span>
				}
				description={
					<span className="inline-flex flex-wrap items-center gap-2">
						<Tag color="blue">{current.routeLabel}</Tag>
						<Tag>{current.direction}</Tag>
						<Tag color="green">{current.level}</Tag>
						{current.hours && <Tag color="gold">约 {current.hours} 小时</Tag>}
						{current.weeks && <span className="text-xs">对应第 {current.weeks} 周</span>}
					</span>
				}
			>
				<style>{MD_BODY_CSS}</style>
				<style>{PROJECT_CSS}</style>
				<div className="proj-detail">
					{current.tags.length > 0 && (
						<div className="proj-tags">
							{current.tags.map((t) => (
								<Tag key={t} bordered={false}>
									{t}
								</Tag>
							))}
						</div>
					)}
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
.proj-detail{max-width:860px}
.proj-detail .md-body{font-size:15px;line-height:1.8}
.proj-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
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
