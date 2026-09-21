// 每日英语翻译练习（B 端句子库）公共类型与工具：
// 接口契约以 notelab-java TranslateAdminController（/api/admin/translate）为准。

export type GroupStatus = "draft" | "queued" | "used"
export type GroupSource = "manual" | "import" | "llm"

export type GroupRow = {
  id: number
  title: string
  status: GroupStatus
  activated_date: string | null
  source: GroupSource
  scenario: string
  note: string
  created_by: number | null
  created_at: string
  updated_at: string
  sentence_count: number
}

export type SentenceRow = {
  id: number
  group_id: number
  tier: number
  sort_order: number
  zh_text: string
  ref_en: string | null
  created_at: string
}

export type TierMeta = { tier: number; name: string; desc: string }

export const STATUS_LABEL: Record<GroupStatus, string> = {
  draft: "草稿",
  queued: "已入队",
  used: "已激活",
}

export const STATUS_COLOR: Record<GroupStatus, string> = {
  draft: "default",
  queued: "processing",
  used: "success",
}

export const SOURCE_LABEL: Record<GroupSource, string> = {
  manual: "手动",
  import: "批量导入",
  llm: "AI 生成",
}

export const TIER_LABEL: Record<number, string> = { 1: "简单", 2: "中等", 3: "困难" }
export const TIER_COLOR: Record<number, string> = { 1: "green", 2: "gold", 3: "volcano" }

/** 中文句末标点（与后端 TranslateService.SENT_END 一致） */
const SENT_END = "。！？；…!?;"
/** 单句最短字数（与后端 MIN_ZH_LEN 一致） */
const MIN_ZH_LEN = 4
/** 中文原句推荐上限（与后端 MAX_ZH_LEN 一致，超过仅提示仍入库） */
export const MAX_ZH_LEN = 50

/**
 * 批量导入的本地切分预览：按中文句末标点与换行切成一句一句，trim、去空、去重、过滤过短。
 * 规则与后端 splitZhText 完全一致，用于导入前给管理员看切分结果（真正入库仍由后端执行）。
 */
export function splitZhPreview(text: string): { sentences: string[]; skipped: number } {
  const out: string[] = []
  const seen = new Set<string>()
  let skipped = 0
  const accept = (s: string): boolean => {
    if (!s || s.length < MIN_ZH_LEN) return false
    if (seen.has(s)) return false
    seen.add(s)
    return true
  }
  for (const line of (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    let cur = ""
    for (const ch of line) {
      cur += ch
      if (SENT_END.includes(ch)) {
        const sentence = cur.trim()
        if (accept(sentence)) out.push(sentence)
        else if (sentence) skipped++
        cur = ""
      }
    }
    const tail = cur.trim()
    if (!tail) continue
    if (accept(tail)) out.push(tail)
    else skipped++
  }
  return { sentences: out, skipped }
}

/** 常见场景选项（LLM 生成的 scenario 快捷选择，可自由输入） */
export const SCENARIOS = [
  "日常生活", "职场办公", "机场出行", "酒店住宿", "餐厅点餐", "购物消费",
  "看病就医", "校园学习", "旅行观光", "科技互联网", "新闻时事", "文化交流",
]
