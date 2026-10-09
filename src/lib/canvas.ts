// 协作画布 —— 公共层。
//
// ⚠️ 本文件只放**两套引擎都要用**的东西：元数据 API、引擎类型、引擎展示元数据、WS 地址拼装。
//    **绝不要**在这里 import 任何引擎实现（tldraw / excalidraw）——那会让两套代码在打包图上
//    重新耦合，失去隔离的意义。引擎实现全部在 components/canvas/engines/<engine>/ 下，
//    由 components/canvas/canvas-host.tsx 唯一分派。
//
// 职责边界：本文件只碰**元数据**（有哪些画布、叫什么名字、用哪套引擎）。
// 画布内容的实时同步走协作服务的 WebSocket，具体协议由各引擎自己的客户端实现。
import { apiJson, postJson } from "./api"

/** 画布引擎。新增引擎时需三处同步登记：这里、canvas-host.tsx、Java CanvasController.ENGINES */
export type CanvasEngine = "tldraw" | "excalidraw"

export const DEFAULT_ENGINE: CanvasEngine = "tldraw"

/**
 * 引擎展示元数据（列表页徽标 / 新建弹窗 / 编辑器页头用）。
 *
 * 只放**展示**信息，不放任何行为 —— 行为在 engines/<engine>/ 里。这样改某套引擎的实现
 * 不需要动这个文件，也就不会波及另一套。
 */
export const ENGINE_META: Record<CanvasEngine, { label: string; badge: string; desc: string }> = {
  tldraw: {
    label: "tldraw",
    badge: "🎨",
    desc: "图形 / 便签 / 富文本卡片 / 手绘，精确风格",
  },
  excalidraw: {
    label: "Excalidraw",
    badge: "✏️",
    desc: "手绘草图风，MIT 许可（生产无需 license）",
  },
}

/** 后端字段 → 引擎类型的安全收敛（老数据可能没有 engine 列，一律当 tldraw） */
export function asEngine(v: unknown): CanvasEngine {
  return v === "excalidraw" ? "excalidraw" : DEFAULT_ENGINE
}

export type CanvasMeta = {
  id: number
  room_id: string
  title: string
  /** 后端白名单保证是 tldraw|excalidraw；这里放宽为 string 以容忍历史数据 */
  engine: string
  created_by: number | null
  created_at: string
  updated_at: string
}

/** 列表：q 模糊匹配标题；engine 精确筛选（后端白名单校验，非法值会 400） */
export async function listCanvases(q?: string, engine?: string): Promise<CanvasMeta[]> {
  const p = new URLSearchParams()
  if (q && q.trim()) p.set("q", q.trim())
  if (engine) p.set("engine", engine)
  const qs = p.toString() ? `?${p.toString()}` : ""
  const j = await apiJson<{ items: CanvasMeta[] }>(`/api/canvas${qs}`)
  return j.items || []
}

export async function getCanvas(roomId: string): Promise<CanvasMeta> {
  return apiJson<CanvasMeta>(`/api/canvas/${roomId}`)
}

export async function createCanvas(
  title: string,
  engine: CanvasEngine,
): Promise<{ roomId: string; title: string; engine: string }> {
  return postJson("/api/canvas", { title, engine })
}

export async function renameCanvas(roomId: string, title: string): Promise<void> {
  await apiJson(`/api/canvas/${roomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
}

/**
 * 删除画布。返回值带 `purged` —— 元数据（MySQL）与内容（协作服务 SQLite）是**两个库**，
 * 删除是跨进程两步且不回滚：`purged: false` 表示元数据已删、但协作服务没清掉房间，
 * 已留下孤儿表（可在「对账」里清理）。调用方应当把这种情况提示给用户。
 */
export async function deleteCanvas(roomId: string): Promise<{ purged?: boolean; warning?: string }> {
  return apiJson(`/api/canvas/${roomId}`, { method: "DELETE" })
}

// ---------------- 对账（元数据 ↔ 内容） ----------------
// 背景：元数据在 MySQL，内容在协作服务的 SQLite，只靠 room_id 关联、删除又是跨进程两步，
// 所以会攒下两类不一致。这里把后端的对账结果透出来。

/** 有内容、没元数据 —— 删画布时清房间失败留下的垃圾，**可以清理** */
export type OrphanContent = { roomId: string; engine: string; tables: number; rows: number }
/** 有元数据、没内容 —— ⚠️ 绝大多数是正常的：房间表懒建，没打开过编辑器就没有表 */
export type OrphanMeta = { roomId: string; title: string; engine: string; updated_at: string }

export type ReconcileResult = {
  metaCount: number
  contentCount: number
  orphanContent: OrphanContent[]
  orphanMeta: OrphanMeta[]
}

export async function reconcileCanvas(): Promise<ReconcileResult> {
  return apiJson<ReconcileResult>("/api/canvas/reconcile")
}

/** 清理「有内容没元数据」的孤儿房间表；只清这一个方向，元数据一律不动 */
export async function purgeCanvasOrphans(): Promise<{ removed: OrphanContent[]; removedCount: number }> {
  return apiJson("/api/canvas/orphans", { method: "DELETE" })
}

/**
 * 协作 WebSocket 地址。引擎写在路径里，由协作服务按引擎分派到对应实现 ——
 * 两套引擎因此**共享同一条 nginx location 与同一道握手鉴权**，不需要为第二套引擎再开通道。
 *
 * 与页面同源（nginx 把 /collab/ 转到协作服务 :3030），**不能**带 /admin basePath ——
 * /collab/ 是 nginx 顶级 location，不是 Next 路由。
 */
export function collabUri(engine: CanvasEngine, roomId: string): string {
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/collab/connect/${engine}/${roomId}`
}

/** 标题 → 文件名安全的短标签（列表展示用，不是存储字段） */
export function shortTitle(t: string, max = 24): string {
  const s = (t || "").trim() || "未命名画布"
  return s.length > max ? `${s.slice(0, max)}…` : s
}
