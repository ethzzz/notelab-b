// 笔记（文档管理 → 笔记）：与 PRD 共用 NotesPanel，仅 type 不同
// ?open=<id> 由服务端读出并传入，供「从新标签页打开」直达查看态
import NotesPanel from "@/components/notes-panel"

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string | string[] }>
}) {
  const { open } = await searchParams
  const raw = Array.isArray(open) ? open[0] : open
  const id = Number(raw)
  return <NotesPanel type="note" initialOpenId={Number.isInteger(id) && id > 0 ? id : undefined} />
}
