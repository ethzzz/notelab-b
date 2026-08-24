"use client"
// 公共下拉选择：antd Select 封装，API 与原 ui/select 一致
// options 支持字符串数组或 { value, label, icon?, desc? }
import { Select as AntSelect } from "antd"

export type SelectOption = { value: string; label: string; icon?: string; desc?: string }

export default function Select({ value, onChange, options, placeholder = "请选择", className = "", disabled = false, size = "md" }: {
  value: string
  onChange: (v: string) => void
  options: (SelectOption | string)[]
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: "sm" | "md"
}) {
  const opts: SelectOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o))
  return (
    <AntSelect
      className={className}
      style={{ minWidth: 0 }}
      value={value || undefined}
      onChange={(v) => onChange(v)}
      placeholder={placeholder}
      disabled={disabled}
      size={size === "sm" ? "small" : "middle"}
      popupMatchSelectWidth
      options={opts.map((o) => ({
        value: o.value,
        label: (
          <span className="inline-flex items-center gap-1.5">
            {o.icon && <span className="leading-none">{o.icon}</span>}
            <span className="truncate">{o.label}</span>
            {o.desc && <span className="text-xs text-zinc-400">{o.desc}</span>}
          </span>
        ),
      }))}
    />
  )
}
