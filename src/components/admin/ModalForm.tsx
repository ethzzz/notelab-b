"use client"
// 传统后台弹窗表单：封装 Modal + Form，统一打开/校验/提交流程，供列表页新建/编辑复用。
import { Form, Modal } from "antd"
import type { ReactNode } from "react"
import { useEffect } from "react"

export default function ModalForm({
  open,
  title,
  children,
  initialValues,
  confirmLoading,
  onCancel,
  onSubmit,
  width = 520,
}: {
  open: boolean
  title: ReactNode
  children: ReactNode
  initialValues?: Record<string, any>
  confirmLoading?: boolean
  onCancel: () => void
  onSubmit: (values: any) => void | Promise<void>
  width?: number
}) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (open) form.setFieldsValue(initialValues || {})
  }, [open, initialValues, form])

  return (
    <Modal
      open={open}
      title={title}
      width={width}
      confirmLoading={confirmLoading}
      maskClosable={false}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" className="mt-4" onFinish={(v) => onSubmit(v)}>
        {children}
      </Form>
    </Modal>
  )
}
