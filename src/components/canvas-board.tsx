"use client"
// tldraw 协作画布：文档状态由 useSync 提供的远端 store 承载（连协作服务），本地不做任何持久化。
//
// ⚠️ 务必只在本组件里 import tldraw 的 CSS，并只在浏览器渲染 —— 页面侧用 next/dynamic ssr:false
//    引入（tldraw 依赖 window，SSR 会直接炸）。这样也把 ~1.5MB 的体积挡在画布页之外，
//    其它 admin 页面不受影响。
import { useMemo } from "react"
import { Tldraw, type TLAssetStore } from "tldraw"
import { useSync } from "@tldraw/sync"
import "tldraw/tldraw.css"
import { collabUri } from "@/lib/canvas"

/**
 * 图片上限：上传的图片会以 **data URL** 形式存进 tldraw 文档本身。
 * 这样不用为几张插图引入对象存储，图片也能随文档同步给协作者、随 SQLite 快照持久化；
 * 代价是快照体积 = 图片体积，所以必须限量。
 */
const MAX_IMAGE_BYTES = 1_000_000

const assets: TLAssetStore = {
  async upload(_asset, file) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`图片过大（${Math.round(file.size / 1024)}KB，上限 1000KB）`)
    }
    // ⚠️ tldraw 5.x 的 upload 要返回 { src }，不是裸字符串（返回 string 会被类型拒绝）
    const src = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error("图片读取失败"))
      fr.readAsDataURL(file)
    })
    return { src }
  },
  resolve(asset) {
    return asset.props.src
  },
}

export default function CanvasBoard({ roomId }: { roomId: string }) {
  const uri = useMemo(() => collabUri(roomId), [roomId])
  // useSync：建立到协作服务的 WebSocket，并把远端文档当作 store 的真相来源
  const store = useSync({ uri, assets })

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <Tldraw store={store} />
    </div>
  )
}
