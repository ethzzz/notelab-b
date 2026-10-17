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

/**
 * 最近建过的预览：**同一份内容只换一个 token**。
 *
 * 为什么需要它：初始化 effect 在某些路径下会被触发不止一次（父级重挂 / effect 重跑），
 * 而每次 POST 都拿到**新 token** → iframe 的 `src` 变 → 右栏白一下。
 * 加了这层缓存后，「重复初始化」退化成 no-op：相同内容 → 相同地址 → 不发生导航。
 *
 * ⚠️ TTL 必须比后端短：Java 侧是 30 分钟，这里留 20 分钟余量，
 *    否则命中一个已过期的 token，iframe 会显示「预览已过期」。
 */
const CACHE_LIMIT = 24
const CACHE_TTL_MS = 20 * 60_000
const CACHE = new Map<string, { url: string; at: number }>()

/** 内容指纹（djb2）：只用于缓存命中，不做安全用途 */
function fingerprint(s: string): string {
	let h = 5381
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
	return String(h)
}

/** 建一份预览，返回带尾斜杠的绝对地址（`/blog/preview/<token>/`） */
async function makePreview(fields: Record<string, unknown>, md: string): Promise<string> {
	const key = `${String(fields.slug)}|${fingerprint(md)}`
	const hit = CACHE.get(key)
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.url

	const r = await postJson("/api/blog/preview", { ...fields, content_md: md })
	const url = `${window.location.origin}${r.url as string}`

	if (CACHE.size >= CACHE_LIMIT) {
		const oldest = CACHE.keys().next().value
		if (oldest) CACHE.delete(oldest)
	}
	CACHE.set(key, { url, at: Date.now() })
	return url
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
	/** 已建好的预览地址。**必须是 ref**，见下面 effect 里的说明 */
	const srcRef = useRef("")
	const [src, setSrc] = useState("")
	const [ready, setReady] = useState(false)
	const [err, setErr] = useState("")
	const [updating, setUpdating] = useState(false)

	const fields = { title, slug, category, tags, description, draft }

	/**
	 * ① 首次拿到正文时建 iframe。
	 *
	 * ⚠️ 判据必须用 ref，不能用 state：
	 *    effect 闭包捕获的 `src` 是**那次渲染时的快照**。POST 还在飞的时候如果正文又变了，
	 *    React 会排一个新 effect，而它手里的 `src` 仍是 `""` —— 等上一个 POST 收尾、
	 *    `buildingRef` 一复位，它就会再 POST 一次、再 setSrc 一次 → iframe 导航 → 右栏白一下。
	 *    这个 bug 只能靠「读最新值」的 ref 挡住（验收时实测到 token 变了两次才定位到）。
	 *
	 * ⚠️ 也不能写成「只在 slug 变化时跑」：组件挂载时正文通常还是空的，那次会直接 return，
	 *    等用户开始写时 effect 又不会重跑 —— 预览永远是 about:blank（第一版就是这个错）。
	 *
	 * 切换文章由父组件传 `key` 重建本组件（状态自然清空），不需要在这里盯 slug。
	 */
	useEffect(() => {
		if (srcRef.current || buildingRef.current || !content.trim()) return
		buildingRef.current = true
		void (async () => {
			try {
				const url = await makePreview(fields, content)
				if (srcRef.current) return // 并发窗口里已经被设过了，别覆盖
				srcRef.current = `${url}?embed=1`
				setErr("")
				setSrc(srcRef.current)
			} catch (e) {
				setErr(`预览初始化失败：${(e as Error)?.message || e}`)
			} finally {
				buildingRef.current = false
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content])

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
