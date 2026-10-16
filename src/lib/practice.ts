// 练习实践：记录做完每道练习题后的解答（Markdown 正文 + 可传插图），并一键发布到博客。
//
// 三层数据（别混）：
//   · 记录本身 → 表 practice_record，走 /api/practice/records
//   · 插图 → 表 practice_image，正文里只留短 URL（/api/practice/images/{id}）
//   · 类型字典 → ui_config.practice.types，随 /api/practice/meta 下发（懒 seed 回内置）
//
// ⚠️ 列表接口**不返回正文**（LONGTEXT，一页 20 条整包吐出来纯属浪费）。要正文必须单条读。
//
// 发布链路：记录 → 博客仓 src/content/solutions/<slug>.md（**不是 posts**）。
// 文件名 = 博客 URL，由 module + 篇章号 + 题号 + 英文短名 拼出（见 slugPreview）。

import { apiJson } from "./api"

/** 类型选项（下拉 / 筛选 / Tag 展示共用一份） */
export type PracticeType = { value: string; label: string }
/** 博客路线模块选项（algo / typescript / js / …） */
export type PracticeModule = { value: string; label: string }

/** 列表项：**不含正文** */
export type PracticeRecord = {
  id: number
  title: string
  type: string
  /** 博客路线模块（与 type 不是一个维度：type 是语言，module 是学习路线模块） */
  module: string
  /** 篇章号（对应 <module>-roadmap-<NN>-*） */
  chapter: string
  order_no: number
  slug_name: string
  difficulty: string
  /** 逗号分隔 */
  tags: string
  description: string
  /** 发布态：空串 = 从未发布 */
  published_at: string
  published_slug: string
  published_commit: string
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
  modules: PracticeModule[]
  difficulties: string[]
  images: { count: number; bytes: number }
}

export type PracticeListResp = {
  items: PracticeRecord[]
  total: number
  page: number
  size: number
}

/**
 * 发布信息（不含标题/类型）。
 *
 * 创建弹窗与二级页的「发布信息」弹窗**共用**这一份 —— 两处各写一个表单必然漂移，
 * 最后变成「创建时填了 module，编辑时改不到」。
 */
export type PublishFields = {
  module: string
  chapter: string
  order_no: number
  slug_name: string
  difficulty: string
  tags: string
  description: string
}

/** 创建/保存时提交的完整「非内容数据」 */
export type PracticeFields = PublishFields & { title: string; type: string }

export function blankPublishFields(): PublishFields {
  return { module: "", chapter: "", order_no: 0, slug_name: "", difficulty: "中等", tags: "", description: "" }
}

/** 从一条记录取出它的发布信息 */
export function publishFieldsOf(r: PracticeRecord): PublishFields {
  return {
    module: r.module || "",
    chapter: r.chapter || "",
    order_no: r.order_no || 0,
    slug_name: r.slug_name || "",
    difficulty: r.difficulty || "中等",
    tags: r.tags || "",
    description: r.description || "",
  }
}

/**
 * 实时预览将生成的文件名（= 博客 URL 的一段）。
 *
 * 规则与博客 docs/solutions-convention.md 一致：`<模块>-<篇章号>-ex<题号>-<英文短名>`，
 * 篇章号与题号补零到两位。任何一段为空就返回空串（表单里显示「还没填全」）。
 */
export function slugPreview(f: PublishFields): string {
  const m = f.module.trim()
  const ch = f.chapter.trim()
  const name = f.slug_name.trim()
  if (!m || !ch || !f.order_no || !name) return ""
  const pad = (v: string | number) => String(v).padStart(2, "0")
  return `${m}-${pad(ch)}-ex${pad(f.order_no)}-${name}`
}

/** 发布预检结果（二次确认弹窗的全部素材） */
export type PublishPreview = {
  ok: boolean
  ready: boolean
  /** 地址标识：它是博客 URL 的最后一段，也是对外唯一的键 */
  slug: string
  url: string
  module: string
  chapter: string
  order: number
  difficulty: string
  relatedPost: string
  relatedPostFound: boolean
  /** 会随页面一起公开的插图。publicName 是它们对外的文件名，也是匿名访问的凭据 */
  images: { id: number; publicName: string; url: string }[]
  blockers: string[]
  warnings: string[]
  published: { slug: string; commit: string; at: string } | null
  willUpdate: boolean
  willRename: boolean
  oldSlug: string
}

export type PublishResult = {
  ok: boolean
  slug: string
  url: string
  images: number
  relatedPost: string
  warnings: string[]
  updated: boolean
  note: string
}

// ------------------------------------------------------------------ 读

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

// ------------------------------------------------------------------ 写

/** 新建（一级页面的「创建记录」弹窗）：标题 + 类型 + 发布信息一次填全 */
export async function createRecord(fields: PracticeFields): Promise<number> {
  const r = await apiJson<{ ok: boolean; id: number }>("/api/practice/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  return r.id
}

/** 改「非内容数据」（标题 / 类型 / 发布信息）。kind=meta 由服务端强制 —— 正文一个字都不碰 */
export async function updateRecordMeta(id: number, fields: PracticeFields): Promise<void> {
  await apiJson(`/api/practice/records/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "meta", ...fields }),
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

// ------------------------------------------------------------------ 发布到博客

/** 发布预检（干跑，不写任何文件）：二次确认弹窗的内容全在这里 */
export async function publishPreview(id: number): Promise<PublishPreview> {
  return apiJson<PublishPreview>(`/api/practice/records/${id}/publish-preview`)
}

/** 真发布：给插图打公开名 + 把记录标成已发布（博客页面直接读库，不入 git、不触发构建） */
export async function publishRecord(id: number): Promise<PublishResult> {
  return apiJson<PublishResult>(`/api/practice/records/${id}/publish`, { method: "POST" })
}

/**
 * 博客侧预览：服务端把这条记录的**发布计划**放进短时存储，返回可嵌 iframe 的地址
 * （博客的 `/blog/solutions/preview/<token>/` 用它**自己的**渲染管线出页面，所以预览＝线上观感）。
 *
 * ⚠️ 服务端读的是**库里已保存**的内容：编辑区有未保存改动时，先保存再预览。
 */
export type BlogPreviewResult = {
  ok: boolean
  token: string
  url: string
  slug: string
  relatedPost: string
  blockers: string[]
}

export async function blogPreview(id: number): Promise<BlogPreviewResult> {
  return apiJson<BlogPreviewResult>(`/api/practice/records/${id}/blog-preview`, { method: "POST" })
}

/** 下线的返回：说清「哪个地址下线了」 */
export type UnpublishResult = { ok: boolean; slug: string; note: string }

/**
 * 下线：撤掉发布态（博客上立刻 404），**不删记录也不删插图** —— 重新发布即可回到同一个地址。
 * 与「删除」是两回事：删除是这条记录不要了，下线只是不让外面看到。
 */
export async function unpublishRecord(id: number): Promise<UnpublishResult> {
  return apiJson<UnpublishResult>(`/api/practice/records/${id}/unpublish`, { method: "POST" })
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
