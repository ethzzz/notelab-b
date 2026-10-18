// 学习路线文档页：/admin/study/<lang>（用 ?week=N 切换周，见下）
//
// 正文是仓库里的 markdown（src/content/study/*.md），服务端解析成「周 / 步骤 / 折叠块」并做语法高亮，
// 浏览器只拿 HTML 与结构数据 —— highlight.js 与 marked 不会进客户端包。
//
// ⚠️ 为什么是**动态渲染**（force-dynamic）而不是静态生成：
//    静态页在预渲染时读不到 ?week，刷新 ?week=3 会先闪一下概览再切到第 3 周（甚至 JS 失败就停在概览）。
//    这个页面只有管理员看、正文解析可以缓存，动态渲染换「刷新即正确、返回按钮始终在」是划算的。
//
// ⚠️ 为什么周用查询参数而不是 /study/java/3：
//    页面守卫是 pages.includes(pathname) 的**精确匹配**，子路由必须逐条登记进 Java 的 PageRoutes，
//    17 周 × 3 门语言会往权限表里塞 51 条垃圾。本项目对二级页的既有约定就是 ?id= / ?track=。
//
// ⚠️ 新增语言要三处同步：文档目录 + Java 的 MenuTree + Java 的 PageRoutes。
import fs from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import StudyReader from "@/components/study-reader"
import { parseStudy, studyWarnings } from "@/lib/study-render"
import { STUDY_DOCS, type StudyData } from "@/lib/study"

export const dynamic = "force-dynamic"

/**
 * 解析结果缓存：key = 语言，value = { 文件 mtime, 解析结果 }。
 *
 * 为什么按 mtime 而不是「进程内永久缓存」：文档是运行时从磁盘读的，
 * 而部署脚本对「仅文档变更」会跳过重启 —— 永久缓存会让新内容一直不生效。
 * 每次请求 stat 一次（约 0.1ms），mtime 变了才重新解析，改完 push 即生效。
 */
const cache = new Map<string, { mtime: number; data: StudyData }>()

async function loadStudy(lang: string): Promise<StudyData> {
	const file = path.join(process.cwd(), "src", "content", "study", `${lang}.md`)
	let mtime = 0
	try {
		mtime = (await fs.stat(file)).mtimeMs
	} catch {
		// 文件不存在：走下面的失败分支，不在这里抛
	}

	const hit = cache.get(lang)
	if (hit && hit.mtime === mtime) return hit.data

	let markdown: string
	try {
		markdown = await fs.readFile(file, "utf8")
	} catch {
		// 缺文件不该白屏：给一条能看懂的错误，比 500 好排查
		markdown = `> 文档缺失：\`src/content/study/${lang}.md\` 未找到。`
	}
	const data = parseStudy(markdown)
	if (!data.weeks.length) throw new Error(`study/${lang}.md 没解析出任何周，检查「第 N 周：」标题格式`)
	// 每步都该有「思路 + 代码答案」；缺了在这里点名，不用等读者点开才发现
	const warnings = studyWarnings(data)
	if (warnings.length) {
		console.warn(`[study] ${lang} 内容不完整（${warnings.length} 处）：\n  ${warnings.join("\n  ")}`)
	}
	cache.set(lang, { mtime, data })
	return data
}

export default async function StudyPage({ params }: { params: Promise<{ lang: string }> }) {
	const { lang } = await params
	const doc = STUDY_DOCS[lang]
	if (!doc) notFound()

	const data = await loadStudy(lang)

	return (
		<Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
			<StudyReader doc={doc} data={data} />
		</Suspense>
	)
}
