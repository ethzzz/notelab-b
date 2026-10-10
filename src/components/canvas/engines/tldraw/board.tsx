"use client"
// tldraw 引擎 —— 协作画布。
//
// 文档状态完全由 useSync 提供的远端 store 承载（连协作服务），本地不做任何持久化；
// 断线重连由 @tldraw/sync 自己处理。
//
// ⚠️ 只在本组件里 import tldraw 的 CSS，并且只允许在浏览器渲染 —— canvas-host 用
//    next/dynamic ssr:false 引入（tldraw 依赖 window，SSR 会直接炸）。这也把 ~1.5MB
//    的体积挡在画布页之外，其它 admin 页面与另一套引擎都不受影响。
//
// ⚠️ tldraw SDK 自 4.0 起为**商业授权**（source available，非 MIT/Apache）：
//    - 开发环境不需要 key（HTTP 页面 / localhost/127.x / NODE_ENV≠production，满足任一即可）
//    - **生产环境必须提供有效 license key**，否则 SDK 先渲染约 5 秒、然后停止渲染编辑器
//      （DOM 里只剩一个隐藏的 license 占位），表现为白屏 —— 不是代码 bug，是授权校验。
//    非商业项目可申请免费的 **Hobby License**：https://tldraw.dev/pricing
//    （需保留 "made with tldraw" 水印；提交后官方一般先发 14 天临时 key，正式 key 随后）
//    拿到 key 后写进服务器 `/root/Notelab/notelab-b/.env.production` 的
//    `NEXT_PUBLIC_TLDRAW_LICENSE_KEY=...`，然后重新 `npm run build`（NEXT_PUBLIC_ 前缀在
//    **构建期内联**，改完必须重新构建，光 restart 不生效）。
import { useEffect, useMemo, useRef } from "react"
import { Tldraw, type Editor } from "tldraw"
import { useSync } from "@tldraw/sync"
import { atom } from "@tldraw/state"
import { UserRecordType, createUserId } from "@tldraw/tlschema"
import type { TLUser, TLUserStore } from "@tldraw/tlschema"
import "tldraw/tldraw.css"
import { collabUri, loadCanvasMe } from "@/lib/canvas"
import { assets } from "./assets"

const LICENSE_KEY = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY || ""

/**
 * tldraw 的协作者色板（照抄 `@tldraw/editor` 的 USER_COLORS）。
 * 按账户 id 取模挑一个 —— **稳定**比随机重要：同一个人每次进来、以及每个人看到他，
 * 颜色都一致，不会「一刷新就换色」。
 */
const TL_USER_COLORS = [
  "#FF802B", "#EC5E41", "#F2555A", "#F04F88", "#E34BA9", "#BD54C6",
  "#9D5BD2", "#7B66DC", "#02B1CC", "#11B3A3", "#39B178", "#55B467",
]
const tlUserColor = (uid: number) => TL_USER_COLORS[Math.abs(Math.trunc(uid)) % TL_USER_COLORS.length]

/**
 * tldraw 的「我是谁」——**不传这个，别人的界面上就没有你的名字**。
 *
 * ⚠️ 为什么必须自己传：`useSync` 不传 `users` 时用 tldraw 的默认实现，它从
 * **localStorage 用户偏好**里读，而那份数据的 name 默认是**空字符串**
 * （`@tldraw/editor` 的 `defaultUserPreferences.name = ""`），于是：
 * 别人的光标看得见、「某人正在编辑这个形状」的彩色框也看得见，**就是没有名字**。
 * 名字与颜色是随 presence 广播出去的（`getDefaultUserPresence` 取 user.name / user.color），
 * 所以把会话身份喂进 `currentUser` 就够了，服务端无需改动。
 *
 * id 用**账户 id**（不是用户名）：颜色与归属都按它算，改个用户名不该换个人。
 * 身份是异步取的，先给 null、拿到再 set —— tldraw 内部订阅这个 signal，会自己补上。
 */
const currentUserAtom = atom<null | TLUser>("notelabCanvasCurrentUser", null)
const userStore: TLUserStore = { currentUser: currentUserAtom }

let currentUserRequested = false
function ensureCurrentUser() {
  if (currentUserRequested) return
  currentUserRequested = true
  void loadCanvasMe().then((me) => {
    if (!me) return
    currentUserAtom.set(UserRecordType.create({
      id: createUserId(String(me.id)),
      name: me.username || `账户#${me.id}`,
      color: tlUserColor(me.id),
    }))
  })
}

/**
 * @param readonly 画布里的 view 权限 → 编辑器只读。
 *   ⚠️ 界面层（本处）与服务端**双保险**：服务端那条 WS 连接已带 `isReadonly`，
 *   即使这里被绕过（改前端 / 直连 WS），写请求照样会被同步协议拒掉。
 */
export default function Board({ roomId, readonly = false }: { roomId: string; readonly?: boolean }) {
  const uri = useMemo(() => collabUri("tldraw", roomId), [roomId])
  // useSync：建立到协作服务的 WebSocket，并把远端文档当作 store 的真相来源。
  // users 决定 presence 里的 userName/color —— 别人看到的光标与「正在编辑」指示框靠它显示名字。
  const store = useSync({ uri, assets, users: userStore })
  const editorRef = useRef<Editor | null>(null)

  // 拉一次自己的身份（幂等，模块级缓存）
  useEffect(() => { ensureCurrentUser() }, [])

  // onMount 只在挂载时跑一次；权限是异步取到的（getCanvas 回来才知道），
  // 所以还要这个 effect 兜住「先挂载、后知道只读」的时序。
  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: readonly })
  }, [readonly])

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <Tldraw
        store={store}
        licenseKey={LICENSE_KEY || undefined}
        onMount={(editor) => {
          editorRef.current = editor
          editor.updateInstanceState({ isReadonly: readonly })
        }}
      />
    </div>
  )
}
