"use client"
// 渲染服务端/客户端已消毒的文档 HTML，并用事件委托处理代码块复制。
//
// 复制按钮在 HTML 里（见 lib/doc-html），这里不碰 DOM 结构，只改按钮文案做反馈，
// 所以即便父组件重新渲染、innerHTML 被整体替换，也不会留下失效的监听器。
import type { MouseEvent } from "react"
import { toast } from "@/lib/toast"

export default function DocHtml({ html, className = "" }: { html: string; className?: string }) {
	async function onClick(e: MouseEvent<HTMLDivElement>) {
		const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-copy]")
		if (!btn) return
		const text = btn.closest(".doc-code")?.querySelector("pre code")?.textContent ?? ""
		if (!text) return
		try {
			await navigator.clipboard.writeText(text)
			const prev = btn.textContent
			btn.textContent = "已复制"
			window.setTimeout(() => {
				btn.textContent = prev || "复制"
			}, 1500)
		} catch {
			toast.error("复制失败，请手动选中")
		}
	}

	return <div className={`doc-body ${className}`} onClick={(e) => void onClick(e)} dangerouslySetInnerHTML={{ __html: html }} />
}
