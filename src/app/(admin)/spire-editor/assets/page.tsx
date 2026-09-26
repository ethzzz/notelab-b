"use client"

// 爬塔工坊 · 素材资源配置
//
// 交互：每个槽位一个「候选下拉（可搜） + 实时预览 + 恢复默认」。
// 候选池来自后端扫盘接口 GET /api/spire-assets/catalog —— B 端浏览器读不到 C 端仓库，
// 所以清单只能由后端给（见 notelab-java SpireAssetController）。
//
// 存的是**路径字符串**（如 /games/spire/art/icon-normal.png），不搬文件；
// 真正的文件仍在 C 端 public/spire 下，与 C 端 basePath（/games）绑定。
import { useEffect, useMemo, useState } from "react"
import { Alert, Button, Select, Spin, Tag, Tooltip } from "antd"
import { RotateCcw } from "lucide-react"
import { apiJson } from "@/lib/api"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import {
  CATALOG_EMPTY, SLOT_GROUPS, configuredCount, sanitizeAssetMap, slotsWithChars,
  type AssetCatalog, type AssetGroup, type AssetItem, type AssetSlot,
} from "@/lib/spire-assets"

/** 下拉选项：按素材目录分组，标签优先用 manifest 里的中文名 */
function optionsOf(catalog: AssetCatalog, slot: AssetSlot) {
  const filter = slot.filter
  return catalog.groups
    .map((g: AssetGroup) => {
      const items = g.items.filter((it) => (filter ? filter(it) : it.kind === "image"))
      return {
        label: `${g.label}（${items.length}）`,
        options: items.map((it: AssetItem) => ({
          value: it.url,
          label: `${it.meta?.name ? it.meta.name + " · " : ""}${it.name}`,
          title: it.rel,
        })),
      }
    })
    .filter((g) => g.options.length > 0)
}

function SlotRow({ slot, catalog }: { slot: AssetSlot; catalog: AssetCatalog }) {
  const { assets, setAssets } = useSpire()
  const current = assets[slot.key] || ""
  const effective = current || slot.default
  const options = useMemo(() => optionsOf(catalog, slot), [catalog, slot])
  const [broken, setBroken] = useState(false)

  useEffect(() => setBroken(false), [effective])

  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      {/* 预览 */}
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        {effective && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={effective} alt="" className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-[10px] text-zinc-400">{effective ? "加载失败" : "无素材"}</span>
        )}
      </div>

      {/* 槽位信息 + 选择 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{slot.label}</span>
          <Tag className="!mr-0" color="default">{slot.key}</Tag>
          {current
            ? <Tag className="!mr-0" color="green">已配置</Tag>
            : <Tag className="!mr-0">内置默认</Tag>}
          <code className="truncate text-[10px] text-zinc-400 dark:text-zinc-500" title={effective || "（无）"}>
            {effective || "（无 — C 端走自绘兜底）"}
          </code>
        </div>

        <div className="flex items-center gap-2">
          <Select
            className="!w-96 max-w-full"
            size="small"
            showSearch
            allowClear
            value={current || undefined}
            placeholder={slot.default ? "留空 = 使用内置默认" : "留空 = 不配置（C 端兜底）"}
            optionFilterProp="label"
            onChange={(v) => setAssets((prev) => {
              const next = { ...prev }
              if (!v) delete next[slot.key]      // 清空即"恢复默认"：删键而不是存空串
              else next[slot.key] = v
              return next
            })}
            options={options}
            notFoundContent="素材清单里没有可选项"
          />
          {current && (
            <Tooltip title="删除该槽位配置，恢复内置默认">
              <Button size="small" icon={<RotateCcw size={12} />}
                onClick={() => setAssets((prev) => { const n = { ...prev }; delete n[slot.key]; return n })}>
                恢复默认
              </Button>
            </Tooltip>
          )}
        </div>

        {slot.hint && <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{slot.hint}</span>}
      </div>
    </div>
  )
}

export default function SpireAssetsPage() {
  const { assets, setAssets, busy, saveQuiet, dirty, loaded, charPool } = useSpire()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const done = configuredCount(assets, slots)

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="🧩 素材资源配置"
        hint={`共 ${slots.length} 个槽位，已配置 ${done} 个；改动需「保存」+「发布到 C 端」后玩家侧生效`}
        onSave={saveQuiet}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">有未保存改动</span> : null}
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

      <Alert type="info" showIcon
        message="如何扩展更多素材类型"
        description={<span className="text-xs">
          固定槽位在 <code>notelab-b/src/lib/spire-assets.ts</code> 的 <code>ASSET_SLOTS</code> 里加一行即出现在本页
          （key 一经发布不可改名）；<b>角色立绘</b>这组不走注册表，而是按运行时角色池自动展开（见 <code>slotsWithChars</code>），
          所以新建工坊角色会立刻多出一个 <code>char.&lt;id&gt;</code> 槽位。
          要真正生效还需 C 端 <code>notelab-c/lib/spire-assets.ts</code> 用同一个 key 取值。
          <b>敌人形象</b>这类槽位暂未开设：对象 id 清单只存在于 C 端引擎，需要先由后端提供一份镜像常量，否则会出现两份真相。
        </span>} />
    </div>
  )
}
