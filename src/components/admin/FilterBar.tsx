"use client"
// 传统后台查询栏：antd Form inline 布局 + 查询/重置按钮组。
// 用法：<FilterBar form={form} onSearch={...} onReset={...}>{Form.Item...}</FilterBar>
import { Button, Form, Space } from "antd"
import type { ReactNode } from "react"
import { Search, RotateCcw } from "lucide-react"

export default function FilterBar({
  form,
  children,
  onSearch,
  onReset,
  loading,
  searchText = "查询",
  resetText = "重置",
}: {
  form: ReturnType<typeof Form.useForm>[0]
  children: ReactNode
  onSearch: (values: Record<string, unknown>) => void
  onReset?: () => void
  loading?: boolean
  searchText?: string
  resetText?: string
}) {
  return (
    <Form
      form={form}
      layout="inline"
      className="mb-3 flex flex-wrap items-center gap-2"
      onFinish={(v) => onSearch(v as Record<string, unknown>)}
    >
      {children}
      <Space size={8}>
        <Button type="primary" htmlType="submit" loading={loading} icon={<Search size={14} />}>
          {searchText}
        </Button>
        <Button
          icon={<RotateCcw size={14} />}
          onClick={() => {
            form.resetFields()
            onReset?.()
            onSearch(form.getFieldsValue() as Record<string, unknown>)
          }}
        >
          {resetText}
        </Button>
      </Space>
    </Form>
  )
}
