"use client"
// 表单基础件：antd Input/Input.TextArea 封装，API 与原 ui/form 一致
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react"
import { Input, Button, Space } from "antd"
import { cn } from "@/lib/utils"

/** 表单字段容器：标题（可带必填星号）+ 控件 + 辅助说明 */
export function FormField({ label, required = false, hint, children, className = "" }: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex items-center gap-1 text-xs font-semibold text-zinc-500">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-zinc-400">{hint}</span>}
    </div>
  )
}

/** 单行输入框（可选左侧图标） */
export const TextInput = forwardRef<any, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }>(
  function TextInput({ icon, className, ...props }, ref) {
    return <Input ref={ref} className={className} prefix={icon} {...(props as any)} />
  }
)

/** 多行输入框 */
export const TextArea = forwardRef<any, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <Input.TextArea ref={ref} className={className} {...(props as any)} />
  }
)

/** 密码输入框（自带显示/隐藏切换） */
export function PasswordInput({ icon, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return <Input.Password className={className} prefix={icon} {...(props as any)} />
}

/** 表单操作栏：右对齐的 取消/确认 按钮组（确认按钮带忙碌态） */
export function FormActions({ onCancel, onConfirm, busy = false, cancelText = "取消", confirmText = "确定", busyText = "处理中…" }: {
  onCancel?: () => void
  onConfirm: () => void
  busy?: boolean
  cancelText?: string
  confirmText?: string
  busyText?: string
}) {
  return (
    <div className="mt-1 flex justify-end">
      <Space>
        {onCancel && <Button onClick={onCancel} disabled={busy}>{cancelText}</Button>}
        <Button type="primary" onClick={onConfirm} loading={busy}>{busy ? busyText : confirmText}</Button>
      </Space>
    </div>
  )
}
