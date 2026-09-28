"use client"

// 爬塔工坊 · 难度配置（对称「角色/敌人制作」页）
// 平衡参数 = { totalActs, mapRows, actBossIds[], actScaleStep }，镜像 C 端 spire-engine.ts 常量。
// 改动经 store 整包保存；C 端加载后覆盖代码常量（MAP_ROWS / TOTAL_ACTS / ACT_BOSS_IDS / actScale）。
import { useMemo } from "react"
import { InputNumber, Select, Button, Card, Form, Tag } from "antd"
import { RotateCcw } from "lucide-react"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import { sanitizeBalance, type SpireBalance } from "../_shared/model"

export default function SpireBalancePage() {
  const { balance, setBalance, enemies, baseBalance, busy, save, dirty } = useSpire()

  const bossOptions = useMemo(
    () => (enemies || []).map((e) => ({ value: e.id, label: `${e.icon} ${e.name}` })),
    [enemies],
  )

  const setBoss = (actIdx: number, id: string) =>
    setBalance((b) => {
      const ids = [...b.actBossIds]
      while (ids.length <= actIdx) ids.push(ids[ids.length - 1] || "king")
      ids[actIdx] = id
      return { ...b, actBossIds: ids }
    })

  const resetDefault = () => {
    const d = sanitizeBalance(baseBalance)
    setBalance(d)
    toast.info("已恢复为内置默认难度")
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="⚖️ 难度配置"
        hint="幕数 / 每层数 / 逐幕难度步进 / 各幕 BOSS；保存发布后 C 端爬塔即时采用，未配置则回落内置默认"
        onSave={save}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后才会写入服务端</span> : null}
      />
      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Form.Item label="幕数（1-8）" className="!mb-0">
              <InputNumber min={1} max={8} className="!w-full" value={balance.totalActs}
                onChange={(v) => setBalance({ ...balance, totalActs: v ?? 3 })} />
            </Form.Item>
            <Form.Item label="每幕层数（1-400）" className="!mb-0">
              <InputNumber min={1} max={400} className="!w-full" value={balance.mapRows}
                onChange={(v) => setBalance({ ...balance, mapRows: v ?? 16 })} />
            </Form.Item>
            <Form.Item label="逐幕难度步进（0-5，如 0.3 = 每幕 ×1.3）" className="!mb-0">
              <InputNumber min={0} max={5} step={0.1} className="!w-full" value={balance.actScaleStep}
                onChange={(v) => setBalance({ ...balance, actScaleStep: v ?? 0.3 })} />
            </Form.Item>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">各幕 BOSS</span>
              <Button size="small" icon={<RotateCcw size={12} />} onClick={resetDefault}>恢复默认</Button>
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: balance.totalActs }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Tag color="red" className="!w-16 !text-center">第 {i + 1} 幕</Tag>
                  <Select className="!w-60" value={balance.actBossIds[i] || ""} placeholder="选择 BOSS 敌人…"
                    onChange={(id) => setBoss(i, id)}
                    options={bossOptions} />
                  {(!balance.actBossIds[i] || !bossOptions.some((o) => o.value === balance.actBossIds[i])) && (
                    <span className="text-xs text-rose-500">该 id 在敌人池中不存在，C 端将回退终幕 BOSS</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-zinc-400">
            内置默认：{baseBalance.totalActs} 幕 × {baseBalance.mapRows} 层，步进 {baseBalance.actScaleStep}，
            BOSS = {baseBalance.actBossIds.join(" / ")}
          </div>
        </div>
      </Card>
    </div>
  )
}
