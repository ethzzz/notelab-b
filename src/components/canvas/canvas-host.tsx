"use client"
// 协作画布 —— **唯一**的引擎分派点。
//
// ⚠️ 本文件是两套引擎在代码上的唯一交汇处，刻意做得极薄：只做「按名字挑一个组件」，
//    不含任何引擎逻辑。新增引擎 = 在 ENGINES 里加一行，既不碰既有引擎实现、也不碰页面。
//
// 两套引擎各自 dynamic import：浏览器只下载当前画布用到的那一套
// （tldraw ~1.5MB / excalidraw ~2.9MB），互不拖累。
import dynamic from "next/dynamic"
import type { ComponentType } from "react"
import { Spin } from "antd"
import { asEngine, ENGINE_META, type CanvasEngine } from "@/lib/canvas"

const loadingFor = (name: string) => () => (
  <div className="absolute inset-0 grid place-items-center rounded-xl border border-black/10 bg-white">
    <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
      <Spin />
      <span>正在加载 {name} 画布引擎…</span>
    </div>
  </div>
)

const ENGINES: Record<CanvasEngine, ComponentType<{ roomId: string }>> = {
  tldraw: dynamic(() => import("./engines/tldraw/board"), {
    ssr: false,
    loading: loadingFor(ENGINE_META.tldraw.label),
  }),
  excalidraw: dynamic(() => import("./engines/excalidraw/board"), {
    ssr: false,
    loading: loadingFor(ENGINE_META.excalidraw.label),
  }),
}

export default function CanvasHost({ engine, roomId }: { engine: unknown; roomId: string }) {
  const key = asEngine(engine)
  const Board = ENGINES[key] as ComponentType<{ roomId: string }> | undefined
  if (!Board) {
    // 理论上到不了这里（asEngine 一定收敛到枚举内的值），留着是为了将来加引擎时
    // 万一注册表漏登记，能看出一条明确的信息而不是白屏。
    return (
      <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-amber-300 bg-amber-50">
        <div className="text-center text-sm text-amber-700">
          未知的画布引擎 <span className="font-mono">{String(engine)}</span>
          <div className="mt-1 text-xs text-amber-600">请检查 canvas-host.tsx 的 ENGINES 注册表</div>
        </div>
      </div>
    )
  }
  return <Board roomId={roomId} />
}
