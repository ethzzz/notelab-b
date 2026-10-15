"use client"
// ECharts 容器：只管实例生命周期（init / setOption / resize / dispose），不关心画什么。
// 所有图表走这一个壳，是为了把「尺寸自适应」和「卸载清理」这两件容易漏的事收敛到一处。
import { useEffect, useRef } from "react"
import * as echarts from "echarts/core"
import { BarChart, LineChart, PieChart } from "echarts/charts"
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import type { EChartsCoreOption } from "echarts/core"

// 按需注册：只引仪表盘用到的三类图 + 三个组件 + Canvas 渲染器。
// ⚠️ 不要图省事改成 `import * as echarts from "echarts"` —— 那是整包（含地图/3D/所有图表类型），
// 体积是这里的数倍，而 B 端每多几百 KB 都要在服务器上多花构建时间。
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

export default function Chart({
  option,
  height = 268,
  empty = false,
  emptyText = "暂无数据",
}: {
  option: EChartsCoreOption
  height?: number
  empty?: boolean
  emptyText?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const instRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (empty || !boxRef.current) return
    const inst = echarts.init(boxRef.current)
    instRef.current = inst
    // 用 ResizeObserver 而不是 window.resize：侧边栏折叠、父容器变宽这类
    // 「窗口没变但容器变了」的情况 window 上收不到，图会一直按旧宽度画（右侧被裁掉一截）。
    const ro = new ResizeObserver(() => inst.resize())
    ro.observe(boxRef.current)
    return () => {
      ro.disconnect()
      inst.dispose()   // 不 dispose 会在切页后留下 canvas 与监听，反复进出仪表盘直接内存涨上去
      instRef.current = null
    }
  }, [empty])

  useEffect(() => {
    // notMerge=true：整份替换。否则上一份 series 的残留项会留在图上（例如换主题后多出一条旧线）
    instRef.current?.setOption(option, true)
  }, [option])

  if (empty) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
        style={{ height }}
      >
        {emptyText}
      </div>
    )
  }

  return <div ref={boxRef} style={{ height, width: "100%" }} />
}
