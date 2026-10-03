"use client"

// 摸金行动 · 子页共用的零碎 UI（表头操作按钮、空态提示、子页小标题）
import { Button, Popconfirm, Space } from "antd"
import { Save } from "lucide-react"
import { AdminPage } from "@/components/admin"

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

/** 表格空态 */
export const emptyHint = (text: string) => (
  <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">{text}</div>
)

/** 子页顶部：说明 + 该页自己的保存按钮 */
export function PageHead({ title, hint, extra, onSave, saving }: {
  title: string
  hint?: React.ReactNode
  extra?: React.ReactNode
  onSave?: () => void
  saving?: boolean
}) {
  return (
    <AdminPage
      level={2}
      title={title}
      description={hint}
      extra={(extra || onSave) ? (
        <>
          {extra}
          {onSave && (
            <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={onSave}>保存</Button>
          )}
        </>
      ) : undefined}
    />
  )
}
