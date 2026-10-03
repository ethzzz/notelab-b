"use client"

// 摸金行动 · 共享状态容器
//
// 为什么要有它：items / containers / tables / maps / balance 是**同一份文档**
// （后端 POST /api/loot-content 整包覆盖写，漏带任何切片都会把它清空）。
// 所以「加载 → 编辑 → 保存 → 发布」集中在一处，子页只做自己那一片的编辑 UI。
//
// 脏标记用「整份文档序列化后与基线比对」，而不是让每个 setter 手动置位 ——
// 新增切片时不需要记得改标记逻辑，漏置位不会发生。
import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react"
import { toast } from "@/lib/toast"
import { apiJson, postJson } from "@/lib/api"
import { loadLootContent, saveLootContent } from "@/lib/loot-content"
import {
  sanitizeItem, sanitizeContainer, sanitizeTable, sanitizeMap, sanitizeBalance,
  blankBalance,
  type ItemDef, type ContainerDef, type TableDef, type MapDef, type Balance, type LootDoc,
} from "./model"

interface LootStore extends LootDoc {
  loaded: boolean
  busy: boolean
  pubBusy: boolean
  /** ui_config 是否存在 loot_published 快照 */
  published: boolean | null
  /** 自上次加载/保存后是否有未落库的改动 */
  dirty: boolean
  /** 内置平衡默认（后端只读下发，供「全局参数」页展示/恢复默认） */
  baseBalance: Balance

  setItems: (v: ItemDef[] | ((l: ItemDef[]) => ItemDef[])) => void
  setContainers: (v: ContainerDef[] | ((l: ContainerDef[]) => ContainerDef[])) => void
  setTables: (v: TableDef[] | ((l: TableDef[]) => TableDef[])) => void
  setMaps: (v: MapDef[] | ((l: MapDef[]) => MapDef[])) => void
  setBalance: (v: Balance | ((l: Balance) => Balance)) => void

  revert: () => void
  save: () => Promise<void>
  publish: () => Promise<void>
  unpublish: () => Promise<void>
}

const Ctx = createContext<LootStore | null>(null)

/** 子页取用共享状态；必须在 loot-editor/layout.tsx 的 Provider 内 */
export function useLoot(): LootStore {
  const v = useContext(Ctx)
  if (!v) throw new Error("useLoot 必须在 LootStoreProvider 内使用（见 loot-editor/layout.tsx）")
  return v
}

export function LootStoreProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemDef[]>([])
  const [containers, setContainers] = useState<ContainerDef[]>([])
  const [tables, setTables] = useState<TableDef[]>([])
  const [maps, setMaps] = useState<MapDef[]>([])
  const [balance, setBalance] = useState<Balance>(blankBalance())

  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pubBusy, setPubBusy] = useState(false)
  const [published, setPublished] = useState<boolean | null>(null)
  const [baseBalance, setBaseBalance] = useState<Balance>(blankBalance())

  const [baseline, setBaseline] = useState<string>("")
  const baselineDoc = useRef<LootDoc | null>(null)
  const freezeBaseline = useCallback((d: LootDoc) => {
    baselineDoc.current = JSON.parse(JSON.stringify(d)) as LootDoc
    setBaseline(JSON.stringify(d))
  }, [])

  const docRef = useRef<LootDoc>({ items, containers, tables, maps, balance })
  docRef.current = { items, containers, tables, maps, balance }

  useEffect(() => {
    let alive = true
    apiJson("/api/loot-content/published")
      .then((j) => { if (alive) setPublished(!!j.published) })
      .catch(() => {})
    loadLootContent().then((c) => {
      if (!alive) return
      const it = c.items.map(sanitizeItem).filter(Boolean) as ItemDef[]
      const ct = c.containers.map(sanitizeContainer).filter(Boolean) as ContainerDef[]
      const tb = c.tables.map(sanitizeTable).filter(Boolean) as TableDef[]
      const mp = c.maps.map(sanitizeMap).filter(Boolean) as MapDef[]
      const ba = sanitizeBalance(c.balance)
      const doc: LootDoc = { items: it, containers: ct, tables: tb, maps: mp, balance: ba }
      setItems(it); setContainers(ct); setTables(tb); setMaps(mp); setBalance(ba)
      setBaseBalance(sanitizeBalance(c.baseBalance))
      freezeBaseline(doc)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [freezeBaseline])

  const dirty = useMemo(
    () => loaded && JSON.stringify(docRef.current) !== baseline,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, baseline, items, containers, tables, maps, balance],
  )

  /** 整包提交（一定是全量，绝不只提交当前页那一片） */
  const commit = useCallback(async (): Promise<boolean> => {
    const d = docRef.current
    try {
      await saveLootContent({
        items: d.items, containers: d.containers, tables: d.tables, maps: d.maps, balance: d.balance,
      })
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || e}`)
      return false
    }
    freezeBaseline(d)
    return true
  }, [freezeBaseline])

  /** 撤销全部未保存改动：只还原前端内存草稿，不动服务端 */
  const revert = useCallback(() => {
    const b = baselineDoc.current
    if (!b) return
    setItems(b.items); setContainers(b.containers); setTables(b.tables); setMaps(b.maps); setBalance(b.balance)
    toast.success("已撤销未保存的改动")
  }, [])

  const save = useCallback(async () => {
    setBusy(true)
    if (await commit()) toast.success("已保存")
    setBusy(false)
  }, [commit])

  const publish = useCallback(async () => {
    setPubBusy(true)
    try {
      // 发布的是**服务端已落库**的内容，所以先确保本地改动已提交，否则会发布旧版
      if (!(await commit())) { setPubBusy(false); return }
      await postJson("/api/loot-content/publish", {})
      setPublished(true)
      toast.success("已发布到 C 端（摸金行动内容即时生效）")
    } catch (e: any) {
      toast.error(`发布失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }, [commit])

  const unpublish = useCallback(async () => {
    setPubBusy(true)
    try {
      await postJson("/api/loot-content/unpublish", {})
      setPublished(false)
      toast.success("已下架，C 端回落为内置默认内容")
    } catch (e: any) {
      toast.error(`下架失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }, [])

  const store: LootStore = {
    items, containers, tables, maps, balance,
    loaded, busy, pubBusy, published, dirty, baseBalance,
    setItems, setContainers, setTables, setMaps, setBalance,
    revert, save, publish, unpublish,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
