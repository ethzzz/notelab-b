// 文档 HTML 的代码块装饰（纯字符串处理，服务端与客户端共用）。
//
// marked 产出的代码块只有 `<pre><code class="hljs language-x">`，没有语言标签和复制按钮。
// 这里统一包成 `.doc-code` 结构；复制行为由客户端 <DocHtml> 事件委托处理，
// 所以按钮可以先渲染进 HTML，不依赖后续 DOM 改写（危险地设置 innerHTML 的容器
// 一旦重新渲染，任何手动插入的节点都会被整体替换掉）。
//
// 之所以不放进 study-render.ts：那个模块只能在 Node 里跑，而学习路线的课时正文
// 是浏览器端渲染的，两边要产出同一种代码块外观。

const PRE_RE = /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g

/** 语言名来自 Markdown 围栏信息，进 HTML 前只留安全字符 */
function safeLang(raw: string): string {
	return raw.replace(/[^a-z0-9+#.-]/gi, "").slice(0, 24).toLowerCase()
}

export function decorateCodeBlocks(html: string): string {
	if (!html || !html.includes("<pre>")) return html
	return html.replace(PRE_RE, (_m, cls: string | undefined, inner: string) => {
		const found = (cls || "").match(/language-([^\s]+)/)
		const lang = found ? safeLang(found[1]) : ""
		return (
			`<div class="doc-code">` +
			`<div class="doc-code-head">` +
			`<span class="doc-code-lang">${lang || "code"}</span>` +
			`<button type="button" class="doc-code-copy" data-copy>复制</button>` +
			`</div>` +
			`<pre><code class="hljs${lang ? ` language-${lang}` : ""}">${inner}</code></pre>` +
			`</div>`
		)
	})
}
