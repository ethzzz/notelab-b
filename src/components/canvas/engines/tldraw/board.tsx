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
import { useMemo } from "react"
import { Tldraw } from "tldraw"
import { useSync } from "@tldraw/sync"
import "tldraw/tldraw.css"
import { collabUri } from "@/lib/canvas"
import { assets } from "./assets"

const LICENSE_KEY = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY || ""

export default function Board({ roomId }: { roomId: string }) {
  const uri = useMemo(() => collabUri("tldraw", roomId), [roomId])
  // useSync：建立到协作服务的 WebSocket，并把远端文档当作 store 的真相来源
  const store = useSync({ uri, assets })

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <Tldraw store={store} licenseKey={LICENSE_KEY || undefined} />
    </div>
  )
}
