"use client"

// 爬塔工坊 · 子页共用的零碎 UI（表头操作按钮、空态提示、子页小标题）
import { Button, Popconfirm, Space } from "antd"
import { Save } from "lucide-react"

/** 表格「操作」列的编辑/删除按钮组 */
export const actBtns = (onEdit: () => void, onDel: () => void, name: string) => (
  <Space size={4}>
    <Button size="small" type="text" onClick={onEdit}>编辑</Button>
    <Popconfirm title="删除" description={`删除「${name}」？`} okText="删除" cancelText="取消"
      okButtonProps={{ danger: true }} onConfirm={onDel}>
      <Button size="small" type="text" danger>删除</Button>
    </Popconfirm>
  </Space>
)

/** 表格空态（各页文案不同） */
export const emptyHint = (text: string) => (
  <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">{text}</div>
)

/** 子页顶部的一行说明 + 该页自己的保存按钮（共享顶栏也有"保存并应用"，这里给就近入口） */
export function PageHead({ title, hint, extra, onSave, saving }: {
  title: string
  hint?: React.ReactNode
  extra?: React.ReactNode
  onSave?: () => void
  saving?: boolean
}) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {extra}
        {onSave && (
          <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={onSave}>保存</Button>
        )}
      </div>
    </div>
  )
}
