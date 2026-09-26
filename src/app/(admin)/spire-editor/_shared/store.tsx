"use client"

// 爬塔工坊 · 共享状态容器
//
// 为什么要有它：拆成多个子页后，`cards / characters / skills / charAccess / assets / maps`
// 仍然是**同一份文档**（后端 POST /api/spire-content 是整包覆盖写，漏带任何一个切片都会把它清空）。
// 所以「加载 → 编辑 → 保存 → 发布」必须集中在一处，子页只做自己那一片的编辑 UI。
//
// 脏标记用「整份文档序列化后与基线比对」实现，而不是让每个 setter 手动置位 ——
// 新增切片时不需要记得改标记逻辑，漏置位不会发生。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { apiJson, postJson } from "@/lib/api"
import {
  loadSpireContent, saveSpireContent,
  type SpireAssetMap, type SpireMapDoc, type SpireBaseChar,
} from "@/lib/spire-content"
import {
  CARDS, applyCustomContent, sanitizeCard, sanitizeCharacter,
  type CardDef, type CharacterDef,
} from "@/lib/spire-engine"
import { cleanSkill, type SkillTpl } from "./model"
import { allCharPool, type CGroup, type PoolChar } from "./access"

/** 一份待落库的完整文档 */
interface Doc {
  cards: CardDef[]
  chars: CharacterDef[]
  skills: SkillTpl[]
  charAccess: Record<string, string[]>
  assets: SpireAssetMap
  maps: SpireMapDoc
}

/** 稳定序列化：charAccess / assets 的键序无关紧要，排序后再比，避免"没改也显示未保存" */
function fingerprint(d: Doc): string {
  const sorted = (o: Record<string, any>) =>
    Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return JSON.stringify({
    cards: d.cards, characters: d.chars, skills: d.skills,
    charAccess: sorted(d.charAccess), assets: sorted(d.assets),
    maps: d.maps,
  })
}

interface SpireStore extends Doc {
  loaded: boolean
  busy: boolean
  pubBusy: boolean
  /** ui_config 顶层是否存在 spire_published 快照 */
  published: boolean | null
  /** 自上次加载/保存后是否有未落库的改动 */
  dirty: boolean
  /** 内置基础角色（后端只读下发） */
  baseChars: SpireBaseChar[]
  /** C 端用户组 */
  groups: CGroup[]
  /** 全量可选角色池 = 工坊自定义 + 内置（去重） */
  charPool: PoolChar[]

  setCards: (v: CardDef[] | ((l: CardDef[]) => CardDef[])) => void
  setChars: (v: CharacterDef[] | ((l: CharacterDef[]) => CharacterDef[])) => void
  setSkills: (v: SkillTpl[] | ((l: SkillTpl[]) => SkillTpl[])) => void
  setCharAccess: (v: Record<string, string[]> | ((l: Record<string, string[]>) => Record<string, string[]>)) => void
  setAssets: (v: SpireAssetMap | ((l: SpireAssetMap) => SpireAssetMap)) => void
  setMaps: (v: SpireMapDoc | ((l: SpireMapDoc) => SpireMapDoc)) => void

  /** 保存并应用（本地引擎立即生效，供卡面/角色预览） */
  save: () => Promise<void>
  /** 仅保存（不刷本地引擎预览），供素材/地图页用；返回是否成功 */
  saveQuiet: () => Promise<boolean>
  publish: () => Promise<void>
  unpublish: () => Promise<void>
}

const Ctx = createContext<SpireStore | null>(null)

/** 子页取用共享状态；必须在 spire-editor/layout.tsx 的 Provider 内 */
export function useSpire(): SpireStore {
  const v = useContext(Ctx)
  if (!v) throw new Error("useSpire 必须在 SpireStoreProvider 内使用（见 spire-editor/layout.tsx）")
  return v
}

export function SpireStoreProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<CardDef[]>([])
  const [chars, setChars] = useState<CharacterDef[]>([])
  const [skills, setSkills] = useState<SkillTpl[]>([])
  const [charAccess, setCharAccess] = useState<Record<string, string[]>>({})
  const [assets, setAssets] = useState<SpireAssetMap>({})
  const [maps, setMaps] = useState<SpireMapDoc>({ packs: [] })

  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pubBusy, setPubBusy] = useState(false)
  const [published, setPublished] = useState<boolean | null>(null)
  const [baseChars, setBaseChars] = useState<SpireBaseChar[]>([])
  const [groups, setGroups] = useState<CGroup[]>([])

  /** 最近一次「已落库」状态的指纹；加载完成与每次保存成功后刷新 */
  const [baseline, setBaseline] = useState<string>("")
  // 用 ref 取当前文档做序列化，避免把 baseline 依赖进每个 setter
  const docRef = useRef<Doc>({ cards, chars, skills, charAccess, assets, maps })
  docRef.current = { cards, chars, skills, charAccess, assets, maps }

  useEffect(() => {
    let alive = true
    apiJson("/api/ui-config")
      .then((j) => { if (alive) setPublished(!!j.config?.spire_published) })
      .catch(() => {})
    // 角色授权要用的 C 端用户组（B 端登录才可读，失败不阻塞工坊主流程）
    apiJson("/api/c-admin/groups")
      .then((j) => {
        if (!alive) return
        setGroups((j.items || []).filter((g: any) => g && typeof g.code === "string"))
      })
      .catch(() => {})
    loadSpireContent().then((c) => {
      if (!alive) return
      const sc = c.cards.map(sanitizeCard).filter(Boolean) as CardDef[]
      const sh = c.characters.map((r) => sanitizeCharacter(r, CARDS)).filter(Boolean) as CharacterDef[]
      const sk = c.skills.map(cleanSkill).filter(Boolean) as SkillTpl[]
      const doc: Doc = {
        cards: sc, chars: sh, skills: sk,
        charAccess: c.charAccess || {}, assets: c.assets || {},
        maps: c.maps || { packs: [] },
      }
      setCards(sc); setChars(sh); setSkills(sk)
      setCharAccess(doc.charAccess); setAssets(doc.assets); setMaps(doc.maps)
      setBaseChars(c.baseCharacters || [])
      // 把自定义内容注册进本地引擎，卡面/角色预览才和游戏内一致
      applyCustomContent(sc, sh)
      setBaseline(fingerprint(doc))
      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  const dirty = useMemo(
    () => loaded && fingerprint(docRef.current) !== baseline,
    // docRef.current 的每次渲染赋值不会触发 memo 重算，所以把各切片列进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, baseline, cards, chars, skills, charAccess, assets, maps],
  )

  /** 整包提交（一定是全量，绝不只提交当前页那一片） */
  const commit = useCallback(async (silent: boolean): Promise<boolean> => {
    const d = docRef.current
    try {
      await saveSpireContent({
        cards: d.cards, characters: d.chars, skills: d.skills,
        charAccess: d.charAccess, assets: d.assets, maps: d.maps,
      })
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || e}`)
      return false
    }
    if (!silent) applyCustomContent(d.cards, d.chars)
    setBaseline(fingerprint(d))
    return true
  }, [])

  const save = useCallback(async () => {
    setBusy(true)
    if (await commit(false)) toast.success("已保存并应用到游戏")
    setBusy(false)
  }, [commit])

  const saveQuiet = useCallback(async () => {
    setBusy(true)
    const ok = await commit(true)
    if (ok) toast.success("已保存")
    setBusy(false)
    return ok
  }, [commit])

  /** 发布：把当前工坊内容整体快照到 C 端（POST /api/spire-content/publish） */
  const publish = useCallback(async () => {
    setPubBusy(true)
    try {
      // 发布的是**服务端已落库**的内容，所以先确保本地改动已提交，否则会发布旧版
      if (!(await commit(true))) { setPubBusy(false); return }
      await postJson("/api/spire-content/publish", {})
      setPublished(true)
      toast.success("已发布到 C 端（爬塔自定义内容即时生效）")
    } catch (e: any) {
      toast.error(`发布失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }, [commit])

  /** 下架：移除 C 端已发布快照（POST /api/spire-content/unpublish），C 端回落内置内容 */
  const unpublish = useCallback(async () => {
    setPubBusy(true)
    try {
      await postJson("/api/spire-content/unpublish", {})
      setPublished(false)
      toast.success("已下架，C 端回落为内置内容")
    } catch (e: any) {
      toast.error(`下架失败：${e?.message || e}`)
    }
    setPubBusy(false)
  }, [])

  const charPool = useMemo(() => allCharPool(baseChars, chars), [baseChars, chars])

  const store: SpireStore = {
    cards, chars, skills, charAccess, assets, maps,
    loaded, busy, pubBusy, published, dirty, baseChars, groups, charPool,
    setCards, setChars, setSkills, setCharAccess, setAssets, setMaps,
    save, saveQuiet, publish, unpublish,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
