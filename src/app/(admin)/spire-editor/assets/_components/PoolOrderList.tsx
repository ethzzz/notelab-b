"use client"

// 资源池顺序列表：缩略图 + 「设为当前 / 看大图 / 复制 / 换位 / 移出」。
//
// 为什么放在弹窗里而不是列表页：池子可能有十几个候选，铺在表格行里会把行高撑爆；
// 弹窗里有整块空间，可以直接给出 80px 缩略图与排序按钮。
//
// 数据源是**弹窗表单里的 pool 字段**（通过 Form context 读写），
// 这样「下拉多选」与「这里的排序/移出」是同一份数据，不会出现两处不一致。
import { Alert, Button, Form, Tag, Tooltip } from "antd"
import { ArrowLeft, ArrowRight, Copy, Maximize2 } from "lucide-react"
import { Thumb, type AssetIndex } from "./shared"

/** 反向索引的一项：这张图还被哪些**别的**槽位引用 */
export interface UsedBy { key: string; label: string; current: boolean }

export default function PoolOrderList({ index, invalid, usedByOf, onPreview, onCopyRequest }: {
  index: AssetIndex
  /** 该槽位里**在素材清单中已找不到**的路径（C 端文件被删 / 前缀改过） */
  invalid: string[]
  /** 素材路径 → 还被哪些别的槽位引用 */
  usedByOf: Map<string, UsedBy[]>
  onPreview: (url: string) => void
  onCopyRequest: (url: string) => void
}) {
  const form = Form.useFormInstance()
  const pool: string[] = Form.useWatch("pool", form) || []
  const current: string = Form.useWatch("current", form) || ""

  const write = (next: string[]) => {
    form.setFieldValue("pool", next)
    // 「当前使用」必须仍落在池内：不在了就取第一个；池空则清空（回落内置默认）
    if (next.length) {
      if (!next.includes(current)) form.setFieldValue("current", next[0])
    } else {
      form.setFieldValue("current", undefined)
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= pool.length) return
    const next = [...pool]
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp
    write(next)
  }

  if (!pool.length) {
    return (
      <div className="rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
        资源池为空 · 在上方下拉里选素材加入后，这里可调整顺序与指定「当前使用」哪一个
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
        顺序＝展示次序，也决定「填充推荐后默认用哪张」。共 {pool.length} 个候选。
      </div>
      <div className="flex flex-wrap gap-2">
        {pool.map((url, i) => {
          const shared = usedByOf.get(url) || []
          const bad = invalid.includes(url)
          const active = url === current
          return (
            <div key={url}
              className={`flex w-[124px] shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 ${bad
                ? "border-red-500 bg-red-50 dark:bg-red-500/10"
                : active
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
                  : "border-zinc-200 dark:border-zinc-700"}`}>
              <div className="group relative cursor-pointer" onClick={() => onPreview(url)} title="点击看大图">
                <Thumb url={url} size={80} />
                <span className="absolute right-0.5 top-0.5 hidden rounded bg-black/50 p-0.5 text-white group-hover:block">
                  <Maximize2 size={10} />
                </span>
              </div>
              <span className="line-clamp-1 w-full text-center text-[11px] leading-tight" title={url}>
                {index.nameOf(url)}
              </span>
              {shared.length > 0 && (
                <Tooltip title={`还被这些槽位使用：${shared.map((u) => u.label + (u.current ? "（正在用）" : "（在池中）")).join("、")}`}>
                  <Tag color="purple" className="!mr-0 !text-[10px]">另 {shared.length} 槽位在用</Tag>
                </Tooltip>
              )}
              {/* 底部拆两行：状态行 + 操作行；124px 卡片塞一行必溢出 */}
              <div className="flex flex-wrap items-center justify-center gap-1">
                {active
                  ? <Tag color="blue" className="!mr-0 !text-[10px]">当前使用</Tag>
                  : <Button size="small" type="text" className="!h-5 !px-1 !text-[10px]"
                    onClick={() => form.setFieldValue("current", url)}>用这个</Button>}
                {bad && <Tag color="red" className="!mr-0 !text-[10px]">清单无此文件</Tag>}
              </div>
              <div className="flex items-center justify-center gap-0.5">
                <Tooltip title="复制到其它槽位的资源池">
                  <Button size="small" type="text" className="!h-5 !px-0.5 !text-[10px]" icon={<Copy size={10} />}
                    onClick={() => onCopyRequest(url)} />
                </Tooltip>
                <Tooltip title="前移">
                  <Button size="small" type="text" className="!h-5 !px-0.5 !text-[10px]" icon={<ArrowLeft size={10} />}
                    disabled={i <= 0} onClick={() => move(i, -1)} />
                </Tooltip>
                <Tooltip title="后移">
                  <Button size="small" type="text" className="!h-5 !px-0.5 !text-[10px]" icon={<ArrowRight size={10} />}
                    disabled={i >= pool.length - 1} onClick={() => move(i, 1)} />
                </Tooltip>
                <Button size="small" type="text" danger className="!h-5 !px-0.5 !text-[10px]"
                  onClick={() => write(pool.filter((p) => p !== url))}>移出</Button>
              </div>
            </div>
          )
        })}
      </div>
      {invalid.length > 0 && (
        <Alert type="warning" showIcon className="!text-xs"
          message={`池中有 ${invalid.length} 个路径在素材清单里找不到（C 端文件可能被删除），已在上方标红`} />
      )}
    </div>
  )
}
