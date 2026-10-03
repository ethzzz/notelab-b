"use client"

// 素材配置页 · 共用小工具（清单索引、下拉分组、字节格式化、缩略图）
//
// 单独拆出来的理由：这些是**纯展示/查表逻辑**，列表页（表格行）与配置弹窗（下拉、池内列表）
// 都要用，放在页面里会让两边互相 import 页面文件（循环依赖）。
import { useEffect, useState } from "react"
import {
  cmpSeriesOrder, seriesKey, seriesLabel,
  type AssetCatalog, type AssetItem, type AssetSlot,
} from "@/lib/spire-assets"

/** 素材清单索引：URL → 清单项 / 显示名。清单可能缺项（C 端删文件），故一律返回 undefined 兜底 */
export function buildAssetIndex(catalog: AssetCatalog) {
  const m = new Map<string, AssetItem>()
  for (const g of catalog.groups) for (const it of g.items) m.set(it.url, it)
  return {
    itemOf: (url: string) => m.get(url),
    /** 显示名：manifest 中文名 → 文件名 → URL 末段（三级兜底，保证永远不显示空白） */
    nameOf: (url: string) => {
      const it = m.get(url)
      return it?.meta?.name || it?.name || url.slice(url.lastIndexOf("/") + 1)
    },
    fileOf: (url: string) => url.slice(url.lastIndexOf("/") + 1),
  }
}
export type AssetIndex = ReturnType<typeof buildAssetIndex>

/** 下拉的一项（antd Select 分组需要的结构） */
export interface Opt { value: string; label: string; title: string }
export interface OptGroup { label: string; options: Opt[] }

/**
 * 构造某个槽位的可选素材下拉：**推荐项单独一组置顶**，其余按「目录 → 系列」两层分组。
 *
 * 为什么必须分组：地牢元素包一个目录里混着骷髅石环 / 恶魔 / 营火 / 商人 / 岩桥，
 * 24 张平铺时运营只能靠文件名猜"哪几张是一套"，必然配错槽位。
 */
export function optionsOf(catalog: AssetCatalog, slot: AssetSlot): OptGroup[] {
  const filter = slot.filter
  const pick = (it: AssetItem) => (filter ? filter(it) : it.kind === "image")
  const label = (it: AssetItem) => `${it.meta?.name ? it.meta.name + " · " : ""}${it.name}`
  const opt = (it: AssetItem): Opt => ({ value: it.url, label: label(it), title: it.rel })

  const groups: OptGroup[] = []

  if (slot.suggest) {
    const rec = catalog.groups.flatMap((g) => g.items.filter((it) => pick(it) && slot.suggest!(it)))
    if (rec.length) groups.push({ label: `⭐ 推荐（${slot.label}）`, options: rec.map(opt) })
  }

  for (const g of catalog.groups) {
    const items = g.items.filter(pick)
    if (!items.length) continue
    const bySeries = new Map<string, AssetItem[]>()
    for (const it of items) {
      const k = seriesKey(it.rel)
      const list = bySeries.get(k)
      if (list) list.push(it)
      else bySeries.set(k, [it])
    }
    if (bySeries.size > 1) {
      for (const [k, list] of bySeries) {
        // 系列内按「基础款 → 变体序号」排，避免出现 营火2/营火3/营火1 这种目录序
        list.sort(cmpSeriesOrder)
        groups.push({ label: `${g.label} · ${seriesLabel(k)}（${list.length}）`, options: list.map(opt) })
      }
    } else {
      groups.push({ label: `${g.label}（${items.length}）`, options: items.map(opt) })
    }
  }
  return groups
}

/** 字节数 → 「12.3 KB」；拿不到就返回 null（调用方决定要不要显示） */
export const fmtBytes = (b?: number) => {
  if (typeof b !== "number" || !isFinite(b)) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 素材缩略图。
 * 为什么自带失败态：配置里存的是**路径字符串**，C 端删文件后配置照样留着，
 * 表格里必须表现出"这张图没了"，否则运营会以为配好了。
 */
export function Thumb({ url, size = 40, className = "" }: { url: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  if (broken) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-red-500 dark:bg-zinc-800 ${className}`}
        style={{ width: size, height: size }}
        title={`图片加载失败：${url}`}
      >
        裂图
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url} alt="" title={url}
      className={`shrink-0 rounded object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
    />
  )
}
