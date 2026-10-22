"use client"
// 文档底部的「上一篇 / 下一篇」。
// 两侧都是可选项：只有一侧时靠边显示（`.is-next` 用 margin-left:auto），不会留半个空盒。

export type PagerItem = {
	/** 「上一课」「上一周」「上个项目」 */
	label: string
	title: string
	onClick: () => void
}

export default function DocPager({ prev, next }: { prev?: PagerItem; next?: PagerItem }) {
	if (!prev && !next) return null
	return (
		<nav className="doc-pager">
			{prev && (
				<button type="button" className="doc-pager-btn" onClick={prev.onClick}>
					<span className="doc-pager-dir">← {prev.label}</span>
					<span className="doc-pager-title">{prev.title}</span>
				</button>
			)}
			{next && (
				<button type="button" className="doc-pager-btn is-next" onClick={next.onClick}>
					<span className="doc-pager-dir">{next.label} →</span>
					<span className="doc-pager-title">{next.title}</span>
				</button>
			)}
		</nav>
	)
}
