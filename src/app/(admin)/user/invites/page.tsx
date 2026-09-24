"use client"
// 邀请码管理：B 端生成 / 查看 / 作废 C 端注册邀请码
// 单码可注册次数在生成时决定，超出次数或作废后不可再用；接口契约以 CAdminController 为准
import { useCallback, useEffect, useState } from "react"
import {
  Card, Table, Button, Input, InputNumber, Modal, Form, Tag, Space, Popconfirm,
} from "antd"
import { Plus, Copy, Ban, Ticket } from "lucide-react"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type InviteCode = {
  id: number; code: string; max_uses: number; used_count: number
  revoked: number; remark: string; created_by: number | null; created_at: string
}

export default function InviteCodesPage() {
  const [items, setItems] = useState<InviteCode[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)

  const [genOpen, setGenOpen] = useState(false)
  const [genForm] = Form.useForm()
  const [busy, setBusy] = useState(false)
  const [genResult, setGenResult] = useState<InviteCode[]>([])

  const fetchData = useCallback((p: number, s: number, kw: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(s), offset: String((p - 1) * s) })
    if (kw.trim()) params.set("q", kw.trim())
    apiJson(`/api/c-admin/invite-codes?${params.toString()}`)
      .then((j) => { setItems(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || "加载邀请码失败"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData(page, pageSize, q) }, [page, pageSize, q, fetchData])

  // 复制文本：Clipboard API 仅在安全上下文（HTTPS / localhost）可用；
  // 生产经 http://IP/admin 访问时 navigator.clipboard 为 undefined，故回退到 execCommand。
  async function copyText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch { /* 落到回退方案 */ }
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.top = "-9999px"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, ta.value.length)
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }

  function copy(code: string) {
    copyText(code).then((ok) => {
      if (ok) toast.success("邀请码已复制")
      else toast.warning("复制失败，请手动选择复制")
    })
  }

  async function generate() {
    try {
      const v = await genForm.validateFields()
      setBusy(true)
      const j = await postJson("/api/c-admin/invite-codes", {
        max_uses: v.max_uses, count: v.count, remark: v.remark || "",
      })
      setGenResult(j.items || [])
      setGenOpen(false)
      genForm.resetFields()
      fetchData(page, pageSize, q)
    } catch (e: any) {
      if (e?.message) toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: number) {
    try {
      await postJson(`/api/c-admin/invite-codes/${id}/revoke`, {})
      toast.success("邀请码已作废")
      fetchData(page, pageSize, q)
    } catch (e: any) { toast.error(e.message || "作废失败") }
  }

  const columns = [
    {
      title: "邀请码", dataIndex: "code", key: "code",
      render: (code: string) => (
        <span className="inline-flex items-center gap-1.5 font-mono font-semibold tracking-wider">
          {code}
          <Button type="text" size="small" icon={<Copy size={13} />} onClick={() => copy(code)} />
        </span>
      ),
    },
    { title: "次数上限", dataIndex: "max_uses", key: "max_uses", width: 100 },
    { title: "已使用", dataIndex: "used_count", key: "used_count", width: 90 },
    {
      title: "剩余", key: "rest", width: 90,
      render: (_: any, r: InviteCode) => Math.max(r.max_uses - r.used_count, 0),
    },
    {
      title: "状态", key: "status", width: 100,
      render: (_: any, r: InviteCode) =>
        r.revoked ? <Tag color="red">已作废</Tag>
          : r.used_count >= r.max_uses ? <Tag>已用完</Tag>
            : <Tag color="green">可用</Tag>,
    },
    { title: "备注", dataIndex: "remark", key: "remark", ellipsis: true },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", width: 170 },
    {
      title: "操作", key: "op", width: 110,
      render: (_: any, r: InviteCode) =>
        r.revoked ? <span className="text-zinc-400 text-xs">—</span> : (
          <Popconfirm title="作废后剩余次数不可再用，确定作废？" onConfirm={() => revoke(r.id)} okText="作废" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<Ban size={13} />}>作废</Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><Ticket size={17} /> 邀请码管理</span>}
      extra={
        <Space>
          <Input.Search placeholder="搜索邀请码 / 备注" allowClear onSearch={(v) => { setPage(1); setQ(v) }} style={{ width: 220 }} />
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { genForm.setFieldsValue({ max_uses: 1, count: 1, remark: "" }); setGenOpen(true) }}>
            生成邀请码
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id" size="middle" loading={loading} columns={columns as any} dataSource={items}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (p, s) => { setPage(p); setPageSize(s) },
        }}
      />

      {/* 生成弹窗 */}
      <Modal title="生成邀请码" open={genOpen} onOk={generate} onCancel={() => setGenOpen(false)}
        confirmLoading={busy} okText="生成" cancelText="取消" destroyOnHidden>
        <Form form={genForm} layout="vertical" initialValues={{ max_uses: 1, count: 1, remark: "" }}>
          <Form.Item name="max_uses" label="单码可注册次数" rules={[{ required: true, message: "请输入次数" }]}
            extra="一个邀请码最多可供注册的账号数，超出后不可再用">
            <InputNumber min={1} max={10000} className="!w-full" />
          </Form.Item>
          <Form.Item name="count" label="生成数量" rules={[{ required: true, message: "请输入数量" }]}>
            <InputNumber min={1} max={50} className="!w-full" />
          </Form.Item>
          <Form.Item name="remark" label="备注（可选）">
            <Input maxLength={100} placeholder="如：2026 秋季推广" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 生成结果：逐条可复制 */}
      <Modal title={`已生成 ${genResult.length} 个邀请码`} open={genResult.length > 0}
        onOk={() => setGenResult([])} onCancel={() => setGenResult([])}
        okText="完成" cancelButtonProps={{ style: { display: "none" } }}>
        <div className="flex flex-col gap-2 max-h-80 overflow-auto py-1">
          {genResult.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2">
              <span className="font-mono font-semibold tracking-wider">{r.code}</span>
              <Button size="small" icon={<Copy size={13} />} onClick={() => copy(r.code)}>复制</Button>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}
