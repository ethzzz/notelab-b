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
  created_at: string
}

export async function loadRecords(formId = "", limit = 50): Promise<{ items: RecordItem[]; total: number }> {
  const q = new URLSearchParams()
  if (formId) q.set("form_id", formId)
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

/** 取某类方案里的页面生成器配置（顺手做一次类型收窄） */
export function pagesOf(cfg: LowCodeConfig): PagePlan[] {
  return (cfg.pages || []) as PagePlan[]
}
