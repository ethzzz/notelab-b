"use client"
// 传统后台弹窗表单：封装 Modal + Form，统一打开/校验/提交流程，供列表页新建/编辑复用。
import { Form, Modal } from "antd"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { track } from "@/lib/track"

export default function ModalForm({
  open,
  title,
  children,
  initialValues,
  confirmLoading,
  onCancel,
  onSubmit,
  width = 520,
  okText,
  cancelText,
  okButtonProps,
  /** 关闭即销毁：默认开启，避免上一次打开时的组件内状态（图片加载态、局部滚动）残留 */
  destroyOnClose = true,
  /** 埋点用实体名（如 "users"/"invites"）；不传则退回把 title 当字符串用 */
  entity,
}: {
  open: boolean
  title: ReactNode
  children: ReactNode
  initialValues?: Record<string, any>
  confirmLoading?: boolean
  onCancel: () => void
  onSubmit: (values: any) => void | Promise<void>
  width?: number
  okText?: ReactNode
  cancelText?: ReactNode
  okButtonProps?: Record<string, any>
  destroyOnClose?: boolean
  entity?: string
}) {
  const [form] = Form.useForm()

  // initialValues 通常是调用方现场拼的对象字面量（每次渲染都是新引用），
  // **绝不能进 effect 依赖**：否则父组件任何一次重渲染都会 re-run 下面的 resetFields，
  // 把用户正在编辑的内容清空。用 ref 取最新值，effect 只认 open。
  const initialRef = useRef(initialValues)
  initialRef.current = initialValues

  /**
   * 提交包装：所有后台新建/编辑弹窗都走这里 —— **全站 admin_crud 只埋这一处**（PRD §4.2）。
   *
   * ⚠️ 口径说明：`ok` 依据 onSubmit 是否**抛出异常**判定。若某页把错误自己 catch 掉并只弹 toast，
   * 这里会记成 ok=true —— 对「功能有没有被用」的统计足够，但别拿它当失败率看。
   */
  const entityName = entity || (typeof title === "string" ? title : "entity")
  const submit = async (v: any) => {
    try {
      await onSubmit(v)
      track("admin_crud", { entity: entityName, ok: true })
    } catch {
      track("admin_crud", { entity: entityName, ok: false })
    }
  }

  useEffect(() => {
    if (!open) return
    // 必须先 resetFields 再 setFieldsValue：否则上一记录里 initialValues 没覆盖到的字段
    // 会残留旧值（典型事故：先编辑 A 再编辑 B，B 的某个可选项沿用了 A 的值）。
    form.resetFields()
    form.setFieldsValue(initialRef.current || {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form])

  return (
    <Modal
      open={open}
      title={title}
      width={width}
      confirmLoading={confirmLoading}
      maskClosable={false}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={okButtonProps}
      destroyOnClose={destroyOnClose}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" className="mt-4" onFinish={(v) => submit(v)}>
        {children}
      </Form>
    </Modal>
  )
}
