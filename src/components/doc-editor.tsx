"use client"
// Quill 富文本编辑器封装（文档编辑用）：
// - react-quill-new（Quill 2.x，React 19 兼容）；样式表走运行时注入，避开 Next 全局 CSS 限制
// - 通过 ref 暴露 getHtml() / getEditorRoot()（导出 docx 时遍历编辑器 DOM）
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import ReactQuill from "react-quill-new"

const QUILL_CSS_HREF = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css"

export type DocEditorHandle = {
  getHtml: () => string
  getEditorRoot: () => HTMLElement | null
}

type Props = { value: string; onChange?: (html: string) => void; readOnly?: boolean }

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "link"],
    ["clean"],
  ],
}

const DocEditor = forwardRef<DocEditorHandle, Props>(function DocEditor({ value, onChange, readOnly }, ref) {
  const quillRef = useRef<any>(null)

  // 运行时注入 Quill 主题样式（幂等）
  useEffect(() => {
    if (document.getElementById("quill-snow-css")) return
    const link = document.createElement("link")
    link.id = "quill-snow-css"
    link.rel = "stylesheet"
    link.href = QUILL_CSS_HREF
    document.head.appendChild(link)
  }, [])

  useImperativeHandle(ref, () => ({
    getHtml: () => {
      const q = quillRef.current?.getEditor?.()
      return q ? q.root.innerHTML : ""
    },
    getEditorRoot: () => {
      const q = quillRef.current?.getEditor?.()
      return q ? (q.root as HTMLElement) : null
    },
  }))

  return (
    <ReactQuill
      ref={quillRef as any}
      theme="snow"
      value={value}
      onChange={onChange as any}
      readOnly={readOnly}
      modules={modules}
      className="doc-quill bg-white"
    />
  )
})

export default DocEditor
