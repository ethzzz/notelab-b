// 爬塔素材资源 · 槽位注册表（B 端）
//
// 设计要点：槽位是**声明式**的，页面按这张表渲染，不用为每个槽位写一遍 UI。
// 加一类素材 = 在 ASSET_SLOTS 里加几行，不用改页面代码 —— 这是"配置类型之后再做拓展"的落点。
//
// 槽位的 key 是**跨端契约**：C 端 notelab-c/lib/spire-assets.ts 用同一批 key 取值，
// 因此 key 一旦发布就不能改名（会静默失配 → 回落默认，表现为"配置没生效"）。
// 命名约定：<类别>.<对象>[.<细分>]，如 node.enemy / link.straight / bg.spire.map / char.blade。
//
// default 字段 = **C 端当前硬编码的值**，页面用它显示"内置默认"并提供「恢复默认」（即删除该键）。
// 想确认 C 端现值，看 notelab-c/lib/spire-engine.ts 的 NODE_META 与 components/SpireMap.tsx。

/** 素材清单接口返回的一项（后端扫 C 端 public/spire 得到） */
export interface AssetItem {
  name: string
  rel: string
  url: string
  ext: string
  kind: "image" | "audio" | "other" | string
  bytes: number
  /** manifest.json 登记的元数据（name = 中文名，如「普通小怪」） */
  meta?: { id?: string; name?: string; kind?: string; layer?: string; accent?: string; notes?: string }
}

export interface AssetGroup {
  key: string
  dir: string
  label: string
  count: number
  items: AssetItem[]
}

export interface AssetCatalog {
  available: boolean
  root?: string
  urlPrefix?: string
  warning?: string
  manifestVersion?: string
  total: number
  groups: AssetGroup[]
}

/** 槽位分组（页面按此顺序与标题渲染） */
export interface SlotGroup {
  key: string
  label: string
  desc: string
  /** 该组在 C 端是否已真正生效；false 表示"已可配、但 C 端尚未消费" */
  wired: boolean
}

export const SLOT_GROUPS: SlotGroup[] = [
  {
    key: "node", label: "🗺️ 地图节点素材", wired: true,
    desc: "引擎里每个节点类型的整幅美术。C 端已无 basePath，路径挂在根路径（/spire/...）；留空则回落内置默认。",
  },
  {
    key: "link", label: "🔗 地图连线素材", wired: true,
    desc: "连线是「直弦贴图」：这张横向小径会沿弦长拉伸再按弦角旋转，故用横向且首尾可延展的图最合适。",
  },
  {
    key: "bg", label: "🖼️ 背景图素材", wired: true,
    desc: "铺在渐变底色之上的背景图。留空＝只用渐变（当前行为）。图片会被压在 UI 之下，建议选低对比、无强焦点的图。",
  },
  {
    key: "char", label: "🧙 角色立绘素材", wired: true,
    desc: "留空＝使用内置内联 SVG 形象。配置后该角色改用图片（透明底 PNG 效果最好）。",
  },
]

export interface AssetSlot {
  key: string
  group: string
  label: string
  hint?: string
  /** C 端当前硬编码的默认值；空串＝内置无此素材 */
  default: string
  /** 候选过滤：默认只列图片 */
  filter?: (it: AssetItem) => boolean
  /**
   * **推荐素材**判定：同一槽位可登记多个候选（资源池），这个谓词标出"按素材包归属应该属于本槽位"的那些。
   * 用途：①下拉里推荐项排在前面；②「填充推荐」一键把该类素材加进池子。
   * 不设 = 该槽位没有推荐（如背景图、角色立绘）。
   */
  suggest?: (it: AssetItem) => boolean
  /**
   * 推荐项里**排在最前**的命名前缀（决定「填充推荐」后默认使用的是哪一张）。
   * 不设时按 seriesOrder（基础款 → -2/-3 变体 → 无序号特殊款）排。
   * 例：node.enemy 同时收了 stone-skull 与 stone-empty，但"有敌人"的是骷髅石环，故 prefer: ["stone-skull"]。
   */
  prefer?: string[]
  /** 预览方式 */
  preview?: "image" | "none"
}

const onlyImages = (it: AssetItem) => it.kind === "image"
/** 只列 art/ 整图层的图（节点整图与连线都来自这里，含 art/dungeon/ 地牢元素包） */
const onlyArt = (it: AssetItem) => it.kind === "image" && it.rel.startsWith("art/")

/** 素材文件名（不含目录与扩展名） */
const baseName = (rel: string) => {
  const file = rel.slice(rel.lastIndexOf("/") + 1)
  const dot = file.lastIndexOf(".")
  return dot < 0 ? file : file.slice(0, dot)
}

/**
 * 地牢元素包（art/dungeon/）的归属判定：按文件名前缀圈定一类，可用 exclude 排除个别。
 * 素材包自带的 game-assets.json 已经按 boss/elite/normal/shop/rest/path 分好组，
 * 这里**不抄一份清单**，只按命名前缀归类 —— 加新素材只要沿用前缀就自动归入对应槽位。
 */
const dungeon = (prefixes: string[], exclude: string[] = []) => (it: AssetItem) => {
  if (!it.rel.startsWith("art/dungeon/")) return false
  const b = baseName(it.rel)
  if (exclude.some((e) => b.startsWith(e))) return false
  return prefixes.some((p) => b.startsWith(p))
}

export const ASSET_SLOTS: AssetSlot[] = [
  // ---------------- 地图节点（C 端 NODE_META.art，已接入） ----------------
  // suggest = 地牢元素包里**按素材包分组**属于该节点类型的那些；同类可登记多个，用时选一个。
  {
    key: "node.enemy", group: "node", label: "普通敌人", default: "/games/spire/art/icon-normal.png",
    filter: onlyArt, suggest: dungeon(["stone-skull", "stone-empty"]), prefer: ["stone-skull"],
  },
  {
    key: "node.elite", group: "node", label: "精英敌人", default: "/games/spire/art/icon-elite.png",
    filter: onlyArt, suggest: dungeon(["demon"], ["demon-boss"]),
  },
  {
    key: "node.boss", group: "node", label: "BOSS", default: "/games/spire/art/icon-boss.png",
    filter: onlyArt, suggest: dungeon(["demon-boss"]),
  },
  {
    key: "node.rest", group: "node", label: "补给营地", default: "/games/spire/art/icon-rest.png",
    filter: onlyArt, suggest: dungeon(["campfire"]),
  },
  {
    key: "node.shop", group: "node", label: "商店", default: "/games/spire/art/icon-shop.png",
    filter: onlyArt, suggest: dungeon(["merchant"]),
  },
  {
    key: "node.random", group: "node", label: "未知（未揭示）", default: "/games/spire/art/icon-random.png",
    filter: onlyArt, suggest: dungeon(["stone-skull", "stone-empty"]), prefer: ["stone-empty"],
  },
  {
    key: "node.event", group: "node", label: "未知事件", default: "",
    filter: onlyArt,
    suggest: dungeon(["stone-empty"]),
    hint: "内置**故意留空**：若指向与 node.random 相同的图，玩家无法区分「进去触发事件」与「进去才知道是什么」。配了图就会用图，不再走自绘圆盘兜底。",
  },

  // ---------------- 连线（SpireMap 的 LINK_ART，已接入） ----------------
  {
    key: "link.straight", group: "link", label: "直行连线", default: "/games/spire/art/link-straight.png",
    filter: onlyArt,
    suggest: dungeon(["path-bridge"]),
    hint: "建议横向、左右可无缝延展、上下透明渐隐的图（现用 165×24 的小径；地牢元素包的 path-bridge 是 622×220 的岩桥）。",
  },

  // ---------------- 背景图（C 端新增接入） ----------------
  {
    key: "bg.spire.map", group: "bg", label: "地图盘面背景", default: "",
    filter: onlyImages,
    hint: "铺在盘面渐变底色之上（z 序在连线与节点之下）。留空＝只用渐变。",
  },
  {
    key: "bg.spire.home", group: "bg", label: "爬塔首页背景", default: "",
    filter: onlyImages,
    hint: "爬塔入口 / 选角页背景。留空＝只用渐变。",
  },

  // ---------------- 角色立绘（C 端已接入，覆盖内联 SVG） ----------------
  // 下面是**内置 4 角色的兜底清单**：正常情况下本页会用 shop 页的运行时角色池
  // （slotsWithChars：工坊自定义角色 + 内置去重）覆盖这一组，好让自定义角色也能单独配立绘。
  // 角色池为空（内容还没加载完）时才退回这几条，避免角色组整块消失。
  { key: "char.blade", group: "char", label: "刃影（blade）", default: "", filter: onlyImages },
  { key: "char.guard", group: "char", label: "铁壁守卫（guard）", default: "", filter: onlyImages },
  { key: "char.mage", group: "char", label: "秘法编织者（mage）", default: "", filter: onlyImages },
  { key: "char.wuzhuge", group: "char", label: "武诸葛（wuzhuge）", default: "", filter: onlyImages },
]

/** 生成一个角色立绘槽位（key 约定 char.<角色 id>，与 C 端 charArtUrl 对应） */
export const charSlot = (id: string, name: string, custom = false): AssetSlot => ({
  key: `char.${id}`,
  group: "char",
  label: `${name}（${id}）${custom ? " · 自定义" : ""}`,
  default: "",
  filter: onlyImages,
})

/**
 * 本次渲染用的完整槽位表：非角色组照注册表，**角色组按运行时角色池展开**
 * （与「角色授权」页用同一份池子，避免两处角色清单不一致）。
 * 池子为空时退回注册表里的内置 4 条。
 */
export function slotsWithChars(chars: { id: string; name: string; custom: boolean }[]): AssetSlot[] {
  const rest = ASSET_SLOTS.filter((s) => s.group !== "char")
  const charSlots = chars.length
    ? chars.map((c) => charSlot(c.id, c.name || c.id, c.custom))
    : ASSET_SLOTS.filter((s) => s.group === "char")
  return [...rest, ...charSlots]
}

/** 槽位按 key 索引，便于页面与净化逻辑查表 */
export const SLOT_BY_KEY: Record<string, AssetSlot> =
  Object.fromEntries(ASSET_SLOTS.map((s) => [s.key, s]))

/**
 * 只保留可识别的 key（脏数据 / 改名残留一律丢弃），空值丢弃 = 恢复默认。
 * 识别规则：① 在注册表里；② `char.*` 前缀（**开放命名空间** —— 角色是运行时可增的，
 * 工坊新建一个角色就该能立刻配立绘，不能因为注册表里没有这一条就把值丢掉）。
 * 其余未知 key（比如已下线的槽位）会被清掉，防止页面上出现"已配置"却没人认识的幽灵行。
 */
export function sanitizeAssetMap(raw: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [k, v] of Object.entries(raw)) {
    if (!SLOT_BY_KEY[k] && !/^char\.[^.\s]+$/.test(k)) continue
    if (typeof v !== "string") continue
    const val = v.trim()
    if (!val) continue
    out[k] = val
  }
  return out
}

/**
 * 资源池净化：键的识别规则与 sanitizeAssetMap 完全一致（注册表内 或 `char.*` 开放命名空间），
 * 值是**去重保序**的非空字符串数组；空数组丢弃（= 该槽位没有池子，只用 assets 那一个）。
 * 未知 key 丢弃 —— 否则页面会出现"池子里有东西却没人认"的幽灵行。
 */
export function sanitizeAssetPool(
  raw: Record<string, unknown> | undefined,
  limit = 50,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [k, v] of Object.entries(raw)) {
    if (!SLOT_BY_KEY[k] && !/^char\.[^.\s]+$/.test(k)) continue
    if (!Array.isArray(v)) continue
    const list: string[] = []
    for (const x of v) {
      if (typeof x !== "string") continue
      const p = x.trim()
      if (!p || list.includes(p)) continue
      list.push(p)
      if (list.length >= limit) break
    }
    if (list.length) out[k] = list
  }
  return out
}

/** 槽位取值：池子优先（取其第一个），没有池子时回落到"当前使用的那一个"，再没有才用内置默认 */
export function effectiveAsset(
  key: string,
  pool: Record<string, string[]>,
  current: Record<string, string>,
  fallback = "",
): string {
  const p = pool[key]
  if (Array.isArray(p) && p.length && p[0]) return p[0]
  const c = current[key]
  if (typeof c === "string" && c.trim()) return c.trim()
  return fallback
}

/** 已配置数 / 总槽位（页面顶部进度用）；传 slots 时按动态槽位表算分母 */
export function configuredCount(map: Record<string, string>, slots: AssetSlot[] = ASSET_SLOTS): number {
  return slots.filter((s) => map[s.key]).length
}

/** 池子里的素材总数（页面顶部进度用；同一素材被多个槽位引用会重复计数，这里就是要看"登记量"） */
export function pooledCount(pool: Record<string, string[]>, slots: AssetSlot[] = ASSET_SLOTS): number {
  return slots.reduce((n, s) => n + (pool[s.key]?.length || 0), 0)
}

/**
 * 素材包内的展示顺序：同一系列的「基础款」排在最前，带 -2/-3 后缀的变体按序号跟进，
 * 无序号的特殊款（如 merchant-tomb）排最后。
 * —— 这样「填充推荐」后默认选中的就是最能代表该类的一张，而不是字母序里的 campfire-2。
 */
function seriesOrder(rel: string): [number, number, string] {
  const b = baseName(rel)
  const m = /-(\d+)$/.exec(b)
  if (!m) return [0, Number.MAX_SAFE_INTEGER, b]
  return [1, Number(m[1]), b]
}

/** 按 seriesOrder 排序的便捷比较器（供下拉分组内的排序复用） */
export const cmpSeriesOrder = (a: AssetItem, b: AssetItem): number => {
  const x = seriesOrder(a.rel)
  const y = seriesOrder(b.rel)
  return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0)
}

/**
 * 地牢元素包里的**系列**（同一个美术元素的若干变体算一个系列）→ 中文名。
 * 只用来做下拉分组与文案展示；判定素材属于哪个槽位仍走 suggest（前缀圈定），两者互不替代。
 */
const SERIES_LABELS: Record<string, string> = {
  "stone-skull": "骷髅石环",
  "stone-empty": "空石环",
  "demon": "恶魔",
  "demon-boss": "恶魔 BOSS",
  "campfire": "营火",
  "merchant": "商人",
  "path-bridge": "岩桥",
}

/**
 * 取素材所属的系列 key：先去掉变体序号（-2/-3），再从**最长前缀**往回退着查表。
 * 例：merchant-tomb → merchant（商人）；demon-boss-2 → demon-boss（恶魔 BOSS，不会被误并进「恶魔」）。
 * 查不到就退回第一段文件名（新素材包沿用前缀命名时也能自动成组）。
 */
export function seriesKey(rel: string): string {
  let b = baseName(rel).replace(/-\d+$/, "")
  while (b.includes("-")) {
    if (SERIES_LABELS[b]) return b
    b = b.slice(0, b.lastIndexOf("-"))
  }
  return b
}

/** 系列 key → 展示名（查表不到就用 key 本身，保证永远不会显示成空白） */
export const seriesLabel = (key: string): string => SERIES_LABELS[key] || key

/** 某槽位在素材清单里的**推荐项**（按 suggest 判定，没有 suggest 则为空数组） */
export function suggestedItems(slot: AssetSlot, catalog: AssetCatalog): AssetItem[] {
  if (!slot.suggest) return []
  const prefer = slot.prefer || []
  const rank = (it: AssetItem) => (prefer.some((p) => baseName(it.rel).startsWith(p)) ? 0 : 1)
  const out: AssetItem[] = []
  for (const g of catalog.groups) {
    for (const it of g.items) {
      if (slot.filter && !slot.filter(it)) continue
      if (slot.suggest(it)) out.push(it)
    }
  }
  return out.sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    const x = seriesOrder(a.rel)
    const y = seriesOrder(b.rel)
    return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0)
  })
}

/**
 * 槽位对素材**宽高比**的期望（w/h），用于选图时提前预警 —— 图能加载 ≠ 铺上去好看。
 * 返回 null = 该槽位没有硬性比例要求（背景图是铺满裁切，什么比例都能用）。
 */
export function expectedRatio(slot: AssetSlot): { min: number; max: number; why: string } | null {
  switch (slot.group) {
    // 连线是「沿弦长拉伸再旋转」的：必须横向、左右可延展，太方会在拉伸后糊成一块
    case "link": return { min: 2.2, max: 100, why: "连线贴图会沿弦长拉伸：需要横向细长的图（现用 165×24），太方会糊成一团" }
    // 节点是整幅美术铺进方形节点框
    case "node": return { min: 0.6, max: 1.6, why: "节点整图等比铺进方形节点框：太扁/太高会明显留白或被裁" }
    // 立绘是竖构图
    case "char": return { min: 0.35, max: 1.2, why: "角色立绘是竖构图：横图会被压扁、露出大片空白" }
    default: return null
  }
}

export const CATALOG_EMPTY: AssetCatalog = { available: false, total: 0, groups: [] }
