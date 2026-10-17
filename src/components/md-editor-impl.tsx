"use client"
// Notion 式 Markdown 编辑器：左侧源码（CodeMirror 6 + 工具栏），右侧实时预览（marked 渲染 + DOMPurify 消毒）。
// 窄屏（≤900px）自动折叠为"编辑/预览"单面板切换。受控组件：value/onChange。
//
// ⚠️ 这是**实现**文件，页面不要直接 import 它 —— 统一走 ./md-editor（入口），
//    那里负责 `ssr: false` 的懒加载包装，保证「编辑器怎么加载」只有一处定义。
//    渲染相关（renderMd / MD_BODY_CSS / MdPreview）在 ./md-preview，本文件只是复用。
//
// 为什么用 CodeMirror 6 而不是原生 <textarea>（2026-10-17 换的）：
//   原来是个裸 textarea，除了换行什么都没有 —— 没语法高亮、没快捷键、没括号配对，
//   长文档里找一段代码块全靠肉眼。CodeMirror 提供的是编辑**表面**（高亮/快捷键/搜索/多光标），
//   内容仍是纯 Markdown 字符串，存储与发布链路一字未动。
//   刻意**没有**换成 WYSIWYG（MDXEditor / Milkdown 那类）：它们内部有文档模型，
//   保存时要序列化回 Markdown、会悄悄重排格式 —— 而这个仓每天都要 diff 文章。
//
// 插图：可选注入 onUploadImage —— 传了才在工具栏出现「插入图片」按钮。
// 编辑器**不关心图片存哪**（本仓是 /api/practice/images/{id}），只负责
// 「选文件 → 拿到 URL → 在光标处插入 Markdown」这一段；上传实现由调用方注入。
import { indentWithTab } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import { EditorView, keymap } from "@codemirror/view"
import CodeMirror from "@uiw/react-codemirror"
import { Button, Segmented, Tooltip } from "antd"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MD_BODY_CSS, renderMd } from "@/components/md-preview"
import { htmlToMarkdown } from "@/lib/html-to-md"
import { toast } from "@/lib/toast"

/** 「粘贴时保留格式」的用户偏好（纯客户端，存 localStorage；不进后端配置） */
const KEEP_FORMAT_KEY = "notelab.note.paste_keep_format"

/**
 * 编辑区主题：**背景透明 + 颜色继承**，跟着外层容器走，不用为浅色/深色各维护一套。
 * 字体与原来的 textarea 保持同一个等宽栈。
 * 语法高亮的 token 颜色仍由 CodeMirror 的默认高亮样式提供。
 */
const CM_THEME = EditorView.theme({
	"&": { backgroundColor: "transparent", color: "inherit", fontSize: "13.5px" },
	"&.cm-focused": { outline: "none" },
	".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", lineHeight: "1.7" },
	".cm-content": { padding: "8px 12px", caretColor: "currentColor" },
	".cm-gutters": { backgroundColor: "transparent", border: "none", color: "rgba(128,128,128,.45)" },
	".cm-activeLine": { backgroundColor: "rgba(128,128,128,.07)" },
	".cm-activeLineGutter": { backgroundColor: "transparent" },
	".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(22,119,255,.16)" },
	".cm-cursor": { borderLeftColor: "currentColor" },
})

/** MdEditor 的 props —— 导出来是为了让入口的 `dynamic<MdEditorProps>` 拿到类型 */
export type MdEditorProps = {
	value: string
	onChange: (v: string) => void
	minHeight?: number
	/** 注入后才显示「插入图片」。约定：传入原始 File，返回可直接写进 Markdown 的 URL */
	onUploadImage?: (file: File) => Promise<string>
	/**
	 * 自定义右栏预览；不传则用内置的 marked 预览。
	 *
	 * 用途是 /blog-gen：那里要的是**博客线上效果**（expressive-code 代码高亮 / 提示块 / KaTeX），
	 * 全在构建期/服务端管线里，marked 复刻不了。
	 *
	 * ⚠️ 但**不要用这个塞 iframe**：编辑器自身在某些路径下会被 unmount/remount（实测过），
	 *    而 iframe 一旦跟着重建就会重新加载整页 —— 右栏白一下。
	 *    需要 iframe 的场合请用 `hidePreview` + 自己在外层排两栏（见 /blog-gen）。
	 */
	renderPreview?: (md: string) => ReactNode
	/**
	 * 只渲染编辑区，不渲染内置右栏（也不会渲染窄屏的「编辑/预览」切换）。
	 * 调用方自己负责在旁边放预览 —— 这样预览的生命周期与编辑器解耦。
	 */
	hidePreview?: boolean
}

// ---------------- 工具栏动作 ----------------
// 全部基于 EditorView 操作。原来的版本操作 HTMLTextAreaElement 的 selectionStart/setRangeText，
// 而 CodeMirror 没有这些属性 —— 这是换内核时**唯一需要整体重写**的部分。
type Action = { key: string; label: string; title: string; run: (view: EditorView) => void }

/** 包裹选区（**粗体** 式）；无选区时插入占位文本并选中 */
function wrapSel(view: EditorView, before: string, after: string, placeholder: string) {
	const { from, to } = view.state.selection.main
	const sel = view.state.sliceDoc(from, to) || placeholder
	view.dispatch({
		changes: { from, to, insert: before + sel + after },
		selection: { anchor: from + before.length, head: from + before.length + sel.length },
	})
}

/** 给选区覆盖的每行加前缀（列表/引用式） */
function prefixLines(view: EditorView, prefix: string) {
	const { from, to } = view.state.selection.main
	const startLine = view.state.doc.lineAt(from)
	// ⚠️ 选区末尾若正好落在行首，那一行不该被算进来（否则「光标停在第一行末」会把下一行也加上前缀）
	const endLine = to > from && view.state.doc.lineAt(to).from === to ? null : view.state.doc.lineAt(to)
	const lineEnd = endLine ? endLine.to : to
	const seg = view.state.sliceDoc(startLine.from, lineEnd)
	const out = seg
		.split("\n")
		.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
		.join("\n")
	view.dispatch({ changes: { from: startLine.from, to: lineEnd, insert: out } })
}

function insertBlock(view: EditorView, text: string) {
	const { from, to } = view.state.selection.main
	const prev = from > 0 ? view.state.sliceDoc(from - 1, from) : ""
	const needNL = from > 0 && prev !== "\n" ? "\n" : ""
	const insert = needNL + text
	view.dispatch({
		changes: { from, to, insert },
		selection: { anchor: from + insert.length },
	})
}

const ACTIONS: Action[] = [
	{ key: "b", label: "B", title: "粗体 **文本**", run: (v) => wrapSel(v, "**", "**", "粗体文本") },
	{ key: "i", label: "I", title: "斜体 *文本*", run: (v) => wrapSel(v, "*", "*", "斜体文本") },
	{ key: "s", label: "S̶", title: "删除线 ~~文本~~", run: (v) => wrapSel(v, "~~", "~~", "删除文本") },
	{ key: "h1", label: "H1", title: "一级标题", run: (v) => prefixLines(v, "# ") },
	{ key: "h2", label: "H2", title: "二级标题", run: (v) => prefixLines(v, "## ") },
	{ key: "h3", label: "H3", title: "三级标题", run: (v) => prefixLines(v, "### ") },
	{ key: "ul", label: "•—", title: "无序列表", run: (v) => prefixLines(v, "- ") },
	{ key: "ol", label: "1.", title: "有序列表", run: (v) => prefixLines(v, "1. ") },
	{ key: "task", label: "☑", title: "任务列表", run: (v) => prefixLines(v, "- [ ] ") },
	{ key: "quote", label: "❝", title: "引用", run: (v) => prefixLines(v, "> ") },
	{ key: "code", label: "</>", title: "行内代码", run: (v) => wrapSel(v, "`", "`", "code") },
	{ key: "pre", label: "```", title: "代码块", run: (v) => insertBlock(v, "```\n\n```\n") },
	{ key: "link", label: "🔗", title: "链接 [文本](url)", run: (v) => wrapSel(v, "[", "](https://)", "链接文本") },
	{ key: "table", label: "▦", title: "表格", run: (v) => insertBlock(v, "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n") },
	{ key: "hr", label: "―", title: "分割线", run: (v) => insertBlock(v, "\n---\n") },
]

export default function MdEditor({ value, onChange, minHeight = 480, onUploadImage, renderPreview, hidePreview = false }: MdEditorProps) {
	const viewRef = useRef<EditorView | null>(null)
	const fileRef = useRef<HTMLInputElement>(null)
	/**
	 * 本次粘贴是否要「强制纯文本」（Ctrl/Cmd+Shift+V）。
	 *
	 * ⚠️ 不能在 paste 事件上读 `e.shiftKey`：ClipboardEvent 继承自 UIEvent，**规范里没有这个属性**
	 *    （shiftKey 属于 KeyboardEvent / MouseEvent）。改为 keydown 时记录 ——
	 *    键盘触发粘贴时，keydown 一定先于 paste。
	 */
	const pastePlainRef = useRef(false)
	const [narrow, setNarrow] = useState(false)
	const [pane, setPane] = useState<"edit" | "preview">("edit")
	const [uploading, setUploading] = useState(false)

	// 粘贴保留格式：默认开。
	// ⚠️ 读 localStorage 放在 effect 里，不要写进 useState 的初始化函数：
	//    组件现在由入口统一 ssr:false，但「初始化函数会在预渲染时执行」这个坑很隐蔽 ——
	//    一旦哪天有页面绕过入口直接引本文件，就会在 Node 侧炸（localStorage is not defined）。
	const [keepFormat, setKeepFormat] = useState(true)
	useEffect(() => {
		try {
			setKeepFormat(localStorage.getItem(KEEP_FORMAT_KEY) !== "0")
		} catch {
			// 隐私模式 / 存储被禁：保持默认值（开）即可
		}
	}, [])

	function toggleKeepFormat() {
		setKeepFormat((v) => {
			const next = !v
			try {
				localStorage.setItem(KEEP_FORMAT_KEY, next ? "1" : "0")
			} catch {
				// 存不下就只影响本次会话，不打断用户
			}
			return next
		})
	}

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 900px)")
		const on = () => setNarrow(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [])

	// 有自定义预览时不跑 marked：省一次反正没人看的解析
	const html = useMemo(() => (renderPreview ? "" : renderMd(value)), [value, renderPreview])

	// 语言 / 主题 / Tab 缩进：与 keepFormat 无关，**引用必须稳定**。
	// 不稳定的话每次渲染都会 reconfigure，光标位置与撤销历史会丢。
	const baseExtensions = useMemo(() => [markdown(), CM_THEME, EditorView.lineWrapping, keymap.of([indentWithTab])], [])

	/**
	 * 粘贴：把外部富文本（网页 / Word 的 text/html）转成 Markdown 再插入。
	 *
	 * 四种情况**不拦截**（返回 false → 交回 CodeMirror 的默认粘贴 = 纯文本）：
	 *   ① 开关关掉；② 按住 Shift（Ctrl+Shift+V 是浏览器内置的「粘贴为纯文本」）；
	 *   ③ 剪贴板没有 text/html；④ 转换结果为空（例如只复制了一张内嵌 data: 图）——
	 *      ③④ 若还拦下来，表现就是「粘贴了但什么都没发生」，比粘进纯文本更糟。
	 *
	 * ⚠️ getData 必须**同步**读：ClipboardEvent 在事件处理返回后即失效。
	 * ⚠️ 这段单独 memo（依赖 keepFormat），切换开关时只重建这一条，不动语言与主题 ——
	 *    否则会把撤销历史一起清掉。
	 */
	const pasteExtensions = useMemo(
		() => [
			EditorView.domEventHandlers({
				keydown: (e) => {
					if (/^v$/i.test(e.key)) pastePlainRef.current = e.shiftKey
					return false
				},
				paste: (e, view) => {
					const plain = pastePlainRef.current
					pastePlainRef.current = false
					if (!keepFormat || plain) return false
					const pasted = e.clipboardData?.getData("text/html")
					if (!pasted) return false
					const md = htmlToMarkdown(pasted)
					if (!md) return false
					const { from, to } = view.state.selection.main
					view.dispatch({
						changes: { from, to, insert: md },
						selection: { anchor: from + md.length },
					})
					return true // 已处理，阻止默认粘贴
				},
			}),
		],
		[keepFormat],
	)

	function runAction(a: Action) {
		const view = viewRef.current
		if (!view) return
		a.run(view)
		view.focus()
		// 内容变化经 CodeMirror 的 updateListener 回传给 onChange，这里不必再手动触发
	}

	/**
	 * 选图 → 上传 → 在光标处插入 `![alt](url)`。
	 *
	 * ⚠️ 必须先把 input.value 清空再上传：不清的话，用户连续选**同一个文件**第二次时
	 * change 事件不触发（浏览器认为值没变），表现为「点了没反应」。
	 */
	async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
		const input = e.currentTarget
		const f = input.files?.[0]
		input.value = ""
		if (!f || !onUploadImage) return
		if (!f.type.startsWith("image/")) {
			toast.warning("只能插入图片文件")
			return
		}
		setUploading(true)
		try {
			const url = await onUploadImage(f)
			const alt = f.name.replace(/\.[^.]+$/, "") || "图片"
			const view = viewRef.current
			if (view) {
				insertBlock(view, `![${alt}](${url})`)
				view.focus()
			} else {
				onChange(`${value}\n![${alt}](${url})\n`)
			}
			toast.success("图片已插入")
		} catch (err) {
			toast.error(`图片上传失败：${(err as Error)?.message || err}`)
		}
		setUploading(false)
	}

	const toolbar = (
		<div className="flex flex-wrap items-center gap-1 border-b border-solid border-[rgba(128,128,128,.25)] pb-2">
			{ACTIONS.map((a, i) => (
				<span key={a.key} className="contents">
					{(i === 3 || i === 6 || i === 10 || i === 13) && <span className="mx-1 h-5 w-px bg-[rgba(128,128,128,.3)]" />}
					<Tooltip title={a.title}>
						<Button size="small" type="text" className="min-w-8 px-1.5 font-mono text-xs" onClick={() => runAction(a)}>
							{a.label}
						</Button>
					</Tooltip>
				</span>
			))}
			{onUploadImage && (
				<span className="contents">
					<span className="mx-1 h-5 w-px bg-[rgba(128,128,128,.3)]" />
					<Tooltip title="插入图片（上传后在光标处插入 Markdown）">
						<Button
							size="small"
							type="text"
							loading={uploading}
							disabled={uploading}
							className="min-w-8 px-1.5 text-xs"
							onClick={() => fileRef.current?.click()}
						>
							{"🖼"}
						</Button>
					</Tooltip>
					{/* ⚠️ 用 display:none 而不是条件渲染：input 必须在 DOM 里，click() 才有东西可点 */}
					<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
				</span>
			)}
			<span className="contents">
				<span className="mx-1 h-5 w-px bg-[rgba(128,128,128,.3)]" />
				<Tooltip
					title={
						keepFormat
							? "粘贴时保留格式：开 —— 从网页/Word 复制的标题、列表、加粗会转成 Markdown；按住 Ctrl+Shift+V 可临时按纯文本粘贴"
							: "粘贴时保留格式：关 —— 当前粘贴为纯文本"
					}
				>
					<Button
						size="small"
						type={keepFormat ? "primary" : "text"}
						ghost={keepFormat}
						className="min-w-8 px-1.5 text-xs"
						onClick={toggleKeepFormat}
					>
						{"📋"}
					</Button>
				</Tooltip>
			</span>
			{narrow && !hidePreview && (
				<Segmented
					size="small"
					className="ml-auto"
					value={pane}
					onChange={(v) => setPane(v as "edit" | "preview")}
					options={[
						{ label: "编辑", value: "edit" },
						{ label: "预览", value: "preview" },
					]}
				/>
			)}
		</div>
	)

	const editPane = (
		<CodeMirror
			value={value}
			height={`${minHeight}px`}
			placeholder="用 Markdown 书写…（支持 GFM：表格/任务列表/删除线）"
			theme="light"
			basicSetup={{
				lineNumbers: false, // 笔记不需要行号，观感与原来的 textarea 一致
				foldGutter: false,
				highlightActiveLineGutter: false,
				highlightActiveLine: true,
				autocompletion: false, // Markdown 的自动补全会挡住输入
			}}
			extensions={[...baseExtensions, ...pasteExtensions]}
			onChange={(v) => onChange(v)}
			onCreateEditor={(view) => {
				viewRef.current = view
			}}
			className="w-full"
		/>
	)

	const previewPane = renderPreview ? (
		// 自定义预览自己负责滚动与高度（/blog-gen 塞的是博客的 iframe）
		<div className="w-full flex-1 overflow-hidden" style={{ minHeight }}>
			{renderPreview(value)}
		</div>
	) : (
		<div className="md-body w-full flex-1 overflow-auto px-4 py-2" style={{ minHeight }} dangerouslySetInnerHTML={{ __html: html }} />
	)

	return (
		<>
			<style>{MD_BODY_CSS}</style>
			<div>
				{toolbar}
				{hidePreview ? (
					// 单栏：预览由调用方自己放在外面（这样它不会跟着编辑器一起重建）
					<div className="flex">{editPane}</div>
				) : narrow ? (
					pane === "edit" ? (
						<div className="flex">{editPane}</div>
					) : (
						<div className="flex border-t border-dashed border-[rgba(128,128,128,.25)] pt-2">{previewPane}</div>
					)
				) : (
					<div className="grid grid-cols-2 gap-3 pt-2">
						<div className="flex rounded-lg border border-solid border-[rgba(128,128,128,.3)]">{editPane}</div>
						<div className="flex rounded-lg border border-dashed border-[rgba(128,128,128,.35)]">{previewPane}</div>
					</div>
				)}
			</div>
		</>
	)
}
