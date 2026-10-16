"use client"
// Notion 式 Markdown 编辑器：左侧源码（等宽字体+工具栏），右侧实时预览（marked 渲染 + DOMPurify 消毒）。
// 窄屏（≤900px）自动折叠为"编辑/预览"单面板切换。受控组件：value/onChange。
//
// ⚠️ 这是**实现**文件，页面不要直接 import 它 —— 统一走 ./md-editor（入口），
//    那里负责 `ssr: false` 的懒加载包装，保证「编辑器怎么加载」只有一处定义。
//    渲染相关（renderMd / MD_BODY_CSS / MdPreview）在 ./md-preview，本文件只是复用。
//
// 插图：可选注入 onUploadImage —— 传了才在工具栏出现「插入图片」按钮。
// 编辑器**不关心图片存哪**（本仓是 /api/practice/images/{id}），只负责
// 「选文件 → 拿到 URL → 在光标处插入 Markdown」这一段；上传实现由调用方注入。
import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Segmented, Tooltip } from "antd"
import { MD_BODY_CSS, renderMd } from "@/components/md-preview"
import { htmlToMarkdown } from "@/lib/html-to-md"
import { toast } from "@/lib/toast"

/** 「粘贴时保留格式」的用户偏好（纯客户端，存 localStorage；不进后端配置） */
const KEEP_FORMAT_KEY = "notelab.note.paste_keep_format"

/** MdEditor 的 props —— 导出来是为了让入口的 `dynamic<MdEditorProps>` 拿到类型 */
export type MdEditorProps = {
	value: string
	onChange: (v: string) => void
	minHeight?: number
	/** 注入后才显示「插入图片」。约定：传入原始 File，返回可直接写进 Markdown 的 URL */
	onUploadImage?: (file: File) => Promise<string>
}

// ---------------- 工具栏动作 ----------------
type Action = { key: string; label: string; title: string; run: (ta: HTMLTextAreaElement) => void }

/** 包裹选区（**粗体** 式）；无选区时插入占位文本并选中 */
function wrapSel(ta: HTMLTextAreaElement, before: string, after: string, placeholder: string) {
	const { selectionStart: s, selectionEnd: e, value } = ta
	const sel = value.slice(s, e) || placeholder
	ta.setRangeText(before + sel + after, s, e, "select")
	ta.selectionStart = s + before.length
	ta.selectionEnd = s + before.length + sel.length
}

/** 给选区覆盖的每行加前缀（列表/引用式） */
function prefixLines(ta: HTMLTextAreaElement, prefix: string) {
	const { selectionStart: s, selectionEnd: e, value } = ta
	const ls = value.lastIndexOf("\n", s - 1) + 1
	const seg = value.slice(ls, Math.max(e, s))
	const out = seg
		.split("\n")
		.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
		.join("\n")
	ta.setRangeText(out, ls, Math.max(e, s), "end")
}

function insertBlock(ta: HTMLTextAreaElement, text: string) {
	const { selectionStart: s, selectionEnd: e, value } = ta
	const needNL = s > 0 && value[s - 1] !== "\n" ? "\n" : ""
	ta.setRangeText(needNL + text, s, e, "end")
}

const ACTIONS: Action[] = [
	{ key: "b", label: "B", title: "粗体 **文本**", run: (ta) => wrapSel(ta, "**", "**", "粗体文本") },
	{ key: "i", label: "I", title: "斜体 *文本*", run: (ta) => wrapSel(ta, "*", "*", "斜体文本") },
	{ key: "s", label: "S̶", title: "删除线 ~~文本~~", run: (ta) => wrapSel(ta, "~~", "~~", "删除文本") },
	{ key: "h1", label: "H1", title: "一级标题", run: (ta) => prefixLines(ta, "# ") },
	{ key: "h2", label: "H2", title: "二级标题", run: (ta) => prefixLines(ta, "## ") },
	{ key: "h3", label: "H3", title: "三级标题", run: (ta) => prefixLines(ta, "### ") },
	{ key: "ul", label: "•—", title: "无序列表", run: (ta) => prefixLines(ta, "- ") },
	{ key: "ol", label: "1.", title: "有序列表", run: (ta) => prefixLines(ta, "1. ") },
	{ key: "task", label: "☑", title: "任务列表", run: (ta) => prefixLines(ta, "- [ ] ") },
	{ key: "quote", label: "❝", title: "引用", run: (ta) => prefixLines(ta, "> ") },
	{ key: "code", label: "</>", title: "行内代码", run: (ta) => wrapSel(ta, "`", "`", "code") },
	{ key: "pre", label: "```", title: "代码块", run: (ta) => insertBlock(ta, "```\n\n```\n") },
	{ key: "link", label: "🔗", title: "链接 [文本](url)", run: (ta) => wrapSel(ta, "[", "](https://)", "链接文本") },
	{ key: "table", label: "▦", title: "表格", run: (ta) => insertBlock(ta, "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n") },
	{ key: "hr", label: "―", title: "分割线", run: (ta) => insertBlock(ta, "\n---\n") },
]

export default function MdEditor({ value, onChange, minHeight = 480, onUploadImage }: MdEditorProps) {
	const taRef = useRef<HTMLTextAreaElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)
	/**
	 * 本次粘贴是否要「强制纯文本」（Ctrl/Cmd+Shift+V）。
	 *
	 * ⚠️ 不能读 `e.shiftKey`：ClipboardEvent 继承自 UIEvent，**规范里根本没有这个属性**
	 *    （shiftKey 属于 KeyboardEvent / MouseEvent），TS 直接报 TS2339，
	 *    运行时也是 undefined —— 写下去就是「Shift 强制纯文本」静默失效。
	 *    改为在 keydown 里记录：键盘触发粘贴时，keydown 一定先于 paste。
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

	const html = useMemo(() => renderMd(value), [value])

	function runAction(a: Action) {
		const ta = taRef.current
		if (!ta) return
		a.run(ta)
		ta.focus()
		onChange(ta.value)
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// 记录 V 键是否带 Shift，供 onPaste 判断「粘贴为纯文本」
		if (/^v$/i.test(e.key)) pastePlainRef.current = e.shiftKey

		// Tab 插入两空格（不跳出编辑区）
		if (e.key === "Tab") {
			e.preventDefault()
			const ta = e.currentTarget
			ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end")
			onChange(ta.value)
		}
	}

	/**
	 * 粘贴：把外部富文本（网页 / Word 的 text/html）转成 Markdown 再插入。
	 *
	 * 四种情况**不拦截**，交回浏览器原生粘贴（也就是纯文本）：
	 *   ① 开关关掉；② 按住 Shift（Ctrl+Shift+V 是浏览器内置的「粘贴为纯文本」）；
	 *   ③ 剪贴板没有 text/html；④ 转换结果为空（例如只复制了一张内嵌 data: 图）——
	 *      ③④ 若还 preventDefault，表现就是「粘贴了但什么都没发生」，比粘进纯文本更糟。
	 *
	 * ⚠️ getData 必须**同步**读、preventDefault 必须**同步**调：
	 *    ClipboardEvent 在事件处理函数返回后即失效，不能放进 await 之后再读。
	 */
	function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
		// 一次性读取并复位：否则下一次用鼠标右键粘贴时会沿用上一次的按键状态
		const plain = pastePlainRef.current
		pastePlainRef.current = false
		if (!keepFormat || plain) return
		const html = e.clipboardData?.getData("text/html")
		if (!html) return
		const md = htmlToMarkdown(html)
		if (!md) return
		e.preventDefault()
		const ta = e.currentTarget
		ta.setRangeText(md, ta.selectionStart, ta.selectionEnd, "end")
		onChange(ta.value)
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
			const ta = taRef.current
			if (ta) {
				insertBlock(ta, `![${alt}](${url})`)
				ta.focus()
				onChange(ta.value)
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
			{narrow && (
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
		<textarea
			ref={taRef}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			placeholder="用 Markdown 书写…（支持 GFM：表格/任务列表/删除线）"
			spellCheck={false}
			className="w-full flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[13.5px] leading-relaxed outline-none"
			style={{ minHeight }}
		/>
	)

	const previewPane = (
		<div className="md-body w-full flex-1 overflow-auto px-4 py-2" style={{ minHeight }} dangerouslySetInnerHTML={{ __html: html }} />
	)

	return (
		<>
			<style>{MD_BODY_CSS}</style>
			<div>
				{toolbar}
				{narrow ? (
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
