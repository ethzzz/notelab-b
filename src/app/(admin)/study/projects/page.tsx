// 实践项目库：/admin/study/projects
//
// 内容全部来自 src/content/study/projects/<route>/*.md —— 加项目只加文件，不改这里。
// 详情走 ?p=<route>/<slug>（精确匹配守卫，不用子路由）。
//
// ⚠️ 详情 id 由**服务端**从 searchParams 读出来传下去，不在客户端用 useSearchParams：
//    后者在服务端渲染时拿不到查询参数，深链会先渲列表再水合出详情（闪一下）。
//    页面本身是 force-dynamic，客户端导航（?p= 变化）会重新渲染服务端组件并带来新 props。
import ProjectsView from "@/components/study-projects"
import { loadProjects } from "@/lib/study-projects"

export const dynamic = "force-dynamic"

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
	const { p } = await searchParams
	const projects = await loadProjects()
	return <ProjectsView projects={projects} pid={p ?? ""} />
}
