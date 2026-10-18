"use client"
// PRD 管理（文档管理 → PRD 管理）：与笔记同一套实现，靠 doc_type=prd 分类
import NotesPanel from "@/components/notes-panel"

export default function PrdPage() {
  return <NotesPanel type="prd" />
}
