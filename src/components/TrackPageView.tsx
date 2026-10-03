"use client"

// B 端埋点接线：初始化 SDK + 自动上报 page_view（PRD-P0 §4.2 B 端清单第一项）。
// 挂根 layout 覆盖所有后台路由；幂等（initTrack/wireFlush 只执行一次）。
// ⚠️ LLM 依赖：无。

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { autoPageView, initTrack, wireFlush } from "@/lib/track"

export default function TrackPageView() {
  const pathname = usePathname()

  useEffect(() => {
    initTrack()
    wireFlush()
  }, [])

  useEffect(() => {
    if (pathname) autoPageView()
  }, [pathname])

  return null
}
