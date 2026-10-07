"use client"

// 摸金行动 · 子页共用的零碎 UI（表头操作按钮、空态提示、子页小标题、图标选择）
import { useEffect, useState } from "react"
import { Button, Popconfirm, Select, Space } from "antd"
import { Save } from "lucide-react"
import { AdminPage } from "@/components/admin"
import { apiJson } from "@/lib/api"

/**
 * 图片候选：后端扫 C 端 `public/loot` 目录下发。
 * B 端浏览器读不到 C 端仓库，只能让后端扫盘（同爬塔素材的做法）。
 * 接口挂了就返回空数组 → 表单静默退回"只用 emoji"，不弹错打扰配置。
 */
export function useLootImages(): string[] {
  const [files, setFiles] = useState<string[]>([])
  useEffect(() => {
    apiJson("/api/loot-assets")
      .then((j: any) => setFiles(Array.isArray(j?.files) ? j.files : []))
      .catch(() => setFiles([]))
  }, [])
  return files
}

/** 图标下拉：候选来自扫盘，带缩略图；留空 = 前台只说 emoji */
export function ImageSelect({ value, onChange, images, placeholder }: {
  value?: string
  onChange?: (v: string) => void
  images: string[]
  placeholder?: string
}) {
  return (
    <Select
      allowClear
      className="w-full"
      value={value || undefined}
      // ⚠️ antd 的 onChange 在 clear 时给 undefined，直接透传会把表单字段写成 undefined
      onChange={(v) => onChange?.(v ?? "")}
      placeholder={placeholder ?? (images.length ? "选择图标（留空则用 emoji）" : "public/loot 下暂无图片")}
      options={images.map((f) => ({ value: f, label: f }))}
      optionRender={(o) => (
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(o.value)} alt="" className="h-6 w-6 object-contain" />
          <span className="text-xs">{String(o.value).replace(/^\/loot\//, "")}</span>
        </span>
      )}
    />
  )
}

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
