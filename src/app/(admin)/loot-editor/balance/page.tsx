"use client"

// 摸金行动 · 全局参数（balance）+ EV 校验面板
// EV 校验：列表展示每张图「期望收益 ÷ 门槛」倍率，超 evWarnRatio 标黄、超 evRejectRatio 标红并**拒绝保存**。
import { useMemo } from "react"
import { InputNumber, Button, Card, Form, Tag, Table } from "antd"
import { RotateCcw } from "lucide-react"
import { toast } from "@/lib/toast"
import { useLoot } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import { evalMap, sanitizeBalance, type Balance, type MapEv } from "../_shared/model"

export default function LootBalancePage() {
  const { balance, setBalance, baseBalance, maps, containers, tables, items, busy, dirty, save } = useLoot()

  const evs = useMemo(
    () => maps.map((m) => evalMap(m, containers, tables, items, balance)),
    [maps, containers, tables, items, balance],
  )
  const rejected = evs.filter((e) => e.level === "reject")
  const warned = evs.filter((e) => e.level === "warn")

  /** 保存前先跑 EV 校验：超标直接拒绝（防止手滑把经济做崩） */
  const doSave = () => {
    if (rejected.length) {
      toast.error(`EV 倍率超过 ${balance.evRejectRatio}×（${rejected.map((r) => r.name).join("、")}），已拒绝保存；请调低价值倍率或提高门槛`)
      return
    }
    if (warned.length) toast.warning(`注意：${warned.map((r) => r.name).join("、")} 的 EV 倍率超过 ${balance.evWarnRatio}×`)
    save()
  }

  const resetDefault = () => { setBalance(sanitizeBalance(baseBalance)); toast.info("已恢复为内置默认参数") }

  const num = (k: keyof Balance, label: string, min: number, max: number, step = 1, tip?: string) => (
    <Form.Item label={<span title={tip}>{label}</span>} className="!mb-0">
      <InputNumber min={min} max={max} step={step} className="!w-full" value={balance[k]}
        onChange={(v) => setBalance((b) => ({ ...b, [k]: v ?? b[k] } as Balance))} />
    </Form.Item>
  )

  const evColumns = [
    { title: "地图", dataIndex: "name", render: (v: string, e: MapEv) => `${e.name}（${e.mapId}）` },
    { title: "毛收益", dataIndex: "gross", width: 110, render: (v: number) => `💰 ${v}` },
    { title: "EV 倍率", dataIndex: "ratio", width: 110, render: (v: number) => v.toFixed(2) + "×" },
    { title: "判定", dataIndex: "level", width: 110, render: (lv: MapEv["level"]) => lv === "reject"
      ? <Tag color="red">超标（拒绝保存）</Tag>
      : lv === "warn" ? <Tag color="orange">偏高</Tag> : <Tag color="green">正常</Tag> },
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
        <div className="mt-2 text-xs text-zinc-400">
          建议区间 [1.5, 3.5]；超过 {balance.evWarnRatio}× 警告，超过 {balance.evRejectRatio}× 拒绝保存。
        </div>
      </Card>

      <Card size="small" className="shadow-sm" title="经济与背包">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {num("recycleRate", "回收率（0-1，面值 × 该值 = 回收价）", 0, 1, 0.05)}
          {num("extractRate", "撤离率（0-1，仅用于 EV 校验）", 0, 1, 0.05)}
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
          {num("evWarnRatio", "EV 警告阈值（默认 1.15）", 1, 100, 0.05)}
          {num("evRejectRatio", "EV 拒绝阈值（默认 3.0）", 1, 100, 0.1)}
        </div>
      </Card>
    </div>
  )
}
