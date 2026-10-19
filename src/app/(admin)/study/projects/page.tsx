// 实践项目库：/admin/study/projects
//
// 内容全部来自 src/content/study/projects/<route>/*.md —— 加项目只加文件，不改这里。
// 详情走 ?p=<route>/<slug>（精确匹配守卫，不用子路由）。
import { Suspense } from "react"
import ProjectsView from "@/components/study-projects"
import { loadProjects } from "@/lib/study-projects"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
	const projects = await loadProjects()
	return (
		<Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
			<ProjectsView projects={projects} />
		</Suspense>
	)
}
