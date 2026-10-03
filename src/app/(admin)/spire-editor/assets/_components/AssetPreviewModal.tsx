"use client"

// 素材大图预览 + 档案信息（宽高比预警 / 素材说明 / 失效提示）。
//
// 为什么必须有它：地牢元素包里「骷髅石环」与「空石环」在 40px 缩略图上几乎一样，
// 运营只能靠**大图 + 素材说明（manifest 的 notes）**判断这张该放进哪个槽位。
import { useEffect, useState } from "react"
import { Alert, Button, Modal, Tag } from "antd"
import { ExternalLink } from "lucide-react"
import { expectedRatio, seriesKey, seriesLabel, type AssetItem, type AssetSlot } from "@/lib/spire-assets"
import { fmtBytes } from "./shared"

/** C 端爬塔页（同一域名下的站内路由 /games/spire），供「看实际效果」跳转 */
const C_SPIRE_URL = "/games/spire"

export default function AssetPreviewModal({ url, item, slot, onClose }: {
  url: string
  /** 清单里的元数据（undefined = 池里有、清单里没有 = 失效路径） */
  item?: AssetItem
  /** 所在槽位（决定宽高比的期望值：连线要横向、节点要方形、立绘要竖构图） */
  slot?: AssetSlot
  onClose: () => void
}) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setDim(null); setBroken(false) }, [url])

  const file = url.slice(url.lastIndexOf("/") + 1)
  const size = fmtBytes(item?.bytes)
  const ratio = dim && dim.h ? dim.w / dim.h : null
  /** 偏离该槽位期望比例时预警（背景图之类没有期望的不报） */
  const want = slot ? expectedRatio(slot) : null
  const odd = ratio !== null && want ? (ratio < want.min || ratio > want.max) : false

  return (
    <Modal open onCancel={onClose} title={`🔍 ${item?.meta?.name || file}`}
      footer={<Button onClick={onClose}>关闭</Button>} width={620} maskClosable>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          {!broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-[380px] max-w-full object-contain"
              onLoad={(e) => setDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setBroken(true)} />
          ) : (
            <span className="text-xs text-red-500">图片加载失败（C 端文件可能已删除）</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Tag className="!mr-0" color="default">{file}</Tag>
          {dim && <Tag className="!mr-0">原始尺寸 {dim.w}×{dim.h}</Tag>}
          {size && <Tag className="!mr-0">{size}</Tag>}
          {item?.meta?.kind && <Tag className="!mr-0" color="blue">{item.meta.kind}</Tag>}
          {item && <Tag className="!mr-0">系列：{seriesLabel(seriesKey(item.rel))}</Tag>}
          {slot && <Tag className="!mr-0" color="purple">所在槽位：{slot.label}</Tag>}
          {!item && <Tag className="!mr-0" color="red">清单里没有这个路径</Tag>}
        </div>

        {dim && odd && want && (
          <Alert type="warning" showIcon className="!text-xs"
            message={`宽高比 ${ratio!.toFixed(2)}${ratio! > 1 ? "（偏横）" : "（偏竖）"}，不在「${slot?.label}」期望的 ${want.min}–${want.max === 100 ? "∞" : want.max} 之间`}
            description={want.why} />
        )}

        {item?.meta?.notes && (
          <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">素材说明（来自素材包 manifest）</div>
            <div className="mt-1 text-xs leading-relaxed">{item.meta.notes}</div>
          </div>
        )}
        {!item?.meta?.notes && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            该素材在 manifest 里没有 notes 说明 —— 判断归属只能靠文件名与大图。
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
          <code className="truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={item?.rel || url}>{item?.rel || url}</code>
          <a href={C_SPIRE_URL} target="_blank" rel="noreferrer"
            className="flex shrink-0 items-center gap-1 text-indigo-500 hover:text-indigo-400">
            <ExternalLink size={12} /> 在 C 端爬塔页看实际效果
          </a>
        </div>
      </div>
    </Modal>
  )
}
