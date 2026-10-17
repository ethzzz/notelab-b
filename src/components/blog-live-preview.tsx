"use client"
// 博客线上效果的**实时**预览（/blog-gen 的右栏）。
//
// 为什么不在后台渲染：正文的观感来自 expressive-code 代码高亮 / 提示块 / KaTeX / 标题锚点，
// 全在博客侧的构建期与服务端管线里（博客仓 src/utils/runtime-markdown.ts）。后台用 marked
// 永远只是「另一套观感」。所以这里只放一个 iframe，指向**博客自己的预览页**。
//
// 两条链路刻意分开，为了「像实时，但不浪费」：
//   ① 首屏 / 切换文章：POST /api/blog/preview 换一个 token → iframe 载入
//      `/blog/preview/<token>/?embed=1`（embed = 只输出文章内容区，导航/侧栏/目录/页脚都由 CSS 藏掉）
//   ② 之后的每次改动：**不刷新 iframe**（会白屏、会丢滚动位置，打字时每停一次都闪根本没法用），
//      而是 POST 拿新 token → GET `<token>/fragment`（**只有正文 HTML**，几 KB）
//      → postMessage 让博客页内那段脚本替换正文。监听端见博客仓 src/pages/preview/[token].astro。
//
// ⚠️ 每次改动都会 POST 一份新 token。Java 侧是 30 分钟 TTL + 200 条上限、超了自动回收，
//    刻意没做「同 token 覆盖」：那要多一套「创建/更新」语义 + 归属校验，省下的只是几条内存记录。
import { postJson } from "@/lib/api"
import { useEffect, useRef, useState } from "react"

export type BlogLivePreviewProps = {
	title: string
	slug: string
	category?: string
	/** 标签：草稿里是数组，接口原样透传给博客侧 */
	tags?: string | string[]
	description?: string
	draft?: boolean
	content: string
	/** iframe 高度（px），与编辑器右栏尽量一致 */
	height?: number
	/** 防抖：停止敲键盘多久之后才更新预览 */
	debounceMs?: number
}

/** 建一份预览，返回带尾斜杠的绝对地址（`/blog/preview/<token>/`） */
async function makePreview(fields: Record<string, unknown>, md: string): Promise<string> {
	const r = await postJson("/api/blog/preview", { ...fields, content_md: md })
	return `${window.location.origin}${r.url as string}`
}

export default function BlogLivePreview({
	title,
	slug,
	category,
	tags,
	description,
	draft,
	content,
	height = 500,
	debounceMs = 900,
}: BlogLivePreviewProps) {
	const frameRef = useRef<HTMLIFrameElement>(null)
	const buildingRef = useRef(false)
	const [src, setSrc] = useState("")
	const [ready, setReady] = useState(false)
	const [err, setErr] = useState("")
	const [updating, setUpdating] = useState(false)

	const fields = { title, slug, category, tags, description, draft }

	/**
	 * ① 首次拿到正文时建 iframe。
	 *
	 * ⚠️ 不能写成「只在 slug 变化时跑」：组件挂载时正文通常还是空的（页面刚打开、用户还没写），
	 *    那次 effect 直接 return；等用户开始写了，effect 又不会重跑 —— 预览永远是 about:blank。
	 *    （第一版就是这么写的，验收时被抓出来的。）
	 *    所以判据是「有内容 && 还没有 src」，`buildingRef` 挡住重叠请求。
	 *    切换文章由父组件传 `key` 重建本组件（状态自动清空），不需要在这里盯 slug。
	 */
	useEffect(() => {
		if (src || buildingRef.current || !content.trim()) return
		buildingRef.current = true
		void (async () => {
			try {
				const url = await makePreview(fields, content)
				setErr("")
				setSrc(`${url}?embed=1`)
			} catch (e) {
				setErr(`预览初始化失败：${(e as Error)?.message || e}`)
			} finally {
				buildingRef.current = false
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content, src])

	// ② 内容 / 元信息变化 → 防抖后局部替换。
	//    ready 之前不发：iframe 里的监听脚本还没挂上，发了也是白发。
	useEffect(() => {
		if (!ready || !content.trim()) return
		const t = setTimeout(() => {
			void (async () => {
				try {
					setUpdating(true)
					const url = await makePreview(fields, content)
					// ⚠️ 尾斜杠不能省：博客仓是 `trailingSlash: "always"`，
					//    请求 /fragment 会先吃一个 301 再跟到 /fragment/（每次更新多一次往返）
					const res = await fetch(`${url}fragment/`, { cache: "no-store" })
					if (!res.ok) return
					const d = (await res.json()) as {
						ok?: boolean
						html?: string
						title?: string
						words?: string
						minutes?: string
					}
					if (!d?.ok || typeof d.html !== "string") return
					frameRef.current?.contentWindow?.postMessage(
						{ type: "notelab-preview", html: d.html, title: d.title, words: d.words, minutes: d.minutes },
						window.location.origin,
					)
				} catch {
					// 局部更新失败**静默**：正在写东西的人不该被一个预览错误打断。
					// 初始化才提示（见上面的 err）—— 那时用户确实什么都看不到。
				} finally {
					setUpdating(false)
				}
			})()
		}, debounceMs)
		return () => clearTimeout(t)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content, title, tags, category, description, draft, ready, debounceMs])

	if (!content.trim()) {
		return (
			<div style={{ height }} className="flex items-center justify-center text-xs text-zinc-400">
				还没有正文
			</div>
		)
	}
	if (err) {
		return (
			<div style={{ height }} className="flex flex-col items-center justify-center gap-1 px-6 text-center text-xs">
				<span className="text-red-500">{err}</span>
				<span className="text-zinc-400">博客侧预览服务没响应，正文本身不受影响</span>
			</div>
		)
	}

	return (
		<div className="relative w-full" style={{ height }}>
			{!src && <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">预览加载中…</div>}
			<iframe
				ref={frameRef}
				src={src || "about:blank"}
				title="博客预览"
				onLoad={() => setReady(true)}
				className="h-full w-full border-0 bg-white"
			/>
			{updating && (
				<span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
					更新中
				</span>
			)}
		</div>
	)
}
