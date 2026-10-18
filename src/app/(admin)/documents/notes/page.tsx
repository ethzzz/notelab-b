"use client"
// 笔记（文档管理 → 笔记）：与 PRD 共用 NotesPanel，仅 type 不同
import NotesPanel from "@/components/notes-panel"

export default function NotesPage() {
  return <NotesPanel type="note" />
}
