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
// 存的是**路径字符串**（如 /games/spire/art/icon-normal.png），不搬文件；
// 真正的文件仍在 C 端 public/spire 下，与 C 端 basePath（/games）绑定。
import { useEffect, useMemo, useState } from "react"
import { Alert, Button, Card, Select, Spin, Tag, Tooltip } from "antd"
import { RotateCcw, Sparkles, Wand2 } from "lucide-react"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import {
  CATALOG_EMPTY, SLOT_GROUPS, configuredCount, pooledCount, suggestedItems,
  sanitizeAssetMap, sanitizeAssetPool, slotsWithChars,
  type AssetCatalog, type AssetGroup, type AssetItem, type AssetSlot,
} from "@/lib/spire-assets"

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
    groups.push({ label: `${g.label}（${items.length}）`, options: items.map(opt) })
  }
  return groups
}

/** 资源池里的一张素材：缩略图 + 名称 + 「设为当前 / 移出」 */
function PoolCard({ url, name, active, onUse, onRemove }: {
  url: string
  name: string
  active: boolean
  onUse: () => void
  onRemove: () => void
}) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  return (
    <div
      className={`flex w-[104px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 transition ${active
        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"}`}
      onClick={onUse}
      title={`点击设为当前使用：${url}`}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-zinc-50 dark:bg-zinc-900">
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-[10px] text-zinc-400">加载失败</span>
        )}
      </div>
      <span className="line-clamp-1 w-full text-center text-[11px] leading-tight">{name}</span>
      <div className="flex items-center gap-1">
        {active
          ? <Tag color="blue" className="!mr-0 !text-[10px]">当前使用</Tag>
          : <Button size="small" type="text" className="!h-5 !px-1 !text-[10px]" onClick={(e) => { e.stopPropagation(); onUse() }}>用这个</Button>}
        <Button size="small" type="text" danger className="!h-5 !px-1 !text-[10px]"
          onClick={(e) => { e.stopPropagation(); onRemove() }}>移出</Button>
      </div>
    </div>
  )
}

function SlotRow({ slot, catalog }: { slot: AssetSlot; catalog: AssetCatalog }) {
  const { assets, setAssets, assetPool, setAssetPool } = useSpire()
  const pool = assetPool[slot.key] || []
  const active = assets[slot.key] || ""
  const effective = active || slot.default

  const options = useMemo(() => optionsOf(catalog, slot), [catalog, slot])
  const recommended = useMemo(() => suggestedItems(slot, catalog), [catalog, slot])

  /** 素材路径 → 显示名（manifest 中文名优先，否则文件名） */
  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of catalog.groups) {
      for (const it of g.items) m.set(it.url, it.meta?.name || it.name)
    }
    return (url: string) => m.get(url) || url.slice(url.lastIndexOf("/") + 1)
  }, [catalog])

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

  /** 填充推荐：把该类型的推荐素材并入池子，并把第一个设为当前使用 */
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
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">{slot.label}</span>
        <Tag className="!mr-0" color="default">{slot.key}</Tag>
        {active
          ? <Tag className="!mr-0" color="green">已选：{nameOf(active)}</Tag>
          : <Tag className="!mr-0">内置默认</Tag>}
        <span className="text-xs text-zinc-400">池中 {pool.length} 个</span>
        {notInPool && <Tag className="!mr-0" color="orange">当前值不在池中</Tag>}
        <code className="truncate text-[10px] text-zinc-400 dark:text-zinc-500" title={effective || "（无）"}>
          {effective || "（无 — C 端走自绘兜底）"}
        </code>
      </div>

      {/* 资源池：横向缩略图，点一下即用 */}
      {pool.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pool.map((url) => (
            <PoolCard key={url} url={url} name={nameOf(url)} active={url === active}
              onUse={() => useThis(url)} onRemove={() => removeFromPool(url)} />
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
    </div>
  )
}

export default function SpireAssetsPage() {
  const { assets, setAssets, assetPool, setAssetPool, busy, saveQuiet, dirty, loaded, charPool } = useSpire()
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

  /** 全部按推荐填充：只动有推荐项的槽位，避免把背景图/角色立绘这类无推荐的槽位清空 */
  const fillAllRecommended = () => {
    let n = 0
    for (const s of slots) {
      const rec = suggestedItems(s, catalog).map((r) => r.url)
      if (!rec.length) continue
      setAssetPool((prev) => ({ ...prev, [s.key]: rec }))
      setAssets((prev) => ({ ...prev, [s.key]: rec[0] }))
      n++
    }
    if (n) toast.success(`已按推荐填充 ${n} 个槽位（还需「保存」+「发布到 C 端」才对玩家生效）`)
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
            <Button size="small" icon={<Wand2 size={12} />} disabled={fetching || !catalog.available}
              onClick={fillAllRecommended}>
              按推荐填充全部
            </Button>
            {dirty ? <span className="text-xs text-amber-500">有未保存改动</span> : null}
          </>
        }
      />

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
                  {groupSlots.map((s) => <SlotRow key={s.key} slot={s} catalog={catalog} />)}
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
    </div>
  )
}
