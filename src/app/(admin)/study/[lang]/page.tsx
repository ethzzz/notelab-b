// 学习路线文档页：/admin/study/<lang>
//
// 正文是仓库里的 markdown（src/content/study/*.md），构建时读进来自带进产物 ——
// 不落库、不做在线编辑，改文档 = 改 git（可 diff、可 review、可回滚）。
//
// ⚠️ 新增语言要三处同步：本文档目录 + Java 的 MenuTree + Java 的 PageRoutes。
//    只改这里，菜单不会出现；只改 Java，点进去 404。
import fs from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import StudyReader from "@/components/study-reader"
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

	return <StudyReader doc={doc} markdown={markdown} />
}
