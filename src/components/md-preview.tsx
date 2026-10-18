"use client"
// Markdown **渲染**（预览）—— 与编辑器拆开，理由有两条，都不是洁癖：
//   1) 查看态 / 列表页只需要渲染，不需要编辑器。两者同文件时，「只想渲染」的页面
//      会被一起拖进编辑器那条依赖链（现在多了 turndown）；
//   2) 渲染是**可以 SSR** 的轻量逻辑，而编辑器必须 ssr:false ——
//      混在一个模块里就没法规格化地「只懒加载编辑器」。
//
// 预览长什么样只有这一处定义：编辑器（md-editor-impl）与统一入口都从这里取，
// 所以改排版只改 MD_BODY_CSS、改渲染规则只改 renderMd。
import DOMPurify from "dompurify"
import { marked } from "marked"
import { useMemo } from "react"

marked.setOptions({ gfm: true, breaks: true })

/** md → 消毒后的 HTML（无 DOM 环境（预渲染）时 DOMPurify 原样返回，hydration 后客户端重新渲染） */
export function renderMd(md: string): string {
	try {
		return DOMPurify.sanitize(marked.parse(md || "") as string)
	} catch {
		return ""
	}
}

/**
 * 每个**顶层块**在源码里的起始行（1 基），用于编辑区与预览的滚动联动。
 *
 * 为什么不做「滚动百分比同步」：Markdown 源码行数与渲染后的高度**不是线性关系** ——
 * 一段长文本源码 1 行、渲染后折成 4 行；一个 30 行的代码块两边都占 30 行。
 * 按百分比同步，长文会越滚越偏。按「块」对齐，误差最多一个块。
 *
 * ⚠️ 返回数组必须与渲染出的**顶层子元素**一一对应，所以要跳过不产生 DOM 的 token：
 *    `space`（空行）与 `def`（链接定义）。渲染侧按同样顺序给元素打 `data-src-line`。
 * ⚠️ `html` 块可能一次产出多个元素，会让后续索引错位 —— 笔记里极少见，暂不处理。
 */
export function computeBlockStarts(md: string): number[] {
	const nl = (s: string) => (s.match(/\n/g) ?? []).length
	let tokens: { type: string; raw: string }[] = []
	try {
		tokens = marked.lexer(md || "") as unknown as { type: string; raw: string }[]
	} catch (e) {
		// 不静默：返回空会让编辑器的滚动联动失去全部块锚点（退化成比例同步）
		console.warn("[md-preview] computeBlockStarts 解析失败：", e)
		return []
	}
	const out: number[] = []
	let line = 1
	for (const t of tokens) {
		if (t.type === "space" || t.type === "def") {
			line += nl(t.raw)
			continue
		}
		out.push(line)
		line += nl(t.raw)
	}
	return out
}

/** 预览区排版样式（深浅色主题通用：中性灰半透明 + currentColor） */
export const MD_BODY_CSS = `
.md-body{font-size:14px;line-height:1.75;word-break:break-word}
.md-body h1{font-size:1.7em;font-weight:700;margin:.8em 0 .4em;border-bottom:1px solid rgba(128,128,128,.25);padding-bottom:.25em}
.md-body h1:first-child{margin-top:.2em}
.md-body h2{font-size:1.4em;font-weight:700;margin:.8em 0 .4em;border-bottom:1px solid rgba(128,128,128,.18);padding-bottom:.2em}
.md-body h3{font-size:1.15em;font-weight:600;margin:.7em 0 .3em}
.md-body h4,.md-body h5,.md-body h6{font-weight:600;margin:.6em 0 .3em}
.md-body p{margin:.5em 0}
.md-body ul,.md-body ol{padding-left:1.6em;margin:.4em 0}
.md-body li{margin:.2em 0}
.md-body blockquote{border-left:3px solid rgba(128,128,128,.45);padding:.25em .9em;margin:.5em 0;color:rgba(128,128,128,.95);background:rgba(128,128,128,.07);border-radius:0 6px 6px 0}
.md-body code{background:rgba(128,128,128,.16);padding:.15em .4em;border-radius:4px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.md-body pre{background:rgba(128,128,128,.12);padding:.8em 1em;border-radius:8px;overflow:auto;margin:.6em 0}
.md-body pre code{background:none;padding:0;font-size:.88em}
.md-body table{border-collapse:collapse;margin:.6em 0;width:100%}
.md-body th,.md-body td{border:1px solid rgba(128,128,128,.35);padding:.35em .7em;text-align:left}
.md-body th{background:rgba(128,128,128,.1);font-weight:600}
.md-body img{max-width:100%;border-radius:6px}
.md-body hr{border:none;border-top:1px solid rgba(128,128,128,.3);margin:1em 0}
.md-body a{color:#1677ff}
.md-body input[type=checkbox]{margin-right:.4em}
`

/** 纯预览（查看态） */
export function MdPreview({ value, maxHeight }: { value: string; maxHeight?: number | string }) {
	const html = useMemo(() => renderMd(value), [value])
	return (
		<>
			<style>{MD_BODY_CSS}</style>
			<div className="md-body px-1" style={maxHeight ? { maxHeight, overflow: "auto" } : undefined} dangerouslySetInnerHTML={{ __html: html }} />
		</>
	)
}
