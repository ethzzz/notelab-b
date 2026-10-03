"use client"

// 单个槽位的配置弹窗（列表页点「配置」打开）。
//
// 表单字段只有两个，但**互相联动**：
//   pool    = 资源池候选（有序，多选）
//   current = 当前使用（必须是 pool 里的一个；留空 = 回落内置默认）
// 所以「下拉多选」「池内排序/移出」「设为当前」全都读写同一份表单值，不存在两处状态打架。
//
// 注意：本弹窗只改**前端草稿**（共享 store），点确定≠落库 ——
// 仍需页面顶部「保存」+「发布到 C 端」玩家才看得到，这点在弹窗底部有明确提示。
import { Alert, Button, Form, Select, Tag, Tooltip } from "antd"
import { RotateCcw, Sparkles } from "lucide-react"
import ModalForm from "@/components/admin/ModalForm"
import { suggestedItems, type AssetCatalog, type AssetSlot } from "@/lib/spire-assets"
import { optionsOf, type AssetIndex } from "./shared"
import PoolOrderList, { type UsedBy } from "./PoolOrderList"

/** 弹窗内的表单体：需要 Form context，故必须是 ModalForm 的子组件而不是外部传 children 函数 */
function Body({ slot, catalog, index, invalid, usedByOf, onPreview, onCopyRequest }: {
  slot: AssetSlot
  catalog: AssetCatalog
  index: AssetIndex
  invalid: string[]
  usedByOf: Map<string, UsedBy[]>
  onPreview: (url: string) => void
  onCopyRequest: (url: string) => void
}) {
  const form = Form.useFormInstance()
  const pool = (Form.useWatch("pool") || []) as string[]
  const current = (Form.useWatch("current") || "") as string

  const options = optionsOf(catalog, slot)
  const recommended = suggestedItems(slot, catalog)

  /** 「当前使用」下拉：只列池内候选；若当前值不在池中（旧数据残留）额外补一项，便于发现后并入 */
  const currentOptions = [
    ...pool.map((u) => ({ value: u, label: index.nameOf(u) })),
    ...(current && !pool.includes(current)
      ? [{ value: current, label: `${index.nameOf(current)}（当前值 · 不在池中）` }]
      : []),
  ]

  /** 填充推荐：**只增不减** —— 已有候选与当前选择都保留，只有当前为空时才指定第一张 */
  const fillRecommended = () => {
    const rec = recommended.map((r) => r.url)
    if (!rec.length) return
    const merged = [...pool]
    for (const u of rec) if (!merged.includes(u)) merged.push(u)
    form.setFieldValue("pool", merged)
    if (!current) form.setFieldValue("current", rec[0])
  }

  /** 异常修复：把「当前使用」并进池子（保留当前选择，不换图） */
  const mergeCurrent = () => {
    if (!current || pool.includes(current)) return
    form.setFieldValue("pool", [...pool, current])
  }

  const notInPool = !!current && !pool.includes(current)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Tag className="!mr-0" color="purple">{slot.label}</Tag>
        <Tag className="!mr-0" color="default">{slot.key}</Tag>
        {slot.default
          ? <Tooltip title={slot.default}><Tag className="!mr-0">内置默认：{index.fileOf(slot.default)}</Tag></Tooltip>
          : <Tag className="!mr-0" color="orange">无内置默认（C 端自绘兜底）</Tag>}
      </div>

      {slot.hint && <div className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{slot.hint}</div>}

      <Form.Item name="pool" label="资源池候选（可多选）"
        extra="同类可登记多个，游戏里用时只需切换「当前使用」指向哪一个，不必重新找素材路径。">
        <Select mode="multiple" showSearch allowClear optionFilterProp="label"
          placeholder="选择素材加入该类型的资源池" options={options}
          notFoundContent="素材清单里没有可选项" maxTagCount={6} />
      </Form.Item>

      <Form.Item name="current" label="当前使用"
        extra="留空＝回落内置默认（资源池保留，可随时再指定）。">
        <Select allowClear showSearch optionFilterProp="label"
          placeholder={pool.length ? "留空＝使用内置默认" : "请先加入资源池候选"}
          options={currentOptions} disabled={!pool.length && !current} />
      </Form.Item>

      <div className="flex flex-wrap items-center gap-2">
        {recommended.length > 0 && (
          <Tooltip title={`把「${slot.label}」的推荐素材（${recommended.length} 个）并入池子；已有候选与当前选择不会被覆盖`}>
            <Button size="small" icon={<Sparkles size={12} />} onClick={fillRecommended}>
              填充推荐（{recommended.length}）
            </Button>
          </Tooltip>
        )}
        {current && (
          <Tooltip title="清空「当前使用」，回落内置默认（资源池保留）">
            <Button size="small" icon={<RotateCcw size={12} />} onClick={() => form.setFieldValue("current", undefined)}>
              恢复内置默认
            </Button>
          </Tooltip>
        )}
      </div>

      {notInPool && (
        <Alert type="warning" showIcon className="!text-xs"
          message="当前使用的素材不在资源池里（通常是手工改过路径或旧数据残留）"
          description={
            <div className="mt-1">
              <Button size="small" onClick={mergeCurrent}>并入池子（不换图）</Button>
            </div>
          } />
      )}

      <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <PoolOrderList index={index} invalid={invalid} usedByOf={usedByOf}
          onPreview={onPreview} onCopyRequest={onCopyRequest} />
      </div>

      <div className="rounded-lg bg-black/[0.02] px-3 py-2 text-[11px] text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
        点「确定」只写入本页草稿 —— 还需页面顶部<b>保存</b>并<b>发布到 C 端</b>，玩家才会看到变化。
      </div>
    </div>
  )
}

export default function SlotConfigModal({ slot, pool, current, catalog, index, invalid, usedByOf, onCancel, onApply, onPreview, onCopyRequest }: {
  /** 正在配置的槽位；null 表示弹窗关闭 */
  slot: AssetSlot | null
  /** 该槽位当前资源池（打开弹窗时的值，作为表单初值） */
  pool: string[]
  current: string
  catalog: AssetCatalog
  index: AssetIndex
  invalid: string[]
  usedByOf: Map<string, UsedBy[]>
  onCancel: () => void
  onApply: (next: { pool: string[]; current: string }) => void
  onPreview: (url: string) => void
  onCopyRequest: (url: string) => void
}) {
  if (!slot) return null
  return (
    <ModalForm
      // key 强制按槽位重挂载：换一个槽位时表单内部状态（含排序、滚动）不会串
      key={slot.key}
      open
      title={`🎨 配置素材 · ${slot.label}`}
      width={780}
      okText="确定"
      cancelText="取消"
      initialValues={{ pool, current: current || undefined }}
      onCancel={onCancel}
      onSubmit={(v: any) => onApply({ pool: (v.pool || []) as string[], current: (v.current || "") as string })}
    >
      <Body slot={slot} catalog={catalog} index={index} invalid={invalid}
        usedByOf={usedByOf} onPreview={onPreview} onCopyRequest={onCopyRequest} />
    </ModalForm>
  )
}
