// 协作画布 API（后端 CanvasController，前缀 /api/canvas）
//
// 职责边界：本文件只碰**元数据**（有哪些画布、叫什么名字）。
// 画布内容的实时同步走协作服务的 WebSocket，见 components/canvas-board.tsx 的 collabUri()。
import { apiJson, postJson } from "./api"

export type CanvasMeta = {
  id: number
  room_id: string
  title: string
  created_by: number | null
  created_at: string
  updated_at: string
}

/** 列表：q 可选（模糊匹配标题） */
export async function listCanvases(q?: string): Promise<CanvasMeta[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""
  const j = await apiJson<{ items: CanvasMeta[] }>(`/api/canvas${qs}`)
  return j.items || []
}

export async function getCanvas(roomId: string): Promise<CanvasMeta> {
  return apiJson<CanvasMeta>(`/api/canvas/${roomId}`)
}

export async function createCanvas(title: string): Promise<{ roomId: string; title: string }> {
  return postJson("/api/canvas", { title })
}

export async function renameCanvas(roomId: string, title: string): Promise<void> {
  await apiJson(`/api/canvas/${roomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
}

export async function deleteCanvas(roomId: string): Promise<void> {
  await apiJson(`/api/canvas/${roomId}`, { method: "DELETE" })
}

/**
 * 协作 WebSocket 地址。
 * 与页面同源（nginx 把 /collab/ 转到协作服务 :3030），**不能**带 /admin basePath ——
 * /collab/ 是 nginx 顶级 location，不是 Next 路由。
 */
export function collabUri(roomId: string): string {
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/collab/connect/${roomId}`
}

/** 标题 → 文件名安全的短标签（列表展示用，不是存储字段） */
export function shortTitle(t: string, max = 24): string {
  const s = (t || "").trim() || "未命名画布"
  return s.length > max ? `${s.slice(0, max)}…` : s
}
