"use client"

// 爬塔工坊 · 素材资源配置
//
// 交互：每个槽位 = 一个**资源池**（可登记多个候选）+ 指定「当前使用哪一个」。
// 分工：assetPool[key] = 该类型的候选池；assets[key] = 当前生效的那个（必须属于池子）。
// 换图只是在池子里改指向，不用重新找素材路径 —— 这就是「同类多个、用时选一个」。
//
// 候选池来自后端扫盘接口 GET /api/spire-assets/catalog —— B 端浏览器读不到 C 端仓库，
// 所以清单只能由后端给（见 notelab-java SpireAssetController）。
//
// 存的是**路径字符串**（如 /spire/art/dungeon/stone-skull.svg），不搬文件；
// 真正的文件仍在 C 端 public/spire 下（C 端无 basePath，挂在根路径）。
//
// 运营视角的四条防线（缺一条就会出"后台配好了、游戏里没变"这类事故）：
// ① 路径失效检测 —— 存的是字符串，C 端删文件/改前缀后配置照样留着，页面必须能发现并清理；
// ② 草稿 vs 已发布对比 —— 保存与发布是两步，只保存不发布玩家看不到；
// ③ 一键填充不得覆盖手工挑的候选 —— 只增不减，改「当前使用」前先确认；
// ④ 异常态可一键修复 —— 「当前值不在池中」要能并入池子或清空。
//
// 挑素材时的可用性（同一批图在 56px 缩略图上根本分不出来，必须能放大 + 看说明）：
// ⑤ 大图预览：原始尺寸 / 字节 / **素材说明（manifest notes）** / 宽高比预警 / 一键跳 C 端看实际效果；
// ⑥ 下拉按「系列」再分一组（骷髅石环 / 恶魔 / 营火 / 商人 / 岩桥…），而不是 24 张平铺；
// ⑦ 跨槽位复用：池子里任意一张可复制到其它槽位的池子（只加候选，不动目标当前使用的那张）；
// ⑧ 撤销改动：回退到上次加载/保存成功的状态（草稿只在前端内存里，服务端那份天然就是基线）；
// ⑨ 顶部「未配置槽位」一览，点标签直接跳过去（页面很长，"哪些还没配"要能一眼看到）。
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Button, Card, Modal, Popconfirm, Select, Space, Spin, Tag, Tooltip } from "antd"
import { Copy, Eraser, ExternalLink, Maximize2, RotateCcw, Sparkles, Undo2, Upload, Wand2 } from "lucide-react"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import {
  CATALOG_EMPTY, SLOT_GROUPS, cmpSeriesOrder, configuredCount, pooledCount, seriesKey, seriesLabel, suggestedItems,
  sanitizeAssetMap, sanitizeAssetPool, slotsWithChars,
  type AssetCatalog, type AssetGroup, type AssetItem, type AssetSlot,
} from "@/lib/spire-assets"

/** C 端爬塔页（同一域名下的站内路由 /games/spire），供「看实际效果」跳转 */
const C_SPIRE_URL = "/games/spire"

/** 下拉选项：按素材目录分组，标签优先用 manifest 里的中文名；**推荐项排在最前**单独一组 */
function optionsOf(catalog: AssetCatalog, slot: AssetSlot) {
  const filter = slot.filter
  const pick = (it: AssetItem) => (filter ? filter(it) : it.kind === "image")
  const label = (it: AssetItem) => `${it.meta?.name ? it.meta.name + " · " : ""}${it.name}`
  const opt = (it: AssetItem) => ({ value: it.url, label: label(it), title: it.rel })

  const groups: { label: string; options: { value: string; label: string; title: string }[] }[] = []

  if (slot.suggest) {
    const rec = catalog.groups.flatMap((g) => g.items.filter((it) => pick(it) && slot.suggest!(it)))
    if (rec.length) groups.push({ label: `⭐ 推荐（${slot.label}）`, options: rec.map(opt) })
  }

  for (const g of catalog.groups as AssetGroup[]) {
    const items = g.items.filter(pick)
    if (!items.length) continue
    // 一个目录里混了多个系列时（地牢元素包：骷髅石环/恶魔/营火/商人/岩桥…），
    // 再按系列分一层 —— 否则 24 张图平铺在一个分组里，靠文件名根本挑不出"哪几张是一套"。
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

/** 字节数 → 「12.3 KB」 */
const fmtBytes = (b?: number) => {
  if (typeof b !== "number" || !isFinite(b)) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 素材大图预览 + 档案信息。
 * 为什么必须有它：地牢元素包里「骷髅石环」与「空石环」在 56px 缩略图上几乎一样，
 * 运营只能靠**大图 + 素材说明（manifest 的 notes）**判断这张该放进哪个槽位。
 */
function AssetPreviewModal({ url, item, slotLabel, onClose }: {
  url: string
  item?: AssetItem
  slotLabel?: string
  onClose: () => void
}) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setDim(null); setBroken(false) }, [url])
  const file = url.slice(url.lastIndexOf("/") + 1)
  const size = fmtBytes(item?.bytes)
  // 宽高比偏离太多时，C 端等比铺进节点框会明显留白/被裁 —— 提前预警而不是等玩家截图反馈
  const ratio = dim && dim.h ? dim.w / dim.h : null
  const odd = ratio !== null && (ratio > 1.6 || ratio < 0.62)

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
          {slotLabel && <Tag className="!mr-0" color="purple">所在槽位：{slotLabel}</Tag>}
        </div>

        {dim && odd && (
          <Alert type="warning" showIcon className="!text-xs"
            message={`宽高比 ${ratio!.toFixed(2)}（${ratio! > 1 ? "很扁" : "很高"}），铺进 C 端方形节点框会明显留白或被裁，建议换一张接近 1:1 的图`} />
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

/** 把一张候选复制到别的槽位的资源池（跨槽位复用：同一张图给多个节点类型用） */
function CopyToSlotsModal({ url, from, slots, onClose, onPick }: {
  url: string
  /** 来源槽位 key（自己不出现在候选里） */
  from: string
  slots: AssetSlot[]
  onClose: () => void
  onPick: (keys: string[]) => void
}) {
  const [keys, setKeys] = useState<string[]>([])
  const options = slots
    .filter((s) => s.key !== from)
    .map((s) => ({ value: s.key, label: `${s.label}（${s.key}）` }))
  return (
    <Modal open onCancel={onClose} title="复制到其它槽位"
      okText="复制" cancelText="取消" okButtonProps={{ disabled: !keys.length }}
      onOk={() => { onPick(keys); onClose() }} maskClosable={false} width={460}>
      <div className="mt-3 flex flex-col gap-2">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          把 <code>{url.slice(url.lastIndexOf("/") + 1)}</code> 加进目标槽位的<b>资源池</b>（只新增候选，
          <b>不会</b>改动目标槽位当前正在用的那张图）。
        </div>
        <Select mode="multiple" showSearch allowClear className="!w-full" size="small"
          placeholder="选择目标槽位（可多选）" optionFilterProp="label"
          value={keys} onChange={(v) => setKeys(v as string[])} options={options} />
        {keys.length > 0 && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            将写入：{keys.join("、")}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** 资源池里的一张素材：缩略图 + 名称 + 「设为当前 / 看大图 / 复制 / 移出」 */
function PoolCard({ url, item, name, active, invalid, onUse, onRemove, onPreview, onCopy }: {
  url: string
  /** 清单里的元数据（可能为 undefined：池里有、清单里没有 = 失效路径） */
  item?: AssetItem
  name: string
  active: boolean
  /** 路径在素材清单里找不到（C 端文件被删 / 前缀改过）→ 标红，提示清理 */
  invalid?: boolean
  onUse: () => void
  onRemove: () => void
  onPreview: () => void
  onCopy: () => void
}) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  const tip = item?.meta?.notes
    ? `${item.meta.notes}\n\n${item.meta.name || ""} · ${url}`
    : (invalid ? `素材清单里没有这个路径，C 端可能已删除：${url}` : `点击设为当前使用：${url}`)
  return (
    <div
      className={`flex w-[124px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 transition ${invalid
        ? "border-red-500 bg-red-50 dark:bg-red-500/10"
        : active
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"}`}
      onClick={onUse}
      title={tip}
    >
      {/* 56px 时骷髅石环与空石环几乎分不出来，放大到 80px，并支持点开看大图 */}
      <div className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-zinc-50 dark:bg-zinc-900"
        onClick={(e) => { e.stopPropagation(); onPreview() }} title="点击看大图">
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-[10px] text-zinc-400">加载失败</span>
        )}
        <span className="absolute right-0.5 top-0.5 hidden rounded bg-black/50 p-0.5 text-white group-hover:block">
          <Maximize2 size={10} />
        </span>
      </div>
      <span className="line-clamp-1 w-full text-center text-[11px] leading-tight">{name}</span>
      <div className="flex items-center gap-1">
        {active
          ? <Tag color="blue" className="!mr-0 !text-[10px]">当前使用</Tag>
          : <Button size="small" type="text" className="!h-5 !px-1 !text-[10px]" onClick={(e) => { e.stopPropagation(); onUse() }}>用这个</Button>}
        {invalid && <Tag color="red" className="!mr-0 !text-[10px]">清单无此文件</Tag>}
        <Tooltip title="复制到其它槽位的资源池">
          <Button size="small" type="text" className="!h-5 !px-1 !text-[10px]" icon={<Copy size={10} />}
            onClick={(e) => { e.stopPropagation(); onCopy() }} />
        </Tooltip>
        <Button size="small" type="text" danger className="!h-5 !px-1 !text-[10px]"
          onClick={(e) => { e.stopPropagation(); onRemove() }}>移出</Button>
      </div>
    </div>
  )
}

function SlotRow({ slot, catalog, invalid, allSlots }: {
  slot: AssetSlot
  catalog: AssetCatalog
  /** 该槽位里**在素材清单中已找不到**的路径（C 端文件被删 / 前缀改过） */
  invalid: string[]
  /** 全部槽位（跨槽位复制时的目标候选） */
  allSlots: AssetSlot[]
}) {
  const { assets, setAssets, assetPool, setAssetPool } = useSpire()
  const pool = assetPool[slot.key] || []
  const active = assets[slot.key] || ""
  const effective = active || slot.default

  const options = useMemo(() => optionsOf(catalog, slot), [catalog, slot])
  const recommended = useMemo(() => suggestedItems(slot, catalog), [catalog, slot])

  /** 素材路径 → 清单项（用于大图预览的档案信息：说明/字节/尺寸） */
  const itemOf = useMemo(() => {
    const m = new Map<string, AssetItem>()
    for (const g of catalog.groups) {
      for (const it of g.items) m.set(it.url, it)
    }
    return (url: string) => m.get(url)
  }, [catalog])

  /** 素材路径 → 显示名（manifest 中文名优先，否则文件名） */
  const nameOf = (url: string) => {
    const it = itemOf(url)
    return it?.meta?.name || it?.name || url.slice(url.lastIndexOf("/") + 1)
  }

  /** 大图预览 / 跨槽位复制的目标（一次只操作一张，故用单个 state 而非数组） */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [copyUrl, setCopyUrl] = useState<string | null>(null)

  /** 改池子：顺带保证「当前使用」仍落在池内 —— 不在了就取第一个；池空则清空（回落内置默认） */
  const setPool = (next: string[]) => {
    setAssetPool((prev) => {
      const n = { ...prev }
      if (next.length) n[slot.key] = next
      else delete n[slot.key]
      return n
    })
    setAssets((prev) => {
      const cur = prev[slot.key]
      if (next.includes(cur)) return prev
      const n = { ...prev }
      if (next.length) n[slot.key] = next[0]
      else delete n[slot.key]
      return n
    })
  }

  const useThis = (url: string) => setAssets((prev) => ({ ...prev, [slot.key]: url }))
  const removeFromPool = (url: string) => setPool(pool.filter((p) => p !== url))
  /** 异常修复：当前值不在池内时，把它并进池子（保留当前选择，不换图） */
  const mergeCurrentIntoPool = () =>
    setAssetPool((prev) => ({ ...prev, [slot.key]: [...(prev[slot.key] || []), active] }))

  /** 填充推荐：把该类型的推荐素材并入池子（只增不减），并把第一个设为当前使用 */
  const fillRecommended = () => {
    const rec = recommended.map((r) => r.url)
    if (!rec.length) return
    const merged = [...pool]
    for (const u of rec) if (!merged.includes(u)) merged.push(u)
    setPool(merged)
    useThis(rec[0])
  }

  const notInPool = !!active && !pool.includes(active)

  return (
    <div id={`slot-${slot.key}`} className="flex scroll-mt-4 flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">{slot.label}</span>
        <Tag className="!mr-0" color="default">{slot.key}</Tag>
        {active
          ? <>
            <Tag className="!mr-0" color="green">已选：{nameOf(active)}</Tag>
            <Tooltip title="看大图与素材说明">
              <Button size="small" type="text" className="!h-6 !px-1" icon={<Maximize2 size={12} />}
                onClick={() => setPreviewUrl(active)} />
            </Tooltip>
          </>
          : <Tag className="!mr-0">内置默认</Tag>}
        <span className="text-xs text-zinc-400">池中 {pool.length} 个</span>
        {notInPool && (
          <Tooltip title="配置里存了这张图，但资源池里没有它 —— 通常是手工改过路径或旧数据残留">
            <Tag className="!mr-0" color="orange">当前值不在池中</Tag>
          </Tooltip>
        )}
        {invalid.length > 0 && <Tag className="!mr-0" color="red">{invalid.length} 个失效</Tag>}
        <code className="truncate text-[10px] text-zinc-400 dark:text-zinc-500" title={effective || "（无）"}>
          {effective || "（无 — C 端走自绘兜底）"}
        </code>
      </div>

      {/* 资源池：横向缩略图，点一下即用 */}
      {pool.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pool.map((url) => (
            <PoolCard key={url} url={url} item={itemOf(url)} name={nameOf(url)} active={url === active}
              invalid={invalid.includes(url)}
              onUse={() => useThis(url)} onRemove={() => removeFromPool(url)}
              onPreview={() => setPreviewUrl(url)} onCopy={() => setCopyUrl(url)} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          资源池为空 · 添加多个素材后可用「点一下即用」的方式切换当前使用哪一个
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select
          className="!w-96 max-w-full"
          size="small"
          mode="multiple"
          showSearch
          allowClear
          value={pool}
          placeholder="选择素材加入该类型的资源池（可多选）"
          optionFilterProp="label"
          onChange={(v) => setPool(v as string[])}
          options={options}
          notFoundContent="素材清单里没有可选项"
        />
        {recommended.length > 0 && (
          <Tooltip title={`把「${slot.label}」的推荐素材（${recommended.length} 个）加入池子，并把第一个设为当前使用`}>
            <Button size="small" icon={<Sparkles size={12} />} onClick={fillRecommended}>
              填充推荐（{recommended.length}）
            </Button>
          </Tooltip>
        )}
        {notInPool && (
          <Tooltip title={`把当前使用的这张图加进资源池（不换图）：${active}`}>
            <Button size="small" onClick={mergeCurrentIntoPool}>并入池子</Button>
          </Tooltip>
        )}
        {active && (
          <Tooltip title="清空「当前使用」，回落内置默认（资源池保留）">
            <Button size="small" icon={<RotateCcw size={12} />}
              onClick={() => setAssets((prev) => { const n = { ...prev }; delete n[slot.key]; return n })}>
              恢复默认
            </Button>
          </Tooltip>
        )}
      </div>

      {slot.hint && <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{slot.hint}</span>}

      {previewUrl && (
        <AssetPreviewModal url={previewUrl} item={itemOf(previewUrl)} slotLabel={slot.label}
          onClose={() => setPreviewUrl(null)} />
      )}
      {copyUrl && (
        <CopyToSlotsModal url={copyUrl} from={slot.key} slots={allSlots}
          onClose={() => setCopyUrl(null)}
          onPick={(keys) => {
            setAssetPool((prev) => {
              const n = { ...prev }
              for (const k of keys) {
                const cur = n[k] || []
                if (!cur.includes(copyUrl)) n[k] = [...cur, copyUrl]
              }
              return n
            })
            toast.success(`已复制到 ${keys.length} 个槽位的资源池（还需「保存」才落库）`)
          }} />
      )}
    </div>
  )
}

export default function SpireAssetsPage() {
  const {
    assets, setAssets, assetPool, setAssetPool, busy, saveQuiet, dirty, loaded, charPool,
    publish, pubBusy, revert,
  } = useSpire()
  const [catalog, setCatalog] = useState<AssetCatalog>(CATALOG_EMPTY)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    let alive = true
    apiJson("/api/spire-assets/catalog")
      .then((j) => { if (alive) setCatalog({ ...CATALOG_EMPTY, ...j }) })
      .catch(() => { if (alive) setCatalog({ ...CATALOG_EMPTY, warning: "素材清单接口请求失败（后端未启动？）" }) })
      .finally(() => { if (alive) setFetching(false) })
    return () => { alive = false }
  }, [])

  // 角色立绘槽位按**运行时角色池**展开（工坊自定义角色 + 内置去重），
  // 与「角色授权」页共用同一份池子 —— 新建一个角色就能立刻给它配立绘
  const slots = useMemo(() => slotsWithChars(charPool), [charPool])

  // 首次加载时把库里不认识的槽位键清掉（改名残留），避免一直显示"已配置"却没人认
  useEffect(() => {
    if (!loaded) return
    const clean = sanitizeAssetMap(assets)
    if (Object.keys(clean).length !== Object.keys(assets).length) setAssets(clean)
    const cleanPool = sanitizeAssetPool(assetPool)
    if (Object.keys(cleanPool).length !== Object.keys(assetPool).length) setAssetPool(cleanPool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const done = configuredCount(assets, slots)
  const pooled = pooledCount(assetPool, slots)

  // ---------- 未配置槽位一览（走内置默认的那批，最容易被人忘掉） ----------
  const unconfigured = useMemo(() => slots.filter((s) => !assets[s.key]), [slots, assets])
  const [showUnset, setShowUnset] = useState(false)
  /** 点标签跳到对应槽位（页面很长，靠滚的找不到） */
  const jumpToSlot = (key: string) => {
    document.getElementById(`slot-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  // ---------- 防线②：草稿 vs 已发布 ----------
  /** 已发布快照的素材切片（GET /api/spire-content/published） */
  const [pub, setPub] = useState<{ published: boolean; assets: Record<string, string> } | null>(null)
  const loadPublished = useCallback(() => {
    apiJson("/api/spire-content/published")
      .then((j) => setPub({ published: !!j.published, assets: (j.assets || {}) as Record<string, string> }))
      .catch(() => setPub(null))
  }, [])
  useEffect(() => { loadPublished() }, [loadPublished])

  /** 与已发布不一致的槽位（含"还没保存"的改动 —— 反正玩家都看不到） */
  const diffFromPublished = useMemo(() => {
    if (!pub) return []
    return slots.filter((s) => (assets[s.key] || "") !== (pub.assets[s.key] || ""))
  }, [pub, assets, slots])

  // ---------- 防线①：失效路径检测 ----------
  /** 素材清单里真实存在的 URL 全集；清单拿不到时为 null（不能把全部配置误判成失效） */
  const knownUrls = useMemo(() => {
    if (!catalog.available) return null
    const s = new Set<string>()
    for (const g of catalog.groups) for (const it of g.items) s.add(it.url)
    return s
  }, [catalog])

  /** 槽位 key → 该槽位里已失效的路径（池内 + 当前使用） */
  const invalidBySlot = useMemo(() => {
    const out: Record<string, string[]> = {}
    if (!knownUrls) return out
    for (const s of slots) {
      const bad = (assetPool[s.key] || []).filter((u) => !knownUrls.has(u))
      const cur = assets[s.key]
      if (cur && !knownUrls.has(cur) && !bad.includes(cur)) bad.unshift(cur)
      if (bad.length) out[s.key] = bad
    }
    return out
  }, [knownUrls, assetPool, assets, slots])
  const invalidTotal = Object.values(invalidBySlot).reduce((n, v) => n + v.length, 0)

  /** 清理失效项；当前使用若失效，取池内第一个有效候选，没有就回落内置默认 */
  const cleanInvalid = () => {
    setAssetPool((prev) => {
      const n = { ...prev }
      for (const [k, bad] of Object.entries(invalidBySlot)) {
        const rest = (n[k] || []).filter((u) => !bad.includes(u))
        if (rest.length) n[k] = rest
        else delete n[k]
      }
      return n
    })
    setAssets((prev) => {
      const n = { ...prev }
      for (const [k, bad] of Object.entries(invalidBySlot)) {
        if (!n[k] || !bad.includes(n[k])) continue
        const rest = (assetPool[k] || []).filter((u) => !bad.includes(u))
        if (rest.length) n[k] = rest[0]
        else delete n[k]
      }
      return n
    })
    toast.success(`已清理 ${invalidTotal} 个失效素材（还需「保存」+「发布到 C 端」）`)
  }

  // ---------- 防线③：一键填充不得吞掉手工挑的候选 ----------
  /**
   * 填充预演：**只增不减**（保留池内已有顺序与当前选择），
   * 只有当槽位还没选图时才把推荐的第一张设为当前使用 —— 绝不覆盖运营手工选的那张。
   */
  const fillPlan = useMemo(() => slots.map((s) => {
    const rec = suggestedItems(s, catalog).map((r) => r.url)
    if (!rec.length) return null
    const pool = assetPool[s.key] || []
    const add = rec.filter((u) => !pool.includes(u))
    const cur = assets[s.key] || ""
    const keepCur = !!cur && pool.includes(cur)
    const nextCur = keepCur ? cur : rec[0]
    return { slot: s, add, nextCur, curChanged: nextCur !== cur }
  }).filter(Boolean) as { slot: AssetSlot; add: string[]; nextCur: string; curChanged: boolean }[],
    [slots, catalog, assetPool, assets])

  const [fillOpen, setFillOpen] = useState(false)
  const applyFillAll = () => {
    for (const p of fillPlan) {
      if (p.add.length) {
        setAssetPool((prev) => ({ ...prev, [p.slot.key]: [...(prev[p.slot.key] || []), ...p.add] }))
      }
      if (p.curChanged) setAssets((prev) => ({ ...prev, [p.slot.key]: p.nextCur }))
    }
    setFillOpen(false)
    toast.success(`已按推荐填充 ${fillPlan.length} 个槽位（还需「保存」+「发布到 C 端」才对玩家生效）`)
  }

  /** 发布并刷新对比（保存只落草稿，不发布玩家看不到） */
  const doPublish = async () => {
    await publish()
    loadPublished()
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🧩 素材资源配置"
        hint={`共 ${slots.length} 个槽位：${done} 个已指定素材，资源池共登记 ${pooled} 个候选；同类可登记多个，用时选一个`}
        onSave={saveQuiet}
        saving={busy}
        extra={
          <>
            <Button size="small" icon={<Wand2 size={12} />} disabled={fetching || !catalog.available || !fillPlan.length}
              onClick={() => setFillOpen(true)}>
              按推荐填充全部
            </Button>
            {/* 保存 ≠ 发布：把「玩家现在看到的是什么」直接摆在页头 */}
            {pub && pub.published && diffFromPublished.length > 0 && (
              <Tooltip title={`与玩家当前看到的版本相比，这些槽位不同：${diffFromPublished.map((s) => s.label).join("、")}`}>
                <Tag color="orange" className="!mr-0">{diffFromPublished.length} 个槽位未发布</Tag>
              </Tooltip>
            )}
            {pub && !pub.published && <Tag color="red" className="!mr-0">尚未发布</Tag>}
            <Button size="small" type="primary" icon={<Upload size={12} />} loading={pubBusy}
              disabled={!pub || (pub.published && diffFromPublished.length === 0)}
              onClick={doPublish}>
              发布到 C 端
            </Button>
            {dirty ? (
              <Popconfirm title="撤销未保存改动"
                description="把素材配置恢复到上次「加载 / 保存成功」时的状态（只回退本页面编辑的草稿，不动服务端已保存的内容）。"
                okText="撤销" cancelText="取消" onConfirm={revert}>
                <Button size="small" icon={<Undo2 size={12} />}>撤销改动</Button>
              </Popconfirm>
            ) : null}
            {dirty ? <span className="text-xs text-amber-500">有未保存改动</span> : null}
          </>
        }
      />

      {invalidTotal > 0 && (
        <Alert type="error" showIcon
          message={`有 ${invalidTotal} 个素材路径在素材清单里找不到（C 端文件可能被删除或改过前缀）`}
          description={<div className="flex flex-col gap-2 text-xs">
            <span>
              存的是<b>路径字符串</b>，文件没了配置还在 —— 游戏里会表现为空白或裂图。
              失效项已在下方槽位里标红。
            </span>
            <div>
              <Popconfirm title="清理失效素材"
                description="从资源池移除所有失效路径；若「当前使用」失效，自动改用池内第一个有效候选。"
                okText="清理" cancelText="取消" onConfirm={cleanInvalid}>
                <Button size="small" danger icon={<Eraser size={12} />}>一键清理失效项</Button>
              </Popconfirm>
            </div>
          </div>} />
      )}

      {fetching ? (
        <div className="py-8 text-center"><Spin /></div>
      ) : !catalog.available ? (
        <Alert type="warning" showIcon
          message="拿不到素材清单，槽位无法下拉选择（仍可手工保存既有配置）"
          description={<span className="text-xs">
            {catalog.warning || "未知原因"}
            <br />清单由后端扫描 C 端素材目录得到：<code>{catalog.root || "（未返回）"}</code>。
            可用环境变量 <code>SPIRE_ASSET_ROOT</code> 指向 C 端 <code>public/spire</code> 的实际路径。
          </span>} />
      ) : (
        <Alert type="info" showIcon
          message={<span className="text-xs">
            素材清单来自 <code>{catalog.root}</code>（共 {catalog.total} 个文件
            {catalog.manifestVersion ? ` · 素材包 v${catalog.manifestVersion}` : ""}）。
            这里是**只读列举**：新增素材请把文件放进 C 端 <code>public/spire/</code> 并重新部署 C 端，刷新本页即可看到。
          </span>} />
      )}

      {/* 未配置槽位：默认收起，点标签可直接跳过去 —— 页面很长，"哪些还没配"必须能一眼看到 */}
      {!fetching && unconfigured.length > 0 && (
        <Card size="small" className="shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" type="text" onClick={() => setShowUnset((v) => !v)}>
              {showUnset ? "收起" : "展开"}
            </Button>
            <span className="text-xs font-medium">{unconfigured.length} / {slots.length} 个槽位未配置</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              留空＝C 端走内置默认（有内置图的显示「内置默认」，没有的自绘兜底）· 点击可跳到该槽位
            </span>
          </div>
          {showUnset && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unconfigured.map((s) => (
                <Tooltip key={s.key}
                  title={s.default ? `点击跳转 · 内置默认：${s.default}` : "点击跳转 · 无内置素材（C 端自绘兜底 / 留空）"}>
                  {/* 用 span 包一层：antd Tag 不保证透传 onClick */}
                  <span className="cursor-pointer" onClick={() => jumpToSlot(s.key)}>
                    <Tag className="!mr-0" color={s.default ? "default" : "orange"}>{s.label}</Tag>
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 清单拿不到时也要渲染槽位：下拉虽为空，但已存的配置仍可见、可恢复默认后保存 */}
      {!fetching && (
        <Card size="small" className="shadow-sm">
          <div className="flex flex-col gap-4">
            {SLOT_GROUPS.map((g) => {
            const groupSlots = slots.filter((s) => s.group === g.key)
            if (!groupSlots.length) return null
            return (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold">{g.label}</h3>
                  {g.wired
                    ? <Tag color="green">C 端已接入</Tag>
                    : <Tag color="orange">C 端尚未消费</Tag>}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{g.desc}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {groupSlots.map((s) => (
                    <SlotRow key={s.key} slot={s} catalog={catalog} invalid={invalidBySlot[s.key] || []} allSlots={slots} />
                  ))}
                </div>
              </div>
            )
            })}
          </div>
        </Card>
      )}

      <Alert type="info" showIcon
        message="如何扩展更多素材类型"
        description={<span className="text-xs">
          固定槽位在 <code>notelab-b/src/lib/spire-assets.ts</code> 的 <code>ASSET_SLOTS</code> 里加一行即出现在本页
          （key 一经发布不可改名；<code>suggest</code> 决定该类型的「推荐素材」，用于一键填充与下拉置顶）；
          <b>角色立绘</b>这组不走注册表，而是按运行时角色池自动展开（见 <code>slotsWithChars</code>），
          所以新建工坊角色会立刻多出一个 <code>char.&lt;id&gt;</code> 槽位。
          要真正生效还需 C 端 <code>notelab-c/lib/spire-assets.ts</code> 用同一个 key 取值。
          <b>敌人形象</b>这类槽位暂未开设：对象 id 清单只存在于 C 端引擎，需要先由后端提供一份镜像常量，否则会出现两份真相。
        </span>} />

      {/* 一键填充的确认弹窗：明确告诉运营会加什么、会不会换掉当前那张
          —— 原则是**只增不减**，已手工选中的图不会被推荐覆盖 */}
      <Modal open={fillOpen} onCancel={() => setFillOpen(false)} title="✨ 按推荐填充全部（只新增，不删除）"
        okText="填充" cancelText="取消" onOk={applyFillAll} maskClosable={false} width={560}>
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            已有候选与「当前使用」的那张都会保留，只把缺失的推荐素材补进池子。
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            {fillPlan.map((p) => (
              <div key={p.slot.key}
                className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs last:border-b-0 dark:border-zinc-800">
                <span className="font-medium">{p.slot.label}</span>
                <Tag className="!mr-0" color="default">{p.slot.key}</Tag>
                {p.add.length
                  ? <Tag className="!mr-0" color="blue">新增 {p.add.length} 个候选</Tag>
                  : <span className="text-zinc-400 dark:text-zinc-500">候选已齐全</span>}
                {p.curChanged
                  ? <Tag className="!mr-0" color="orange">当前使用改为 {p.nextCur.slice(p.nextCur.lastIndexOf("/") + 1)}</Tag>
                  : <span className="text-zinc-400 dark:text-zinc-500">当前使用不变</span>}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
