"use client"
// ★ Markdown 编辑器的**统一入口**。
//   页面一律 `import MdEditor, { MdPreview } from "@/components/md-editor"` —— 只认这一个路径。
//
// 为什么要有这一层：
//   1) **加载策略只定义一处**。编辑器必须 `ssr: false`（依赖 DOM，且没必要为它做服务端渲染），
//      但「哪个页面记得写 ssr:false」是典型的会漏的事 —— 漏了不报错、只是 SSR 白渲染一遍
//      且首屏多背一份编辑器依赖。收进入口之后不可能再漏。
//   2) 之前各页各写一遍 `dynamic(...)`，写法还不统一（有页面直接 import）。
//      现在页面只管用组件，不关心它怎么加载；改加载方式/加骨架屏只改这里。
//
// ⚠️ 只 re-export **渲染**部分（md-preview），**不要** re-export md-editor-impl：
//    `export ... from "./md-editor-impl"` 是**静态依赖**，会把实现同步打进本模块，
//    `dynamic` 的分包当场失效（编辑器 + turndown 全回到首屏）。
//    渲染部分本身很轻（marked + dompurify）且查看态本来就要用，同步引入没有代价。
import dynamic from "next/dynamic"
import type { MdEditorProps } from "./md-editor-impl"

export { MD_BODY_CSS, MdPreview, renderMd } from "./md-preview"
export type { MdEditorProps } from "./md-editor-impl"

/**
 * 编辑器（默认导出）—— 已包装为「仅客户端 + 懒加载」。
 *
 * `dynamic<MdEditorProps>` 显式带上 props 类型：不写的话推断出来的 props 是空的，
 * 页面传 value/onChange 会直接类型报错。
 */
const MdEditor = dynamic<MdEditorProps>(() => import("./md-editor-impl"), {
	ssr: false,
	loading: () => <div className="px-3 py-6 text-xs text-zinc-400">编辑器加载中…</div>,
})

export default MdEditor
