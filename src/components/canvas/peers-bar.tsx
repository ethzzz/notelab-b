"use client"
// 画布「谁在线」列表 —— 引擎无关的**展示层**（只收数据、不关心数据从哪来）。
//
// 当前由 tldraw 侧喂数据（engines/tldraw/people-menu.tsx 用 editor.getCollaborators()）。
// excalidraw 将来要同样的列表，把自建 presence 的 peers 映射成 CanvasPeer 即可，不用改这里。
//
// 交互（按需求）：最多显示 max 个；单个 = **圆形色底 + 用户名**；
// 超出折叠成「+N ▾」，鼠标移入时在**下方**展开完整名单。
//
// ⚠️ 配色用 tldraw 的 CSS 变量（--tl-color-panel / --tl-color-text / --tl-color-divider / --tl-color-low）
//    而不是 Tailwind 的固定色：这块 UI 长在 tldraw 的界面里，跟着它的亮/暗主题走才不会一半亮一半暗。
//    （这些变量定义在 .tl-container 上，组件在其内部渲染，能直接继承。）
import { ChevronDown } from "lucide-react"

export type CanvasPeer = {
  /** 稳定唯一键（tldraw 用 userId，excalidraw 可用 peerId） */
  id: string
  name: string
  /** 该用户的专属色（6 位 hex），用作圆形底色 */
  color: string
  isMe?: boolean
}

const MAX_VISIBLE = 3

/** 用户色 + 透明度后缀（颜色是 6 位 hex，直接接两位 alpha）；不是 hex 就原样返回 */
const tint = (hex: string, alpha = "22") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex)

function Avatar({ peer, size = 18 }: { peer: CanvasPeer; size?: number }) {
  const initial = (peer.name || "?").trim().slice(0, 1).toUpperCase()
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: peer.color, fontSize: Math.round(size * 0.5) }}
    >
      {initial}
    </span>
  )
}

export default function PeersBar({ peers, max = MAX_VISIBLE }: { peers: CanvasPeer[]; max?: number }) {
  if (!peers.length) return null
  const head = peers.slice(0, max)
  const rest = peers.slice(max)

  return (
    // hover 触发区是**整条**列表，不是只有那个「+N」—— 前者好用得多
    //（「+N」本身只有三十来像素宽，指着它悬停很别扭）
    //
    // 🔴 `pointer-events-auto` 是**必须的**，不是修饰：tldraw 的 UI 层
    //   （.tlui-layout）整体是 `pointer-events: none`（把指针让给画布），
    //   它自家的控件逐个开 auto，我们这块自定义 DOM 不开就收不到任何鼠标事件——
    //   表现为**视觉看得到、鼠标悬停却毫无反应**（hover 展开永远不触发）。
    //   实测：不开时该坐标 elementFromPoint 命中的是 .tl-background。
    //
    // ⚠️ data-* 是给自动化验收用的锚点（DOM 里查文本会随名字变，锚点不会）
    <div className="group pointer-events-auto relative flex items-center gap-1" data-peers-bar="">
      {head.map((p) => (
        <span
          key={p.id}
          data-peer-chip={p.isMe ? "me" : p.id}
          title={p.isMe ? `${p.name}（我）` : p.name}
          className="inline-flex max-w-[120px] items-center gap-1.5 rounded-full py-[2px] pl-[2px] pr-2"
          style={{ background: tint(p.color) }}
        >
          <Avatar peer={p} />
          <span className="truncate text-[11px] leading-4" style={{ color: "var(--tl-color-text)" }}>
            {p.name}
          </span>
        </span>
      ))}

      {rest.length > 0 && (
        <>
          <span
            data-peer-overflow=""
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[11px] font-medium"
            style={{ background: "var(--tl-color-low)", color: "var(--tl-color-text)" }}
          >
            +{rest.length}
            <ChevronDown size={11} />
          </span>

          {/* hover 展开。⚠️ pt-1.5 是「桥」：没有它，鼠标从 chip 往下移到面板途中会离开 hover 区，
              面板当场消失、根本点不到。invisible/opacity 只用透明度做过渡（不用 display，否则没有动画） */}
          <div className="invisible absolute right-0 top-full z-50 pt-1.5 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
            <ul
              data-peers-list=""
              className="max-h-64 min-w-[150px] overflow-auto rounded-lg border p-1 shadow-lg"
              style={{ background: "var(--tl-color-panel)", borderColor: "var(--tl-color-divider)" }}
            >
              {peers.map((p) => (
                <li
                  key={p.id}
                  data-peer-item=""
                  className="flex items-center gap-2 rounded px-1.5 py-1"
                >
                  <Avatar peer={p} />
                  <span className="truncate text-[11px]" style={{ color: "var(--tl-color-text)" }}>
                    {p.name}
                    {p.isMe ? "（我）" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
