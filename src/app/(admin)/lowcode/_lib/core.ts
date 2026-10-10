// 低代码平台 · 类型与纯函数（不含 React、不含网络）
//
// 设计稿四类方案（forms / flows / models / pages）在后端是 ui_config 的 lowcode 键，
// 每类是一个数组，元素统一为「方案」：id + name + updated_at + 各类自己的内容键。
// 后端对方案体做递归结构净化（见 LowCodeController），所以这里加新字段不需要改后端。

// ================= 方案 =================

export type Plan = { id: string; name: string; updated_at: string }

// ================= 表单设计器 =================

export type FieldType =
  | "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "switch" | "date" | "subform"

/** 校验规则：前端运行时与导出的 JSON Schema 共用同一份定义 */
export type FieldRules = {
  min?: number | null
  max?: number | null
  minLen?: number | null
  maxLen?: number | null
  pattern?: string
  message?: string
}

/** 条件显隐：本字段仅在「参照字段满足比较」时出现 */
export type VisibleWhen = {
  field: string          // 参照字段 id
  op: VisibleOp          // 比较方式
  value?: string         // op 为 empty/notEmpty 时忽略
}
export type VisibleOp = "eq" | "ne" | "contains" | "empty" | "notEmpty"

export type Field = {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  /** 栅格占宽：3 列布局下 1=1/3 2=2/3 3=整行（默认 3） */
  span?: 1 | 2 | 3
  rules?: FieldRules
  visibleWhen?: VisibleWhen | null
  /** type=subform 时的子字段（值为对象数组） */
  children?: Field[]
}

export type FormPlan = Plan & { fields: Field[] }

export const FIELD_DEFS: { type: FieldType; name: string; icon: string }[] = [
  { type: "text", name: "单行文本", icon: "📝" },
  { type: "textarea", name: "多行文本", icon: "📄" },
  { type: "number", name: "数字", icon: "🔢" },
  { type: "select", name: "下拉选择", icon: "📃" },
  { type: "radio", name: "单选组", icon: "🔘" },
  { type: "checkbox", name: "多选组", icon: "☑️" },
  { type: "switch", name: "开关", icon: "🎚️" },
  { type: "date", name: "日期", icon: "📅" },
  { type: "subform", name: "子表单", icon: "🧩" },
]

export const VISIBLE_OPS: { value: VisibleOp; label: string }[] = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "empty", label: "为空" },
  { value: "notEmpty", label: "不为空" },
]

// ================= 流程编排 =================

export type FlowKind = "trigger" | "condition" | "action" | "delay"
export type FlowNode = {
  id: string
  type: string
  params: Record<string, string>
  /** 仅 type="if"：真假两条分支各挂一串节点（递归） */
  branches?: { yes: FlowNode[]; no: FlowNode[] }
}
export type FlowPlan = Plan & { nodes: FlowNode[] }

export const FLOW_DEFS: { kind: FlowKind; type: string; name: string; icon: string; params: string[] }[] = [
  { kind: "trigger", type: "schedule", name: "定时触发", icon: "⏰", params: ["cron 表达式"] },
  { kind: "trigger", type: "webhook", name: "Webhook 触发", icon: "🔗", params: ["路径"] },
  { kind: "trigger", type: "manual", name: "手动触发", icon: "👆", params: [] },
  { kind: "condition", type: "if", name: "条件判断", icon: "🔀", params: ["条件表达式"] },
  { kind: "action", type: "notify", name: "发送通知", icon: "📨", params: ["接收人", "通知内容"] },
  { kind: "action", type: "http", name: "调用 API", icon: "🌐", params: ["URL", "方法"] },
  { kind: "action", type: "data", name: "写入数据", icon: "💾", params: ["目标表", "数据 JSON"] },
  { kind: "delay", type: "wait", name: "延时等待", icon: "⏳", params: ["时长（秒）"] },
]

export const KIND_LABEL: Record<FlowKind, string> = { trigger: "触发", condition: "条件", action: "动作", delay: "延时" }

// ================= 数据模型 =================

export type ModelField = {
  name: string
  type: string
  required: boolean
  def: string
  note: string
  /** 唯一约束（落到 DDL 是 UNIQUE KEY，落到 Schema 无对应，仅提示） */
  unique?: boolean
  /** 建索引（非唯一） */
  index?: boolean
  /** 关联：形如 "orders.id" —— 生成 DDL 时给出外键注释，生成器里用于下拉数据源 */
  ref?: string
}
export type ModelPlan = Plan & { table: string; fields: ModelField[] }

export const MODEL_TYPES = ["string", "text", "number", "boolean", "date", "enum"]

// ================= 页面生成器 =================

export type ListColumn = { name: string; title: string; width?: number; sortable?: boolean; ellipsis?: boolean }
export type QueryField = { name: string; label: string; control: "input" | "select" | "dateRange" | "numberRange" }
export type PagePlan = Plan & {
  modelId: string
  modelName: string
  list: { columns: ListColumn[]; query: QueryField[]; actions: string[]; pageSize: number }
  form: { fields: string[]; width: number }
}

export const PAGE_ACTIONS = ["create", "edit", "delete", "export"]
export const ACTION_LABEL: Record<string, string> = { create: "新建", edit: "编辑", delete: "删除", export: "导出" }

// ================= 通用工具 =================

export function uid(prefix = "x"): string {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36)
}

export function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function emptyPlan(name = "未命名方案"): Plan {
  return { id: uid("p"), name, updated_at: nowStamp() }
}

/** 条件显隐求值：参照字段的当前值是否满足（运行时与预览共用，口径必须一致） */
export function isVisible(w: VisibleWhen | null | undefined, values: Record<string, any>): boolean {
  if (!w || !w.field) return true
  const v = values?.[w.field]
  const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)
  switch (w.op) {
    case "empty": return empty
    case "notEmpty": return !empty
    case "eq": return String(v ?? "") === String(w.value ?? "")
    case "ne": return String(v ?? "") !== String(w.value ?? "")
    case "contains": return String(v ?? "").includes(String(w.value ?? ""))
    default: return true
  }
}

/** 单字段校验：返回错误文案，通过返回空串 */
export function validateField(f: Field, value: any): string {
  const r = f.rules || {}
  const msg = r.message || "格式不正确"
  if (f.required) {
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
    if (empty) return "此项为必填"
  }
  if (value === undefined || value === null || value === "") return ""
  if (f.type === "number") {
    const n = Number(value)
    if (Number.isNaN(n)) return "必须是数字"
    if (r.min != null && n < r.min) return r.message || `不能小于 ${r.min}`
    if (r.max != null && n > r.max) return r.message || `不能大于 ${r.max}`
    return ""
  }
  const s = String(value)
  if (r.minLen != null && s.length < r.minLen) return r.message || `至少 ${r.minLen} 个字符`
  if (r.maxLen != null && s.length > r.maxLen) return r.message || `最多 ${r.maxLen} 个字符`
  if (r.pattern) {
    try { if (!new RegExp(r.pattern).test(s)) return msg } catch { /* 正则非法就跳过，不阻塞提交 */ }
  }
  return ""
}

// ================= 导出：表单 → JSON Schema =================

export function formToSchema(fields: Field[]): any {
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const f of fields) {
    const p: any = { title: f.label }
    if (f.type === "subform") {
      p.type = "array"
      p.items = { type: "object", properties: subProps(f.children || []) }
    } else {
      p.type = f.type === "number" ? "number" : f.type === "switch" ? "boolean" : "string"
      if (f.type === "date") p.format = "date"
      if (f.type === "select" || f.type === "radio" || f.type === "checkbox") {
        p.enum = f.options || []
        if (f.type === "checkbox") { p.type = "array"; p.items = { type: "string", enum: f.options || [] } }
      }
      const r = f.rules || {}
      if (r.min != null) p.minimum = r.min
      if (r.max != null) p.maximum = r.max
      if (r.minLen != null) p.minLength = r.minLen
      if (r.maxLen != null) p.maxLength = r.maxLen
      if (r.pattern) p.pattern = r.pattern
    }
    if (f.placeholder) p.description = f.placeholder
    if (f.span) p["x-span"] = f.span
    properties[f.id] = p
    if (f.required) required.push(f.id)
  }
  return { type: "object", properties, required }
}

function subProps(fields: Field[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    const p: any = { title: f.label }
    p.type = f.type === "number" ? "number" : f.type === "switch" ? "boolean" : "string"
    if (f.type === "select" || f.type === "radio" || f.type === "checkbox") p.enum = f.options || []
    if (f.type === "date") p.format = "date"
    out[f.id] = p
  }
  return out
}

// ================= 导出：数据模型 → SQL DDL / JSON Schema =================

export function modelToSql(table: string, fields: ModelField[]): string {
  const cols: string[] = []
  const keys: string[] = []
  for (const f of fields.filter((x) => x.name.trim())) {
    const t = f.type === "text" ? "TEXT"
      : f.type === "number" ? "DOUBLE"
      : f.type === "boolean" ? "TINYINT(1)"
      : f.type === "date" ? "DATETIME"
      : "VARCHAR(255)"
    let line = `  \`${f.name}\` ${t}${f.required ? " NOT NULL" : ""}${f.def ? ` DEFAULT '${f.def}'` : ""}${f.note ? ` COMMENT '${f.note}'` : ""}`
    if (f.ref) line += `  -- ref: ${f.ref}`
    cols.push(line)
    if (f.unique) keys.push(`  UNIQUE KEY \`uk_${f.name}\` (\`${f.name}\`)`)
    else if (f.index) keys.push(`  KEY \`idx_${f.name}\` (\`${f.name}\`)`)
  }
  const all = [...cols, ...keys]
  return `CREATE TABLE \`${table || "my_table"}\` (\n  id BIGINT AUTO_INCREMENT PRIMARY KEY,\n`
    + all.join(",\n") + (all.length ? ",\n" : "")
    + `  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
}

export function modelToSchema(table: string, fields: ModelField[]): any {
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const f of fields.filter((x) => x.name.trim())) {
    const p: any = {}
    p.type = f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string"
    if (f.type === "date") p.format = "date-time"
    if (f.type === "enum") p.enum = []
    if (f.note) p.description = f.note
    properties[f.name] = p
    if (f.required) required.push(f.name)
  }
  return { title: table || "my_table", type: "object", properties, required }
}
