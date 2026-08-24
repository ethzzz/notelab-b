"use client"
// 命令式确认弹窗：antd Modal.confirm 实现，API 与原 ui/confirm 一致
// const ok = await confirmDialog({ message: "删除这个对话？", confirmText: "删除" })
import { Modal } from "antd"

type ConfirmOptions = { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: opts.title || "请确认",
      content: <span className="whitespace-pre-wrap">{opts.message}</span>,
      okText: opts.confirmText || "确定",
      cancelText: opts.cancelText || "取消",
      okButtonProps: opts.danger === false ? {} : { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

/** 兼容旧导出：antd Modal.confirm 无需全局挂载点 */
export function ConfirmHost() {
  return null
}
