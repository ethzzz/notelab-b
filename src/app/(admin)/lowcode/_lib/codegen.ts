// 低代码平台 · CRUD 页面代码生成
//
// 生成的产物是**可直接粘贴进 notelab-b 的一段 React + antd 页面代码**，不是运行时渲染的虚拟页面。
// 理由：平台自己不做动态页面托管（那是另一个大工程），先把「设计 → 代码」这条路走通，
// 生成的代码里 fetchList / saveRow 是占位实现，替换成真实接口即可用。
//
// ⚠️ 这里全程用字符串数组拼接，不用模板字符串：生成物里含 ${} 与反引号，
// 套在 TS 模板字符串里要到处转义，是踩过的坑。

import type { ModelField, ModelPlan, PagePlan } from "./core"

function pascal(s: string): string {
  return String(s || "Item").replace(/[^a-zA-Z0-9_]/g, "_").replace(/(^|_)([a-zA-Z0-9])/g, (_m, _p, c) => String(c).toUpperCase())
}

/** 字段 → antd 表单控件 JSX */
function controlFor(f: ModelField, name: string): string {
  const n = name || f.name
  switch (f.type) {
    case "number": return `          <Form.Item name="${n}" label="${f.note || f.name}">\n            <InputNumber className="!w-full" />\n          </Form.Item>`
    case "boolean": return `          <Form.Item name="${n}" label="${f.note || f.name}" valuePropName="checked">\n            <Switch />\n          </Form.Item>`
    case "text": return `          <Form.Item name="${n}" label="${f.note || f.name}">\n            <Input.TextArea rows={3} />\n          </Form.Item>`
    case "date": return `          <Form.Item name="${n}" label="${f.note || f.name}">\n            <DatePicker className="!w-full" />\n          </Form.Item>`
    case "enum": return `          <Form.Item name="${n}" label="${f.note || f.name}">\n            <Select options={${n}Options} />\n          </Form.Item>`
    default: return `          <Form.Item name="${n}" label="${f.note || f.name}"${f.required ? " rules={[{ required: true }]}" : ""}>\n            <Input />\n          </Form.Item>`
  }
}

function queryControlFor(q: { name: string; label: string; control: string }): string {
  switch (q.control) {
    case "select": return `      <Form.Item name="${q.name}" label="${q.label}">\n        <Select allowClear style={{ width: 160 }} options={[]} />\n      </Form.Item>`
    case "dateRange": return `      <Form.Item name="${q.name}" label="${q.label}">\n        <DatePicker.RangePicker />\n      </Form.Item>`
    case "numberRange": return `      <Form.Item name="${q.name}" label="${q.label}">\n        <InputNumber placeholder="数值" />\n      </Form.Item>`
    default: return `      <Form.Item name="${q.name}" label="${q.label}">\n        <Input allowClear placeholder="请输入" style={{ width: 180 }} />\n      </Form.Item>`
  }
}

/**
 * 生成列表页 + 编辑弹窗的完整页面代码。
 * model 为 null 时给出一个最小可用骨架（选模型前也能看到产物长什么样）。
 */
export function genPageCode(plan: PagePlan, model: ModelPlan | null): string {
  const table = (model?.table || plan.modelName || "item").trim() || "item"
  const Comp = pascal(table) + "Page"
  const fields: ModelField[] = (model?.fields || []).filter((f) => f.name.trim())
  const cols = (plan.list?.columns || []).filter((c) => fields.some((f) => f.name === c.name))
  const queries = (plan.list?.query || [])
  const actions = plan.list?.actions || []
  const formFields = (plan.form?.fields || []).filter((n) => fields.some((f) => f.name === n))
  const pageSize = plan.list?.pageSize || 10
  const width = plan.form?.width || 520

  const usedImports = new Set<string>(["useState"])
  const L: string[] = []
  L.push("\"use client\"")
  L.push("// ⚠️ 由低代码平台生成（模型：" + table + "）—— 把下面两个函数换成你的真实接口即可用")
  L.push("import { " + [...usedImports].join(", ") + " } from \"react\"")
  L.push("import { Button, Card, Form, Input, Modal, Space, Table, message } from \"antd\"")
  if (formFields.some((n) => fields.find((f) => f.name === n)?.type === "number") || queries.some((q) => q.control === "numberRange")) {
    L.push("import { InputNumber } from \"antd\"")
  }
  if (formFields.some((n) => fields.find((f) => f.name === n)?.type === "boolean")) L.push("import { Switch } from \"antd\"")
  if (formFields.some((n) => fields.find((f) => f.name === n)?.type === "date") || queries.some((q) => q.control === "dateRange")) {
    L.push("import { DatePicker } from \"antd\"")
  }
  if (formFields.some((n) => fields.find((f) => f.name === n)?.type === "enum") || queries.some((q) => q.control === "select")) {
    L.push("import { Select } from \"antd\"")
  }
  L.push("")
  L.push("type Row = {")
  L.push("  id: number")
  for (const f of fields) L.push("  " + f.name + ": any")
  L.push("}")
  L.push("")
  L.push("// 列表查询：替换成 GET /api/" + table)
  L.push("async function fetchList(params: any): Promise<{ items: Row[]; total: number }> {")
  L.push("  const q = new URLSearchParams(params).toString()")
  L.push("  const r = await fetch('/api/" + table + "?' + q, { credentials: 'include' })")
  L.push("  return r.json()")
  L.push("}")
  L.push("")
  L.push("// 新建 / 更新：替换成 POST /api/" + table)
  L.push("async function saveRow(values: any): Promise<void> {")
  L.push("  await fetch('/api/" + table + "', {")
  L.push("    method: 'POST',")
  L.push("    headers: { 'Content-Type': 'application/json' },")
  L.push("    body: JSON.stringify(values),")
  L.push("    credentials: 'include',")
  L.push("  })")
  L.push("}")
  L.push("")
  L.push("export default function " + Comp + "() {")
  L.push("  const [rows, setRows] = useState<Row[]>([])")
  L.push("  const [total, setTotal] = useState(0)")
  L.push("  const [page, setPage] = useState(1)")
  L.push("  const [open, setOpen] = useState(false)")
  L.push("  const [editing, setEditing] = useState<Row | null>(null)")
  L.push("  const [queryForm] = Form.useForm()")
  L.push("  const [editForm] = Form.useForm()")
  L.push("")
  L.push("  async function reload(p = page) {")
  L.push("    const res = await fetchList({ page: p, size: " + pageSize + ", ...queryForm.getFieldsValue() })")
  L.push("    setRows(res.items || [])")
  L.push("    setTotal(res.total || 0)")
  L.push("  }")
  L.push("")
  L.push("  function openEdit(row: Row | null) {")
  L.push("    setEditing(row)")
  L.push("    editForm.setFieldsValue(row || {})")
  L.push("    setOpen(true)")
  L.push("  }")
  L.push("")
  L.push("  async function submit() {")
  L.push("    const values = await editForm.validateFields()")
  L.push("    await saveRow(editing ? { id: editing.id, ...values } : values)")
  L.push("    message.success('已保存')")
  L.push("    setOpen(false)")
  L.push("    reload()")
  L.push("  }")
  L.push("")
  L.push("  const columns = [")
  for (const c of cols) {
    const bits: string[] = []
    bits.push("title: '" + (c.title || c.name) + "'")
    bits.push("dataIndex: '" + c.name + "'")
    if (c.width) bits.push("width: " + c.width)
    if (c.sortable) bits.push("sorter: (a: Row, b: Row) => String(a." + c.name + " ?? '').localeCompare(String(b." + c.name + " ?? ''))")
    if (c.ellipsis) bits.push("ellipsis: true")
    L.push("    { " + bits.join(", ") + " },")
  }
  if (cols.length === 0) L.push("    { title: '示例列', dataIndex: 'id' },")
  if (actions.some((a) => a === "edit" || a === "delete")) {
    L.push("    {")
    L.push("      title: '操作',")
    L.push("      width: 140,")
    L.push("      render: (_: any, row: Row) => (")
    L.push("        <Space size={4}>")
    if (actions.includes("edit")) L.push("          <Button size=\"small\" type=\"link\" onClick={() => openEdit(row)}>编辑</Button>")
    if (actions.includes("delete")) L.push("          <Button size=\"small\" type=\"link\" danger onClick={() => message.info('删除：替换成 DELETE /api/" + table + "/' + row.id)}>删除</Button>")
    L.push("        </Space>")
    L.push("      ),")
    L.push("    },")
  }
  L.push("  ]")
  L.push("")
  L.push("  return (")
  L.push("    <div className=\"flex flex-col gap-3\">")
  L.push("      <Card size=\"small\">")
  L.push("        <Form form={queryForm} layout=\"inline\" onFinish={() => { setPage(1); reload(1) }}>")
  for (const q of queries) L.push(queryControlFor(q))
  L.push("          <Form.Item>")
  L.push("            <Button type=\"primary\" htmlType=\"submit\">查询</Button>")
  L.push("          </Form.Item>")
  L.push("        </Form>")
  L.push("      </Card>")
  L.push("")
  L.push("      <Card")
  L.push("        size=\"small\"")
  if (actions.includes("create")) {
    L.push("        extra={<Button type=\"primary\" onClick={() => { editForm.resetFields(); openEdit(null) }}>＋ 新建</Button>}")
  }
  L.push("      >")
  L.push("        <Table")
  L.push("          rowKey=\"id\"")
  L.push("          size=\"small\"")
  L.push("          columns={columns}")
  L.push("          dataSource={rows}")
  L.push("          pagination={{ current: page, pageSize: " + pageSize + ", total, onChange: (p) => { setPage(p); reload(p) } }}")
  L.push("        />")
  L.push("      </Card>")
  L.push("")
  L.push("      <Modal")
  L.push("        open={open}")
  L.push("        title={editing ? '编辑' : '新建'}")
  L.push("        width={" + width + "}")
  L.push("        onCancel={() => setOpen(false)}")
  L.push("        onOk={submit}")
  L.push("        okText=\"保存\"")
  L.push("        cancelText=\"取消\"")
  L.push("      >")
  L.push("        <Form form={editForm} layout=\"vertical\">")
  for (const n of formFields) {
    const f = fields.find((x) => x.name === n)!
    L.push(controlFor(f, n))
  }
  if (formFields.length === 0) L.push("          <Form.Item name=\"name\" label=\"名称\"><Input /></Form.Item>")
  L.push("        </Form>")
  L.push("      </Modal>")
  L.push("    </div>")
  L.push("  )")
  L.push("}")
  return L.join("\n")
}
