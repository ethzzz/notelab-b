"use client"
// 公共弹窗：antd Modal 封装，API 与原 ui/modal 一致（open/onClose/title/maxW，内容无 footer）
import { Modal as AntModal } from "antd"

const WIDTHS: Record<string, number> = {
  "max-w-sm": 420,
  "max-w-md": 480,
  "max-w-lg": 560,
  "max-w-xl": 640,
  "max-w-2xl": 720,
  "max-w-3xl": 840,
}

export default function Modal({ open, onClose, title, children, maxW = "max-w-sm" }: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  maxW?: string
}) {
  return (
    <AntModal
      open={open}
      onCancel={onClose}
      title={title}
      footer={null}
      width={WIDTHS[maxW] || 420}
      destroyOnHidden
      maskClosable
    >
      {children}
    </AntModal>
  )
}
