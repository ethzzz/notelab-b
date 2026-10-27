"use client"
// SuperDoc 封装：DOCX 原生分页编辑（页眉页脚/批注/修订），只负责加载 Blob 与导出 Blob。
// superdoc 依赖浏览器环境，页面侧必须用 dynamic(..., { ssr: false }) 引入本组件。
import { forwardRef, useImperativeHandle, useRef } from "react"
import { SuperDocEditor } from "@superdoc/react"
import type { SuperDocRef } from "@superdoc/react"
import "superdoc/style.css"

export type DocxEditorHandle = {
  /** 导出当前文档的 .docx（不触发浏览器下载） */
  exportDocx(name: string): Promise<Blob>
}

type Props = {
  file: Blob
  onReady?: () => void
  onError?: (message: string) => void
}

const DocxEditor = forwardRef<DocxEditorHandle, Props>(function DocxEditor({ file, onReady, onError }, ref) {
  const inner = useRef<SuperDocRef>(null)

  useImperativeHandle(ref, () => ({
    async exportDocx(name: string) {
      const instance = inner.current?.getInstance()
      if (!instance) throw new Error("编辑器尚未就绪")
      return instance.export({
        exportType: ["docx"],
        commentsType: "external",
        exportedName: name,
        triggerDownload: false,
      })
    },
  }), [])

  return (
    <SuperDocEditor
      ref={inner}
      document={file}
      documentMode="editing"
      contained
      style={{ height: "76vh" }}
      onReady={() => onReady?.()}
      onContentError={() => onError?.("文档解析失败，请确认是有效的 .docx")}
    />
  )
})

export default DocxEditor
