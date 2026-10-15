// 仪表盘图表的配色与坐标轴样式：**一份色板，明暗两套中性色**。
//
// 为什么单独一个文件：图表颜色散落在各页面里，迟早会出现「这张图的灰和那张图的灰不一样」。
// 色板取自站内已有的 Tailwind 色阶（主色 indigo-500 就是 AntdProvider 的 colorPrimary #6366f1），
// 所以图表和卡片、按钮本来就是同一个色系，不需要额外"调成品牌色"。
//
// ⚠️ 明暗两套只差分三样：坐标轴文字、网格线、tooltip 底板。
// 系列色（PALETTE）**明暗共用** —— 深色背景下 indigo-500 依然清晰，
// 反而是给暗色单独调浅会让两套图的观感对不上。

export type ChartMode = "light" | "dark"

/** 系列色板：indigo（主色）→ violet → cyan → amber → emerald → rose，与站内色阶同源 */
export const PALETTE = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e"]

/** 图表容器统一高度（同一行的图等高，视觉上才齐） */
export const CHART_HEIGHT = 268

export function axisColors(mode: ChartMode) {
  return mode === "dark"
    ? { text: "#a1a1aa", line: "#3f3f46", split: "rgba(63,63,70,0.55)", tooltipBg: "#27272a", tooltipBorder: "#3f3f46" }
    : { text: "#71717a", line: "#e4e4e7", split: "rgba(228,228,231,0.9)", tooltipBg: "#ffffff", tooltipBorder: "#e4e4e7" }
}

/** 通用 tooltip 皮肤：白底/深灰底 + 细边 + 小阴影，跟 antd 的 Tooltip 观感一致 */
export function tooltipStyle(mode: ChartMode) {
  const c = axisColors(mode)
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: mode === "dark" ? "#e4e4e7" : "#3f3f46", fontSize: 12 },
    extraCssText: "border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,0.10);",
  }
}

/** 网格：左侧留白给 3~4 位数的 y 轴刻度，右边留一点避免末点贴边 */
export function gridStyle() {
  return { left: 8, right: 16, top: 28, bottom: 4, containLabel: true }
}

/** x 轴（类目）：日期只显示 月-日，14 个标签在窄屏会自动隔一个显示 */
export function categoryAxis(mode: ChartMode, days: string[]) {
  const c = axisColors(mode)
  return {
    type: "category" as const,
    data: days,
    boundaryGap: false,
    axisLine: { lineStyle: { color: c.line } },
    axisTick: { show: false },
    axisLabel: { color: c.text, fontSize: 11, formatter: (v: string) => v.slice(5) },
  }
}

/** y 轴（数值）：只留横向网格线，轴线不画（ECharts 默认的四边框架太重） */
export function valueAxis(mode: ChartMode) {
  const c = axisColors(mode)
  return {
    type: "value" as const,
    minInterval: 1,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: c.text, fontSize: 11 },
    splitLine: { lineStyle: { color: c.split, type: "dashed" as const } },
  }
}

/** 图例：放在右上角，与标题同一行，不占额外高度 */
export function legendStyle(mode: ChartMode) {
  return {
    top: 0,
    right: 0,
    itemWidth: 8,
    itemHeight: 8,
    icon: "circle",
    textStyle: { color: axisColors(mode).text, fontSize: 12 },
  }
}
