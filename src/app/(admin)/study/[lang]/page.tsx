// 学习路线文档页：/admin/study/<lang>（用 ?week=N 切换周，见下）
//
// 正文是仓库里的 markdown（src/content/study/*.md），**构建时**解析成「周 / 步骤 / 折叠块」并做语法高亮，
// 浏览器只拿 HTML 与结构数据 —— highlight.js 与 marked 不会进客户端包。
//
// ⚠️ 为什么周用查询参数而不是 /study/java/3：
//    页面守卫是 pages.includes(pathname) 的**精确匹配**，子路由必须逐条登记进 Java 的 PageRoutes，
//    17 周 × 3 门语言会往权限表里塞 51 条垃圾。本项目对二级页的既有约定就是 ?id= / ?track=（见 practice、learning）。
//
// ⚠️ 新增语言要三处同步：文档目录 + Java 的 MenuTree + Java 的 PageRoutes。
import fs from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import StudyReader from "@/components/study-reader"
import { parseStudy } from "@/lib/study-render"
import { STUDY_DOCS, STUDY_LANGS } from "@/lib/study"

export const dynamicParams = false

export function generateStaticParams() {
	return STUDY_LANGS.map((lang) => ({ lang }))
}

export default async function StudyPage({ params }: { params: Promise<{ lang: string }> }) {
	const { lang } = await params
	const doc = STUDY_DOCS[lang]
	if (!doc) notFound()

	const file = path.join(process.cwd(), "src", "content", "study", `${lang}.md`)
	let markdown: string
	try {
		markdown = await fs.readFile(file, "utf8")
	} catch {
		// 缺文件不该白屏：给一条能看懂的错误，比 500 好排查
		markdown = `> 文档缺失：\`src/content/study/${lang}.md\` 未找到。`
	}

	const data = parseStudy(markdown)
	// 构建期自检：周数/步骤数为 0 说明 markdown 结构没被识别（标题层级变了），别让它静默上线
	if (process.env.NODE_ENV === "production") {
		console.log(`[study] ${lang}: weeks=${data.weeks.length} steps=${data.totalSteps}`)
	}
	if (!data.weeks.length) throw new Error(`study/${lang}.md 没解析出任何周，检查「第 N 周：」标题格式`)

	return (
		<Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
			<StudyReader doc={doc} data={data} />
		</Suspense>
	)
}
