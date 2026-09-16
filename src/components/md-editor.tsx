"use client"
// Notion 式 Markdown 编辑器：左侧源码（等宽字体+工具栏），右侧实时预览（marked 渲染 + DOMPurify 消毒）。
// 窄屏（≤900px）自动折叠为"编辑/预览"单面板切换。受控组件：value/onChange。
// 另导出 MdPreview 纯预览组件（查看态复用同一套渲染与样式）。
import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Segmented, Tooltip } from "antd"
import { marked } from "marked"
import DOMPurify from "dompurify"

marked.setOptions({ gfm: true, breaks: true })

/** md → 消毒后的 HTML（无 DOM 环境（预渲染）时 DOMPurify 原样返回，hydration 后客户端重新渲染） */
export function renderMd(md: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(md || "") as string)
  } catch {
    return ""
  }
}

/** 预览区排版样式（深浅色主题通用：中性灰半透明 + currentColor） */
const MD_BODY_CSS = `
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
  const out = seg.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join("\n")
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

export default function MdEditor({ value, onChange, minHeight = 480 }: {
  value: string
  onChange: (v: string) => void
  minHeight?: number
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [pane, setPane] = useState<"edit" | "preview">("edit")

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
    // Tab 插入两空格（不跳出编辑区）
    if (e.key === "Tab") {
      e.preventDefault()
      const ta = e.currentTarget
      ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end")
      onChange(ta.value)
    }
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
      {narrow && (
        <Segmented
          size="small"
          className="ml-auto"
          value={pane}
          onChange={(v) => setPane(v as "edit" | "preview")}
          options={[{ label: "编辑", value: "edit" }, { label: "预览", value: "preview" }]}
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
