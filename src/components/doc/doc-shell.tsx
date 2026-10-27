"use client"
// 文档页面的统一外壳：`.doc-scope` + 样式注入 + 左侧大纲 / 正文两栏（可选右侧「本页目录」一栏）。
//
// 只在「编程学习」三个页面里用（学习路线、周计划、实践项目），不包裹整站：
// 笔记、练习等页仍走 MD_BODY_CSS，两套排版互不影响。
// 侧栏在窄屏折进 <details>；给的是同一份 ReactNode，导航本身无内部状态，重复渲染无副作用。
//
// `toc` 是**可选的第三栏**（右侧）：只有实践项目详情用它 —— 项目目录很长，和本页目录挤在一列时
// 两者都变窄、都要滚；拆开后左侧只负责"选项目"，右侧只负责"跳章节"。
import type { ReactNode } from "react"
import { DOC_CSS } from "./doc-css"

export default function DocShell({
	aside,
	asideTitle = "本页目录",
	toc,
	children,
}: {
	aside?: ReactNode
	asideTitle?: string
	/** 右侧栏（本页目录）。不传则保持原来的两栏布局 */
	toc?: ReactNode
	children: ReactNode
}) {
	return (
		<div className="doc-scope">
			<style>{DOC_CSS}</style>
			<div className={`doc-layout${toc ? " has-toc" : ""}`}>
				{aside && <aside className="doc-aside">{aside}</aside>}
				<div className="doc-main">
					{aside && (
						<details className="doc-mobile-aside">
							<summary>{asideTitle}</summary>
							<div className="doc-mobile-aside-body">
								{aside}
								{/* 窄屏右栏被隐藏，目录折进同一个面板，避免在 1280–1439 这一档失去入口 */}
								{toc && <div className="doc-mobile-toc">{toc}</div>}
							</div>
						</details>
					)}
					{children}
				</div>
				{toc && <aside className="doc-toc">{toc}</aside>}
			</div>
		</div>
	)
}
