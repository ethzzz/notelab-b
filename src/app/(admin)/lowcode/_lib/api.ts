// 低代码平台 · 后端读写
//
// 设计稿走 ui_config 的 lowcode 键（GET|POST /api/lowcode，整包覆盖写）；
// 表单提交记录走 lowcode_records 表（/api/lowcode/records）。
// ⚠️ 覆盖写意味着：保存时必须提交四类方案的完整列表，缺哪类哪类被清空。

import { apiJson, postJson } from "@/lib/api"
import type { PagePlan } from "./core"

export type PlanKind = "forms" | "flows" | "models" | "pages"

export type LowCodeConfig = {
  forms: any[]
  flows: any[]
  models: any[]
  pages: any[]
}

export const PLAN_KINDS: PlanKind[] = ["forms", "flows", "models", "pages"]

export function emptyConfig(): LowCodeConfig {
  return { forms: [], flows: [], models: [], pages: [] }
}

export async function loadLowCode(): Promise<LowCodeConfig> {
  const d = await apiJson<LowCodeConfig>("/api/lowcode")
  return {
    forms: Array.isArray(d.forms) ? d.forms : [],
    flows: Array.isArray(d.flows) ? d.flows : [],
    models: Array.isArray(d.models) ? d.models : [],
    pages: Array.isArray(d.pages) ? d.pages : [],
  }
}

/** 整包覆盖写。返回 ok。失败时抛出的 Error 带后端 error 文案 */
export async function saveLowCode(cfg: LowCodeConfig): Promise<void> {
  await postJson("/api/lowcode", {
    forms: cfg.forms, flows: cfg.flows, models: cfg.models, pages: cfg.pages,
  })
}

// ================= 运行时：提交记录 =================

export type RecordItem = {
  id: number
  form_id: string
  form_name: string
  data: string          // JSON 字符串
  created_by: number
  created_by_name: string
  /** 提交来源：admin = 后台内部试填；public = 公开链接（匿名）。老数据缺字段时按 admin 处理 */
  source?: string
  created_at: string
}

export async function loadRecords(
  formId = "",
  limit = 50,
  source = "",
): Promise<{ items: RecordItem[]; total: number; public_total: number }> {
  const q = new URLSearchParams()
  if (formId) q.set("form_id", formId)
  if (source) q.set("source", source)
  q.set("limit", String(limit))
  return apiJson(`/api/lowcode/records?${q.toString()}`)
}

export async function submitRecord(formId: string, formName: string, data: any): Promise<void> {
  await postJson("/api/lowcode/records", { form_id: formId, form_name: formName, data })
}

export async function deleteRecord(id: number): Promise<void> {
  const r = await fetch(`/api/lowcode/records/${id}`, { method: "DELETE", credentials: "include" })
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try { const j = await r.json(); msg = j?.error || msg } catch { /* 非 JSON */ }
    throw new Error(msg)
  }
}

/**
 * 提交记录的 CSV 导出地址。
 *
 * <p>⚠️ 刻意返回 URL 而不是走 {@code apiJson}：这是文件下载，浏览器要自己处理
 * {@code Content-Disposition: attachment}。走 fetch 拿字节再拼 Blob 也能做，
 * 但会先把整份 CSV 堆在内存里，还要自己造文件名 —— 直接让浏览器导航最简单可靠。
 * 同域下 cookie 自动带上，鉴权不需要额外处理。
 */
export function exportRecordsUrl(formId = "", source = ""): string {
  const q = new URLSearchParams()
  if (formId) q.set("form_id", formId)
  if (source) q.set("source", source)
  return `/api/lowcode/records/export?${q.toString()}`
}

/** 取某类方案里的页面生成器配置（顺手做一次类型收窄） */
export function pagesOf(cfg: LowCodeConfig): PagePlan[] {
  return (cfg.pages || []) as PagePlan[]
}

/**
 * 公开填写页地址。
 *
 * <p>⚠️ B 端挂在 /admin、C 端挂在 /，但**同域**（都是 haolo.cloud），所以填表页直接取 origin 拼 /f/。
 * 这也正是当初坚持「同域分前缀」的红利：公开表单不需要处理 cookie domain / CORS / CSRF。
 */
export function publicFormUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  return `${origin}/f/${slug}`
}
