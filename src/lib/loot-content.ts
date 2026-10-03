// 摸金行动内容工坊：五切片（items / containers / tables / maps / balance）的服务端存取。
// 存 ui_config JSON 的 "loot" 键，整包覆盖写（POST /api/loot-content）。
//
// ⚠️ baseBalance 是后端只读常量（懒 seed 的默认值），提交时不回传。
import { apiJson, postJson } from "./api"

export interface LootCustomContent {
  items: any[]
  containers: any[]
  tables: any[]
  maps: any[]
  balance?: Record<string, any>
  /** 只读：后端下发的内置平衡默认值，提交时剔除 */
  baseBalance?: Record<string, any>
}

export async function loadLootContent(): Promise<LootCustomContent> {
  try {
    const d = await apiJson("/api/loot-content")
    return {
      items: Array.isArray(d.items) ? d.items : [],
      containers: Array.isArray(d.containers) ? d.containers : [],
      tables: Array.isArray(d.tables) ? d.tables : [],
      maps: Array.isArray(d.maps) ? d.maps : [],
      balance: d.balance && typeof d.balance === "object" ? d.balance : {},
      baseBalance: d.baseBalance && typeof d.baseBalance === "object" ? d.baseBalance : {},
    }
  } catch {
    return { items: [], containers: [], tables: [], maps: [], balance: {}, baseBalance: {} }
  }
}

export function saveLootContent(c: LootCustomContent) {
  const { baseBalance: _drop, ...body } = c
  return postJson("/api/loot-content", {
    ...body,
    items: Array.isArray(c.items) ? c.items : [],
    containers: Array.isArray(c.containers) ? c.containers : [],
    tables: Array.isArray(c.tables) ? c.tables : [],
    maps: Array.isArray(c.maps) ? c.maps : [],
    balance: c.balance && typeof c.balance === "object" ? c.balance : {},
  })
}
