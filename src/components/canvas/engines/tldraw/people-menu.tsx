"use client"
// 右上角「谁在线」—— 覆盖 tldraw 自带的 PeopleMenu。
//
// 默认那个是「首字母圆点 + 点一下弹 popover」，这里按需求换成：
// **圆形色底 + 用户名**（最多 3 个），超出折叠成「+N ▾」，鼠标移入在下方展开完整名单。
// 位置沿用 tldraw 的 SharePanel（就在右上角），不用自己摆浮层。
//
// 数据来源：`editor.getCollaborators()` —— 所有人（含不在当前页的）的最新 presence 记录；
// 自己那份要单独取（getCollaborators 只给**别人**），颜色/名字来自我们喂给 useSync 的 userStore。
import { useMemo } from "react"
import { useEditor } from "@tldraw/editor"
import { useValue } from "@tldraw/state-react"
import PeersBar, { type CanvasPeer } from "@/components/canvas/peers-bar"

/** 序列化用的原始形状（字段顺序固定，好做字符串比较） */
type RawPeer = { id: string; name: string; color: string; me?: boolean }

/** userId 有两种写法（`26` 与 `user:26`），比对身份前先归一 */
const norm = (v: unknown) => String(v ?? "").replace(/^user:/, "")

export default function CanvasPeopleMenu() {
  const editor = useEditor()

  // ⚠️ 依赖用 **JSON 字符串**而不是数组：presence 每次鼠标移动都会更新，
  //    直接依赖数组会让整块 UI 跟着光标高频重渲染；序列化后只在
  //    「谁 / 叫什么 / 什么颜色」真的变了才变。别人按 id 排序，免得 tldraw 内部顺序一变就重排。
  const signature = useValue(
    "canvas-peers",
    () => {
      const meId = norm(editor.user.getId())
      return JSON.stringify([
        { id: meId, name: editor.user.getName(), color: editor.user.getColor(), me: true },
        ...editor
          .getCollaborators()
          // 去重：万一 presence 里也带上了自己（id 写法可能不同，两边都归一后比）
          .filter((c) => norm(c.userId) !== meId)
          .map((c) => ({ id: norm(c.userId), name: c.userName, color: c.color }))
          .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
      ])
    },
    [editor],
  )

  const peers = useMemo<CanvasPeer[]>(() => {
    try {
      return (JSON.parse(signature) as RawPeer[]).map((u) => ({
        id: u.me ? `me:${u.id}` : u.id,
        name: u.name || (u.me ? "我" : "匿名"),
        color: u.color || "#9CA3AF",
        isMe: !!u.me,
      }))
    } catch {
      return []   // 解析失败最多这块 UI 空着，不该把整个画布带崩
    }
  }, [signature])

  return <PeersBar peers={peers} />
}
