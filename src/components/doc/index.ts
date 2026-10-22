// 编程学习三页共用的文档组件出口。
// 页面按需直接 import 具体文件也可以；这里只收「一个页面要用两三个」的常用组合。
export { default as DocShell } from "./doc-shell"
export { default as DocPager } from "./doc-pager"
export { default as DocMarkdown } from "./doc-markdown"
export { default as DocHtml } from "./doc-html"
export { default as DocCode } from "./doc-code"
export { DOC_CSS } from "./doc-css"
export type { PagerItem } from "./doc-pager"
