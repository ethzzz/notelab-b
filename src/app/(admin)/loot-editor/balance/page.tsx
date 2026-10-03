"use client"

// 摸金行动 · 全局参数（balance）+ EV 校验 + 平衡模拟器
//
// 两块东西分工不同，别混着看：
//   · EV 校验面板：**解析公式**（确定性的期望值），用来卡保存 —— 超 evRejectRatio 直接拒绝。
//   · 平衡模拟器：**抽样**（真实引擎跑 N 局），用来证明"配置权重真的按说的那样出"，
//     并给解析公式做交叉验证（两者差 > 0.3× 就说明公式或实现有偏差）。
//   · 建议区间 [1.5, 3.5] 是**内容设计目标**（PRD 验收），不是保存阈值；
//     保存阈值是 evWarnRatio / evRejectRatio 两个参数（默认 3.5 / 10.0）——
//     warn 取设计上限（超了才提示），reject 取 10× 门槛（崩到那量级才拒绝保存）。
import { useMemo, useState } from "react"
import { InputNumber, Button, Card, Form, Tag, Table, Select, Alert } from "antd"
import { Play, RotateCcw } from "lucide-react"
import { toast } from "@/lib/toast"
import { useLoot } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import { evalMap, sanitizeBalance, type Balance, type MapEv } from "../_shared/model"
import { simulateMap, type SimReport } from "../_shared/sim"

/** 布局规范：PRD 给的设计目标区间 */
const BAND: [number, number] = [1.5, 3.5]

export default function LootBalancePage() {
  const { balance, setBalance, baseBalance, maps, containers, tables, items, busy, dirty, save } = useLoot()

  const evs = useMemo(
    () => maps.map((m) => evalMap(m, containers, tables, items, balance)),
    [maps, containers, tables, items, balance],
  )

  const [runs, setRuns] = useState(10_000)
  const [simming, setSimming] = useState(false)
  const [reports, setReports] = useState<SimReport[] | null>(null)

  // 保存守卫（EV 超阈值拒绝 / 偏高警告）在 _shared/store 的 commit 里 —— 那是唯一的写入口，
  // 从「地图配置」页保存也拦得住。这里只管把校验结果画出来。
  const doSave = () => save()

  const resetDefault = () => { setBalance(sanitizeBalance(baseBalance)); toast.info("已恢复为内置默认参数") }

  /**
   * 抽样。同步跑会卡住主线程（10k 局 × 30+ 槽 ≈ 数十万次抽取），
   * 所以先让出一帧把「跑」的状态画出来，再算。
   */
  const runSim = async () => {
    setSimming(true)
    setReports(null)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const doc = { items, containers, tables, maps, balance }
      const out = maps.map((m) => simulateMap(doc, m, { runs }))
      setReports(out)
      const bad = out.filter((r) => r.maxDelta > 0.015 || r.p <= 0.05)
      if (bad.length) toast.warning(`分布检验未通过：${bad.map((b) => b.mapName).join("、")}`)
      else toast.success(`${runs.toLocaleString()} 局跑完，分布检验通过`)
    } catch (e: any) {
      toast.error(`模拟失败：${e?.message || e}`)
    }
    setSimming(false)
  }

  const num = (k: keyof Balance, label: string, min: number, max: number, step = 1, tip?: string) => (
    <Form.Item label={<span title={tip}>{label}</span>} className="!mb-0">
      <InputNumber min={min} max={max} step={step} className="!w-full" value={balance[k]}
        onChange={(v) => setBalance((b) => ({ ...b, [k]: v ?? b[k] } as Balance))} />
    </Form.Item>
  )

  const evColumns = [
    { title: "地图", dataIndex: "name", render: (v: string, e: MapEv) => `${e.name}（${e.mapId}）` },
    { title: "全清毛收益", dataIndex: "grossAll", width: 120, render: (v: number) => <span className="text-zinc-400">💰 {v}</span>, },
    { title: "可带走毛收益", dataIndex: "gross", width: 130, render: (v: number) => `💰 ${v}` },
    { title: "EV 倍率", dataIndex: "ratio", width: 100, render: (v: number) => <b>{v.toFixed(2)}×</b> },
    { title: "吃满背包需风险", dataIndex: "riskNeeded", width: 140, render: (v: number, e: MapEv) => (
      <span className={e.riskOk ? "text-zinc-600 dark:text-zinc-300" : "text-rose-500"}>
        {v} / {e.riskLimit}{e.riskOk ? "" : "（超上限）"}
      </span>
    ) },
    { title: "判定", dataIndex: "level", width: 150, render: (lv: MapEv["level"], e: MapEv) => {
      const tag = lv === "reject" ? <Tag color="red">超标（拒绝保存）</Tag>
        : lv === "warn" ? <Tag color="orange">偏高</Tag> : <Tag color="green">正常</Tag>
      const inBand = e.ratio >= BAND[0] && e.ratio <= BAND[1]
      return <span className="flex flex-wrap items-center gap-1">
        {tag}
        {!inBand && <Tag color="volcano">出设计区间 [{BAND[0]}, {BAND[1]}]</Tag>}
      </span>
    } },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="⚖️ 全局参数"
        hint="回收率 / 撤离率 / 背包 / 救济 / 撤离读条 / EV 阈值；保存发布后 C 端即时采用"
        onSave={doSave} saving={busy}
        extra={(<>
          {dirty && <span className="text-xs text-amber-500">保存后才会写入服务端</span>}
          <Button icon={<RotateCcw size={14} />} onClick={resetDefault}>恢复默认</Button>
        </>)}
      />

      <Card size="small" className="shadow-sm" title="EV 校验（期望收益 ÷ 门槛）">
        <Table size="small" rowKey="mapId" columns={evColumns as any} dataSource={evs} pagination={false}
          locale={{ emptyText: "暂无地图，去「地图配置」页新建" }} />
        <div className="mt-2 text-xs leading-relaxed text-zinc-400">
          「全清毛收益」把地图上所有槽位都算进去，但玩家只背得动 <b>{balance.backpackCap}</b> 格 ——
          判断经济要看「<b>可带走毛收益</b>」那一列（按单格期望值高的容器优先装）。
          <br />
          设计目标区间 [{BAND[0]}, {BAND[1]}]；保存守卫：&gt; {balance.evWarnRatio}× 警告、&gt; {balance.evRejectRatio}× 拒绝保存。
        </div>
      </Card>

      <Card size="small" className="shadow-sm"
        title="平衡模拟器（在真实抽取逻辑上跑 N 局）"
        extra={
          <div className="flex items-center gap-2">
            <Select value={runs} className="!w-28"
              onChange={(v) => { if (typeof v === "number") setRuns(v) }}
              options={[{ value: 1000, label: "1,000 局" }, { value: 10000, label: "10,000 局" }, { value: 50000, label: "50,000 局" }]} />
            <Button type="primary" icon={<Play size={14} />} loading={simming} onClick={runSim}>跑模拟</Button>
          </div>
        }>
        {!reports ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            还没跑过。点「跑模拟」验证：各稀有度实测频率是否等于配置权重（卡方 p &gt; 0.05、偏差 ≤ ±1.5%），
            以及模拟 EV 与上面解析 EV 是否对得上。
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map((r) => {
              const ev = evs.find((e) => e.mapId === r.mapId)
              const distOk = r.maxDelta <= 0.015 && r.p > 0.05
              const evGap = ev ? Math.abs(ev.ratio - r.ratioWithRate) : 0
              return (
                <div key={r.mapId} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    🗺️ {r.mapName}（{r.mapId}）
                    <span className="text-xs font-normal text-zinc-400">
                      门槛 💰{r.gate} · 背包 {r.cap} 格 · 地图 {r.totalSlots} 槽 · {r.runs.toLocaleString()} 局 / {r.rolls.toLocaleString()} 次抽取
                    </span>
                    {distOk ? <Tag color="green">分布通过</Tag> : <Tag color="red">分布不通过</Tag>}
                  </div>

                  <Table size="small" pagination={false} rowKey="rarity"
                    dataSource={r.share.map((s) => ({ ...s, key: s.rarity }))}
                    columns={[
                      { title: "稀有度", dataIndex: "rarity", width: 90, render: (v: string) => v },
                      { title: "配置权重", dataIndex: "expected", width: 110, render: (v: number) => (v * 100).toFixed(3) + "%" },
                      { title: "实测频率", dataIndex: "observed", width: 110, render: (v: number) => (v * 100).toFixed(3) + "%" },
                      { title: "偏差", dataIndex: "delta", width: 110, render: (v: number) => (
                        <span className={v > 0.015 ? "font-semibold text-rose-500" : "text-zinc-500"}>{(v * 100).toFixed(3)}%</span>
                      ) },
                      { title: "命中", dataIndex: "hits", width: 100, render: (v: number) => v.toLocaleString() },
                    ] as any} />

                  <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-zinc-500 md:grid-cols-2">
                    <div>χ² = <b>{r.chi2.toFixed(2)}</b>（df {r.df}）　p = <b className={r.p > 0.05 ? "" : "text-rose-500"}>{r.p.toFixed(4)}</b>　最大偏差 <b>{(r.maxDelta * 100).toFixed(3)}%</b></div>
                    <div>模拟 EV：每次撤离 <b>{r.ratioExtract.toFixed(2)}×</b>　× 撤离率 <b>{r.ratioWithRate.toFixed(2)}×</b>{ev ? <>　解析 <b>{ev.ratio.toFixed(2)}×</b></> : null}</div>
                    <div>平均开 {r.avgContainers.toFixed(1)} 容器 / 摸 {r.avgSlots.toFixed(1)} 槽　带出展示 💰{r.avgKept.toFixed(0)}　回收 💰{r.avgPayout.toFixed(0)}</div>
                    <div>风险 {r.avgRisk.toFixed(1)}　因背包满丢弃 {r.avgDiscarded.toFixed(2)} 件</div>
                  </div>

                  {r.pity.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      保底：{r.pity.map((p) => `${p.name} ${p.afterRuns} 次未出→${p.minRarity}（触发 ${p.triggers} 次${p.coveredCount <= 0 ? "，⚠ 池内无该档候选" : ""}）`).join("；")}
                    </div>
                  )}

                  {ev && evGap > 0.3 && (
                    <Alert className="mt-2" type="warning" showIcon
                      message={`解析 EV（${ev.ratio.toFixed(2)}×）与模拟 EV（${r.ratioWithRate.toFixed(2)}×）相差 ${evGap.toFixed(2)}×`}
                      description="两边口径应当一致（权重加权 + 背包上限 + 同一条抽取逻辑）。差这么多说明有一边错了：先看本图有没有「某档池子空」「保底档无候选」这类配置问题。" />
                  )}
                  {!distOk && (
                    <Alert className="mt-2" type="warning" showIcon
                      message="分布检验未通过"
                      description="先检查该图用到的容器：有没有「有权重但掉落表里没有该档候选」的容器 —— 引擎会降档，实测频率自然对不上配置权重。" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card size="small" className="shadow-sm" title="经济与背包">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {num("recycleRate", "回收率（0-1，展示价 × 该值 = 回收价）", 0, 1, 0.05)}
          {num("extractRate", "撤离率（0-1，仅用于 EV 校验与折算）", 0, 1, 0.05)}
          {num("backpackCap", "背包格数（1-50）", 1, 50)}
          {num("initialCoins", "首次建档赠送金币", 0, 9999999, 50)}
          {num("rescueCoins", "破产救济金额", 0, 9999999, 50)}
          {num("rescueCooldownSec", "救济冷却（秒，默认 86400）", 0, 30 * 86400, 3600)}
        </div>
      </Card>

      <Card size="small" className="shadow-sm" title="风险与撤离 / EV 阈值">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {num("extractHoldMs", "撤离读条（ms，500-60000）", 500, 60000, 500)}
          {num("riskPerSlot", "每搜一格风险（0-10）", 0, 10)}
          {num("evWarnRatio", "EV 警告阈值（默认 3.5）", 1, 100, 0.05)}
          {num("evRejectRatio", "EV 拒绝阈值（默认 10.0）", 1, 100, 0.1)}
        </div>
      </Card>
    </div>
  )
}
