"use client"
// 客户端 Markdown 渲染（学习路线的课时正文走这里：内容来自接口，不在服务端产物里）。
//
// 关键点：用**独立的** Marked 实例，不碰 md-preview 里全局 `marked.use()` 的那一份 ——
// 那个模块同时服务笔记 / 练习，改它的渲染器会影响整站。
//
// 代码块用 highlight.js 着色后，再由 decorateCodeBlocks 包上语言标签与复制按钮，
// 与服务端渲染的周计划 / 实践项目保持同一种外观。
import { useMemo } from "react"
import { Marked } from "marked"
import DOMPurify from "dompurify"
import { decorateCodeBlocks } from "@/lib/doc-html"
import { highlightToHtml } from "./highlight"
import DocHtml from "./doc-html"

const md = new Marked({ gfm: true, breaks: true })

md.use({
	renderer: {
		code({ text, lang }) {
			const { html, lang: key } = highlightToHtml(text, lang)
			return `<pre><code class="hljs${key ? ` language-${key}` : ""}">${html}</code></pre>`
		},
	},
})

export default function DocMarkdown({ value, className = "" }: { value: string; className?: string }) {
	const html = useMemo(() => {
		try {
			return decorateCodeBlocks(DOMPurify.sanitize(md.parse(value || "") as string))
		} catch {
			return ""
		}
	}, [value])
	return <DocHtml html={html} className={className} />
}
