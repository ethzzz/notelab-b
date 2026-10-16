// 剪贴板 HTML → Markdown。
//
// 存在意义：md-editor 的正文区是 <textarea>，而 textarea 只接受纯文本 ——
// 从网页 / Word 复制时，剪贴板里其实**同时有** text/html 与 text/plain，
// 浏览器只把 text/plain 塞进来，于是「标题 / 有序列表 / 加粗 / 链接」的结构全部丢失
// （实测见 .agent/scripts/notes-paste-shot.mjs）。
// 这里把 text/html 那一路转成 Markdown，粘进去的就是带格式的源码。
//
// ⚠️ 转换前先过 DOMPurify：剪贴板 HTML 来自任意网站。turndown 输出的是 Markdown 文本
//    （不会被当 HTML 执行），但先消毒可以省掉「turndown 默认规则是否覆盖了某个危险节点」这类推断。
import { gfm } from "@joplin/turndown-plugin-gfm"
import DOMPurify from "dompurify"
import TurndownService from "turndown"

/**
 * turndown 实例**懒建**
 *
 * 不只是省一次构造：它内部会碰 DOM，放在模块顶层构造会把「SSR 时能不能 require」
 * 变成一个需要验证的问题（md-editor 在 /notes 是 ssr:false，但 /practice 是直接 import）。
 * 懒建之后，Node 侧只 require 不执行，天然安全。
 */
let service: TurndownService | null = null

function getService(): TurndownService {
	if (service) return service

	const td = new TurndownService({
		headingStyle: "atx", // # 标题（而不是 Setext 的 === 下划线式）
		hr: "---",
		bulletListMarker: "-",
		codeBlockStyle: "fenced", // ``` 围栏（而不是 4 空格缩进）
		emDelimiter: "*", // 与工具栏一致：*斜体* / **粗体**
		strongDelimiter: "**",
		linkStyle: "inlined",
	})
	td.use(gfm) // 表格 / 删除线 / 任务列表（编辑器本来就按 GFM 渲染）

	// 图片：外链接原样保留，data: 一律丢弃。
	// data: 是「把图片字节直接内嵌进 src」，飞书 / Notion 之类复制时常这么给 ——
	// 一张截图就能是几十万字符，写进正文会直接撞保存接口的长度上限。
	// turndown 的 addRule 是 unshift 进规则表（后加的优先），所以这里能覆盖掉内置 img 规则。
	td.addRule("image", {
		filter: "img",
		replacement: (_content, node) => {
			const el = node as HTMLImageElement
			const src = el.getAttribute("src") ?? ""
			if (!src || src.startsWith("data:")) return ""
			const alt = el.getAttribute("alt") ?? ""
			return `![${alt}](${src})`
		},
	})

	service = td
	return td
}

/** 收尾清理：统一换行、压缩空行、去行尾空白 */
function tidy(md: string): string {
	return md
		.replace(/\r\n?/g, "\n")
		.replace(/\n{3,}/g, "\n\n") // 3 个以上连续换行 → 一个空行（块级元素转出来常有多余空行）
		.replace(/[ \t]+$/gm, "")
		.trim()
}

/**
 * 剪贴板 HTML 片段 → Markdown。
 *
 * @returns 转出来的 Markdown；输入为空、或清理后为空时返回 `""`
 *          （调用方应把空结果当作「不拦截，交回浏览器原生粘贴」）
 */
export function htmlToMarkdown(html: string): string {
	if (!html?.trim()) return ""
	try {
		const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
		return tidy(getService().turndown(clean))
	} catch {
		// 转换失败不该让粘贴整个失效 —— 返回空串，调用方回退到原生纯文本粘贴
		return ""
	}
}
