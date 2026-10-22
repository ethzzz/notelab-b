"use client"
// 课时「示例代码」块：高亮 + 复制 + 运行。
//
// 运行分两种：已接运行器（isRunnable）→ 弹出可编辑面板**真跑**；
// 没接 → 弹方案说明，按钮文案也跟着变，避免让人以为点了能执行。
// 运行面板的 state 故意放在组件外层：antd Modal 关闭后内容不销毁，
// 只有外层能在每次打开时把它重置回课程里的原始代码。
import { useMemo, useState } from "react"
import { Alert, Button, Modal, Tag } from "antd"
import { Copy, Play } from "lucide-react"
import { toast } from "@/lib/toast"
import { DEFAULT_TIMEOUT_MS, isRunnable, runCode, type RunLog, type RunResult } from "@/lib/code-runner"
import { LEVEL_META, type Runner } from "@/lib/learning-content"
import { highlightToHtml } from "./highlight"

const LOG_CLS: Record<RunLog["level"], string> = {
	log: "text-zinc-100",
	info: "text-sky-300",
	warn: "text-amber-300",
	error: "text-rose-400",
}

export default function DocCode({ code, lang, runner }: { code: string; lang: string; runner?: Runner }) {
	const highlighted = useMemo(() => highlightToHtml(code, lang), [code, lang])
	const [copied, setCopied] = useState(false)
	const [explainOpen, setExplainOpen] = useState(false)
	const [runOpen, setRunOpen] = useState(false)
	const [src, setSrc] = useState(code)
	const [result, setResult] = useState<RunResult | null>(null)
	const [running, setRunning] = useState(false)

	const canRun = isRunnable(runner?.id)
	const meta = runner ? LEVEL_META[runner.level] || LEVEL_META.none : LEVEL_META.none

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch {
			toast.error("复制失败，请手动选中")
		}
	}

	const openRunner = () => {
		setSrc(code)
		setResult(null)
		setRunOpen(true)
	}

	const doRun = async () => {
		setRunning(true)
		setResult(null)
		try {
			setResult(await runCode(src, lang))
		} catch (e) {
			setResult({ ok: false, logs: [], error: e instanceof Error ? e.message : String(e), ms: 0, timedOut: false })
		} finally {
			setRunning(false)
		}
	}

	return (
		<>
			<div className="doc-code">
				<div className="doc-code-head">
					<span className="doc-code-lang">{highlighted.lang || lang || "code"}</span>
					<div className="doc-code-extra">
						<button type="button" className="doc-code-copy" onClick={() => void copy()}>
							{copied ? "已复制" : "复制"}
						</button>
						<button
							type="button"
							className="doc-code-copy is-run"
							onClick={() => (canRun ? openRunner() : setExplainOpen(true))}
						>
							{canRun ? "▶ 运行" : "运行方案"}
						</button>
					</div>
				</div>
				<pre>
					<code
						className={`hljs${highlighted.lang ? ` language-${highlighted.lang}` : ""}`}
						dangerouslySetInnerHTML={{ __html: highlighted.html }}
					/>
				</pre>
			</div>

			{canRun && (
				<Modal
					open={runOpen}
					onCancel={() => setRunOpen(false)}
					width={720}
					title={`运行 ${lang} 代码`}
					footer={
						<div className="flex items-center gap-2">
							<span className="mr-auto text-xs text-zinc-400 dark:text-zinc-500">
								{running ? "执行中…" : result ? (result.timedOut ? "已强制中断" : `耗时 ${result.ms} ms`) : ""}
							</span>
							<Button onClick={() => { setSrc(code); setResult(null) }} disabled={running}>
								重置
							</Button>
							<Button type="primary" data-run-exec="" icon={<Play size={13} />} loading={running} onClick={() => void doRun()}>
								运行
							</Button>
						</div>
					}
				>
					<div className="flex flex-col gap-2">
						{/* 刻意用原生 textarea：这一步要的是「能改一行试试」，为它引 Monaco/CodeMirror 不划算 */}
						<textarea
							value={src}
							spellCheck={false}
							data-run-input=""
							onChange={(e) => setSrc(e.target.value)}
							className="h-52 w-full resize-y rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100 outline-none dark:bg-black/60"
							style={{ tabSize: 2 }}
						/>
						<div
							data-run-output=""
							className="max-h-56 min-h-[72px] overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed dark:bg-black/60"
						>
							{!result ? (
								<span className="text-zinc-500">改代码试试，点「运行」看输出</span>
							) : (
								<>
									{result.logs.map((l, i) => (
										<div key={i} className={`whitespace-pre-wrap break-words ${LOG_CLS[l.level]}`}>{l.text}</div>
									))}
									{result.error && <div className="whitespace-pre-wrap break-words text-rose-400">{result.error}</div>}
									{!result.logs.length && !result.error && (
										<span className="text-zinc-500">（没有输出 —— 代码里没有 console.log？）</span>
									)}
								</>
							)}
						</div>
						<p className="m-0 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
							代码在独立的 Worker 线程里执行，{Math.round(DEFAULT_TIMEOUT_MS / 1000)} 秒超时强制中断。
							⚠️ 它<b>不是安全沙箱</b>（同源网络仍可达），本页仅后台登录用户可用。
						</p>
					</div>
				</Modal>
			)}

			<Modal
				open={explainOpen}
				onCancel={() => setExplainOpen(false)}
				footer={<Button onClick={() => setExplainOpen(false)}>知道了</Button>}
				title={`在这台服务器上运行 ${lang} 代码`}
				width={560}
			>
				{runner ? (
					<div className="flex flex-col gap-3 text-sm">
						<div className="flex items-center gap-2">
							<span className="font-medium text-zinc-700 dark:text-zinc-200">{runner.name}</span>
							<Tag className={`!m-0 !border ${meta.cls}`} bordered>{meta.label}</Tag>
						</div>
						<div className="text-xs text-zinc-500 dark:text-zinc-400">
							引擎：{runner.engine}{runner.size && runner.size !== "—" ? ` · 体积：${runner.size}` : ""}
						</div>
						<p className="m-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{runner.note}</p>
						<Alert
							type="info"
							showIcon
							message="运行器尚未接入"
							description={
								<span className="text-xs">
									架子已经按这套方案设计好（代码片段都是可直接执行的完整片段），接入运行时后这里就会变成真正的运行结果。
								</span>
							}
						/>
					</div>
				) : (
					<span className="text-sm text-zinc-500">这门语言还没有登记运行方案。</span>
				)}
			</Modal>
		</>
	)
}
