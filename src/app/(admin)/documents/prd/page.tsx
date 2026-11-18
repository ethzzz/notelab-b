// PRD 管理（文档管理 → PRD 管理）：与笔记同一套实现，靠 doc_type=prd 分类
// ?open=<id> 由服务端读出并传入，供「从新标签页打开」直达查看态
import NotesPanel from "@/components/notes-panel"

export default async function PrdPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string | string[] }>
}) {
  const { open } = await searchParams
  const raw = Array.isArray(open) ? open[0] : open
  const id = Number(raw)
  return <NotesPanel type="prd" initialOpenId={Number.isInteger(id) && id > 0 ? id : undefined} />
}
