// 练习实践：记录做完每道练习题后的解答（Markdown 正文 + 可传插图）。
//
// 三层数据（别混）：
//   · 记录本身（标题/类型/正文/时间人）→ 表 practice_record，走 /api/practice/records
//   · 插图 → 表 practice_image，正文里只留短 URL（/api/practice/images/{id}）
//   · 类型字典 → ui_config.practice.types，随 /api/practice/meta 下发（懒 seed 回内置）
//
// ⚠️ 列表接口**不返回正文**（LONGTEXT，一页 20 条整包吐出来纯属浪费）。要正文必须单条读。

import { apiJson } from "./api"

/** 类型选项（下拉 / 筛选 / Tag 展示共用一份） */
export type PracticeType = { value: string; label: string }

/** 列表项：**不含正文** */
export type PracticeRecord = {
  id: number
  title: string
  type: string
  created_by: number
  created_by_name: string
  updated_by: number
  updated_by_name: string
  created_at: string
  updated_at: string
}

/** 单条详情：含正文 */
export type PracticeRecordFull = PracticeRecord & { content: string }

export type PracticeMeta = {
  types: PracticeType[]
  images: { count: number; bytes: number }
}

export type PracticeListResp = {
  items: PracticeRecord[]
  total: number
  page: number
  size: number
}

export async function loadMeta(): Promise<PracticeMeta> {
  return apiJson<PracticeMeta>("/api/practice/meta")
}

/** title 模糊匹配；types 多选（空数组 = 不过滤） */
export async function loadRecords(params: {
  title?: string
  types?: string[]
  page?: number
  size?: number
}): Promise<PracticeListResp> {
  const q = new URLSearchParams()
  if (params.title?.trim()) q.set("title", params.title.trim())
  if (params.types?.length) q.set("types", params.types.join(","))
  q.set("page", String(params.page ?? 1))
  q.set("size", String(params.size ?? 10))
  return apiJson<PracticeListResp>(`/api/practice/records?${q.toString()}`)
}

export async function loadRecord(id: number): Promise<PracticeRecordFull> {
  return apiJson<PracticeRecordFull>(`/api/practice/records/${id}`)
}

/** 新建（一级页面的「创建记录」弹窗）：只带标题 + 类型，正文留空。返回新记录 id */
export async function createRecord(title: string, type: string): Promise<number> {
  const r = await apiJson<{ ok: boolean; id: number }>("/api/practice/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, type }),
  })
  return r.id
}

/** 只改「非内容数据」（标题 + 类型）。kind=meta 由服务端强制 —— 正文一个字都不碰 */
export async function updateRecordMeta(id: number, title: string, type: string): Promise<void> {
  await apiJson(`/api/practice/records/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "meta", title, type }),
  })
}

/** 只改「内容数据」（Markdown 正文） */
export async function updateRecordContent(id: number, content: string): Promise<void> {
  await apiJson(`/api/practice/records/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "content", content }),
  })
}

export async function deleteRecord(id: number): Promise<void> {
  await apiJson(`/api/practice/records/${id}`, { method: "DELETE" })
}

// ------------------------------------------------------------------ 插图

/**
 * 上传一张插图，返回可写进 Markdown 的 URL。
 *
 * ⚠️ 不要手动设 Content-Type：FormData 的 multipart boundary 由浏览器生成，
 * 手写会导致后端解析不出文件（表现为「没有收到文件」）。
 */
export async function uploadImage(file: File | Blob): Promise<string> {
  const fd = new FormData()
  const name = file instanceof File ? file.name : "image.png"
  fd.append("file", file, name)
  const r = await apiJson<{ ok: boolean; id: number; url: string }>("/api/practice/images", {
    method: "POST",
    body: fd,
  })
  return r.url
}

/**
 * 传之前先压：长边缩到 maxSide、按原格式重编码。
 *
 * 为什么不在服务端压：压缩是**体验层**（等着上传的时间在用户这边），服务端的职责是**校验**
 * （体积上限 + mime 白名单，见 PracticeController）。两边各司其职，谁也替代不了谁。
 *
 * ⚠️ 保持原编码格式（PNG 还是 PNG）：截图里的透明区域转 JPEG 会变成黑底。
 * ⚠️ GIF 直接原样返回：canvas 重编码会把动图变成静止的第一帧。
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<File | Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  // 本来就小且尺寸不大，不必折腾（重编码反而可能变大）
  if (file.size <= 300 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) { bmp.close?.(); return file }
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const mime = file.type === "image/jpeg" || file.type === "image/webp" ? file.type : "image/png"
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality))
    // 压完反而更大（小图重编码的常态）就用原图
    return blob && blob.size < file.size ? blob : file
  } catch {
    // createImageBitmap 不支持该格式（如某些 BMP/HEIC）→ 原样传，交给服务端判 mime
    return file
  }
}

/** 图片直出地址（与后端 /api/practice/images/{id} 一致）—— 供需要自己拼 URL 的地方用 */
export function imageUrl(id: number): string {
  return `/api/practice/images/${id}`
}

/** 预检一张图能不能传（供编辑器提前拦，不替代服务端校验） */
export function imageRejectReason(file: File): string | null {
  if (!file.type.startsWith("image/")) return "只能上传图片文件"
  if (file.size > 4 * 1024 * 1024) return "图片超过 4MB，请先压缩"
  return null
}
