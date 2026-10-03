"use client"

// 把一张候选复制到别的槽位的资源池（跨槽位复用：同一张图给多个节点类型用）。
//
// 原则：**只加候选，不动目标槽位当前正在用的那张** —— 否则复制一次就把别人配好的图换掉了。
import { useState } from "react"
import { Modal, Select } from "antd"
import type { AssetSlot } from "@/lib/spire-assets"

export default function CopyToSlotsModal({ url, from, slots, onClose, onPick }: {
  url: string
  /** 来源槽位 key（自己不出现在候选里） */
  from: string
  slots: AssetSlot[]
  onClose: () => void
  onPick: (keys: string[]) => void
}) {
  const [keys, setKeys] = useState<string[]>([])
  const options = slots
    .filter((s) => s.key !== from)
    .map((s) => ({ value: s.key, label: `${s.label}（${s.key}）` }))

  return (
    <Modal open onCancel={onClose} title="复制到其它槽位"
      okText="复制" cancelText="取消" okButtonProps={{ disabled: !keys.length }}
      onOk={() => { onPick(keys); onClose() }} maskClosable={false} width={460}>
      <div className="mt-3 flex flex-col gap-2">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          把 <code>{url.slice(url.lastIndexOf("/") + 1)}</code> 加进目标槽位的<b>资源池</b>（只新增候选，
          <b>不会</b>改动目标槽位当前正在用的那张图）。
        </div>
        <Select mode="multiple" showSearch allowClear className="!w-full" size="small"
          placeholder="选择目标槽位（可多选）" optionFilterProp="label"
          value={keys} onChange={(v) => setKeys(v as string[])} options={options} />
        {keys.length > 0 && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            将写入：{keys.join("、")}
          </div>
        )}
      </div>
    </Modal>
  )
}
