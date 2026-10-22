"use client"
// 文档页面的统一外壳：`.doc-scope` + 样式注入 + 左侧大纲 / 正文两栏。
//
// 只在「编程学习」三个页面里用（学习路线、周计划、实践项目），不包裹整站：
// 笔记、练习等页仍走 MD_BODY_CSS，两套排版互不影响。
// 侧栏在窄屏折进 <details>；给的是同一份 ReactNode，导航本身无内部状态，重复渲染无副作用。
import type { ReactNode } from "react"
import { DOC_CSS } from "./doc-css"

export default function DocShell({
	aside,
	asideTitle = "本页目录",
	children,
}: {
	aside?: ReactNode
	asideTitle?: string
	children: ReactNode
}) {
	return (
		<div className="doc-scope">
			<style>{DOC_CSS}</style>
			<div className="doc-layout">
				{aside && <aside className="doc-aside">{aside}</aside>}
				<div className="doc-main">
					{aside && (
						<details className="doc-mobile-aside">
							<summary>{asideTitle}</summary>
							<div className="doc-mobile-aside-body">{aside}</div>
						</details>
					)}
					{children}
				</div>
			</div>
		</div>
	)
}
