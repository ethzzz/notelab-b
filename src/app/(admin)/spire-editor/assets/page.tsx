"use client"

// 爬塔工坊 · 素材资源配置
//
// 交互形态（本次重构）：**按素材种类分 Tab → 每类一个表格列表 → 点行内「配置」在弹窗里编辑**。
// 之前是「所有槽位纵向铺开 + 每个槽位内联资源池卡片」，页面极长且同类之间要来回滚动才能比对。
//
// 分工不变：assetPool[key] = 该类型的候选池；assets[key] = 当前生效的那个（必须属于池子）。
// 换图只是在池子里改指向，不用重新找素材路径 —— 这就是「同类多个、用时选一个」。
//
// 候选池来自后端扫盘接口 GET /api/spire-assets/catalog —— B 端浏览器读不到 C 端仓库，
// 所以清单只能由后端给（见 notelab-java SpireAssetController）。
//
// 存的是**路径字符串**（如 /spire/art/dungeon/stone-skull.svg），不搬文件；
// 真正的文件仍在 C 端 public/spire 下。
//
// 运营视角的几条防线（缺一条就会出"后台配好了、游戏里没变"这类事故）：
// ① 失效路径检测 —— 存的是字符串，C 端删文件/改前缀后配置照样留着，页面必须能发现并清理；
// ② 草稿 vs 已发布对比 —— 保存与发布是两步，只保存不发布玩家看不到；
// ③ 一键填充不得覆盖手工挑的候选 —— 只增不减，改「当前使用」前先确认；
// ④ 异常态可一键修复 —— 「当前值不在池中」可在弹窗里并入池子。
// ⑤ 大图预览 + 素材说明 + 宽高比预警（缩略图上根本分不出骷髅石环与空石环）；
// ⑥ 下拉按「系列」分组，而不是 24 张平铺；
// ⑦ 跨槽位复用：池子里任意一张可复制到其它槽位（只加候选，不动目标当前使用的那张）；
// ⑧ 撤销改动：回退到上次加载/保存成功的状态；
// ⑨ 「只看未配置」过滤 —— 页面很长，"哪些还没配"要能一眼筛出来。
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Button, Card, Modal, Popconfirm, Tag, Tabs, Tooltip } from "antd"
import { Eraser, Undo2, Upload, Wand2 } from "lucide-react"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import {
  CATALOG_EMPTY, SLOT_GROUPS, configuredCount, pooledCount, suggestedItems,
  sanitizeAssetMap, sanitizeAssetPool, slotsWithChars,
  type AssetCatalog, type AssetSlot,
} from "@/lib/spire-assets"
import { buildAssetIndex } from "./_components/shared"
import SlotTable from "./_components/SlotTable"
import SlotConfigModal from "./_components/SlotConfigModal"
import AssetPreviewModal from "./_components/AssetPreviewModal"
import CopyToSlotsModal from "./_components/CopyToSlotsModal"
import type { UsedBy } from "./_components/PoolOrderList"

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

  const index = useMemo(() => buildAssetIndex(catalog), [catalog])

  const done = configuredCount(assets, slots)
  const pooled = pooledCount(assetPool, slots)

  // ---------- 弹窗状态（一次只操作一个目标，故都是单数 state） ----------
  /** 正在配置的槽位 */
  const [editing, setEditing] = useState<AssetSlot | null>(null)
  /** 大图预览目标（url + 所在槽位，槽位决定宽高比期望） */
  const [preview, setPreview] = useState<{ url: string; slot: AssetSlot } | null>(null)
  /** 跨槽位复制的来源素材 */
  const [copyUrl, setCopyUrl] = useState<string | null>(null)

  /** 反向索引：编辑中的槽位里，每张图**还被哪些别的槽位**引用（改/删前知道牵连范围） */
  const editingUsedBy = useMemo(() => {
    const m = new Map<string, UsedBy[]>()
    if (!editing) return m
    for (const url of assetPool[editing.key] || []) {
      const hits: UsedBy[] = []
      for (const s of slots) {
        if (s.key === editing.key) continue
        const cur = assets[s.key] === url
        const inPool = (assetPool[s.key] || []).includes(url)
        if (cur || inPool) hits.push({ key: s.key, label: s.label, current: cur })
      }
      if (hits.length) m.set(url, hits)
    }
    return m
  }, [editing, assetPool, assets, slots])

  /** 弹窗提交：写回共享草稿（pool 与 current 一起改，保证 current 始终落在池内） */
  const applyConfig = (next: { pool: string[]; current: string }) => {
    if (!editing) return
    const key = editing.key
    setAssetPool((prev) => {
      const n = { ...prev }
      if (next.pool.length) n[key] = next.pool
      else delete n[key]
      return n
    })
    setAssets((prev) => {
      const n = { ...prev }
      if (next.current) n[key] = next.current
      else delete n[key]
      return n
    })
    setEditing(null)
  }

  const resetDefault = (slot: AssetSlot) => {
    setAssets((prev) => { const n = { ...prev }; delete n[slot.key]; return n })
    toast.success(`「${slot.label}」已恢复内置默认（还需「保存」+「发布到 C 端」）`)
  }

  const copyToSlots = (url: string, keys: string[]) => {
    setAssetPool((prev) => {
      const n = { ...prev }
      for (const k of keys) {
        const cur = n[k] || []
        if (!cur.includes(url)) n[k] = [...cur, url]
      }
      return n
    })
    toast.success(`已复制到 ${keys.length} 个槽位的资源池（还需「保存」+「发布到 C 端」）`)
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
  const unpublishedKeys = useMemo(() => {
    const s = new Set<string>()
    if (!pub) return s
    for (const slot of slots) {
      if ((assets[slot.key] || "") !== (pub.assets[slot.key] || "")) s.add(slot.key)
    }
    return s
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

  // ---------- 按素材种类分 Tab（node / link / bg / char） ----------
  const tabItems = SLOT_GROUPS.map((g) => {
    const groupSlots = slots.filter((s) => s.group === g.key)
    if (!groupSlots.length) return null
    const unset = groupSlots.filter((s) => !assets[s.key]).length
    const bad = groupSlots.reduce((n, s) => n + (invalidBySlot[s.key]?.length || 0), 0)
    return {
      key: g.key,
      label: (
        <span className="flex items-center gap-1">
          {g.label}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{groupSlots.length}</span>
          {unset > 0 && <Tag color="orange" className="!mr-0 !text-[10px]">{unset} 未配</Tag>}
          {bad > 0 && <Tag color="red" className="!mr-0 !text-[10px]">{bad} 失效</Tag>}
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {g.wired ? <Tag color="green" className="!mr-0">C 端已接入</Tag> : <Tag color="orange" className="!mr-0">C 端尚未消费</Tag>}
            <span>{g.desc}</span>
          </div>
          <SlotTable
            slots={groupSlots}
            index={index}
            assets={assets}
            assetPool={assetPool}
            invalidBySlot={invalidBySlot}
            unpublishedKeys={unpublishedKeys}
            onConfig={setEditing}
            onPreview={(url, slot) => setPreview({ url, slot })}
            onResetDefault={resetDefault}
          />
        </div>
      ),
    }
  }).filter(Boolean) as { key: string; label: React.ReactNode; children: React.ReactNode }[]

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
            {pub && pub.published && unpublishedKeys.size > 0 && (
              <Tooltip title={`与玩家当前看到的版本相比，有 ${unpublishedKeys.size} 个槽位不同`}>
                <Tag color="orange" className="!mr-0">{unpublishedKeys.size} 个槽位未发布</Tag>
              </Tooltip>
            )}
            {pub && !pub.published && <Tag color="red" className="!mr-0">尚未发布</Tag>}
            <Button size="small" type="primary" icon={<Upload size={12} />} loading={pubBusy}
              disabled={!pub || (pub.published && unpublishedKeys.size === 0)}
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
          </>
        }
      />

      {invalidTotal > 0 && (
        <Alert type="error" showIcon
          message={`有 ${invalidTotal} 个素材路径在素材清单里找不到（C 端文件可能被删除或改过前缀）`}
          description={<div className="flex flex-col gap-2 text-xs">
            <span>
              存的是<b>路径字符串</b>，文件没了配置还在 —— 游戏里会表现为空白或裂图。
              失效项已在对应 Tab 的表格行里标红。
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
        <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">正在读取素材清单…</div>
      ) : !catalog.available ? (
        <Alert type="warning" showIcon
          message="拿不到素材清单，配置弹窗里将无候选可选项（仍可手工保存既有配置）"
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

      {/* 清单拿不到时也要渲染槽位：弹窗里虽无候选，但已存的配置仍可见、可恢复默认后保存 */}
      {!fetching && (
        <Card size="small" className="shadow-sm">
          <Tabs defaultActiveKey={SLOT_GROUPS[0]?.key} items={tabItems} />
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

      {/* 单槽位配置弹窗 */}
      <SlotConfigModal
        slot={editing}
        pool={editing ? assetPool[editing.key] || [] : []}
        current={editing ? assets[editing.key] || "" : ""}
        catalog={catalog}
        index={index}
        invalid={editing ? invalidBySlot[editing.key] || [] : []}
        usedByOf={editingUsedBy}
        onCancel={() => setEditing(null)}
        onApply={applyConfig}
        onPreview={(url) => setPreview({ url, slot: editing! })}
        onCopyRequest={setCopyUrl}
      />

      {preview && (
        <AssetPreviewModal url={preview.url} item={index.itemOf(preview.url)} slot={preview.slot}
          onClose={() => setPreview(null)} />
      )}

      {copyUrl && editing && (
        <CopyToSlotsModal url={copyUrl} from={editing.key} slots={slots}
          onClose={() => setCopyUrl(null)}
          onPick={(keys) => { copyToSlots(copyUrl, keys); setCopyUrl(null) }} />
      )}
    </div>
  )
}
