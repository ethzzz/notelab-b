"use client"
// Quill 富文本编辑器封装（文档编辑用）：
// - react-quill-new（Quill 2.x，React 19 兼容）
// - 通过 ref 暴露 getHtml() / getEditorRoot()（导出 docx 时遍历编辑器 DOM）
//
// ⚠️ 主题样式必须**随包加载**，不能从 CDN 运行时注入 <link>：
//    Quill 的工具栏图标是内联 <svg>，尺寸与颜色全靠 snow.css 约束
//    （`.ql-toolbar button svg{height:100%}`、`.ql-stroke{fill:none;stroke:#444}`）。
//    样式晚到或根本到不了时，svg 会按默认规则渲染 —— 实测被撑成 1074×1074、
//    fill 默认黑实心，画面上就是「编辑器里糊着几个巨大黑三角」。
//    之前写的是 `cdn.jsdelivr.net`，国内访问不稳，于是「首次新建文档」频繁中招。
import { forwardRef, useImperativeHandle, useRef } from "react"
import ReactQuill from "react-quill-new"
import "react-quill-new/dist/quill.snow.css"

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
    <>
      {/* 兜底：万一主题 CSS 因任何原因没生效（构建异常 / 被打包器漏掉），
          图标 svg 仍会被限制在 20px 内 —— 最坏情况只是图标不好看，
          不会再出现「几个巨大黑三角糊满编辑区」。这是护住体验的下限，不是主要修复手段。 */}
      <style>{`.doc-quill .ql-toolbar svg,.doc-quill .ql-picker svg{max-width:20px;max-height:20px}`}</style>
      <ReactQuill
        ref={quillRef as any}
        theme="snow"
        value={value}
        onChange={onChange as any}
        readOnly={readOnly}
        modules={modules}
        className="doc-quill bg-white"
      />
    </>
  )
})

export default DocEditor
