"use client"

// 某一类素材的槽位列表（封装好的「表单列表」样式：FilterBar 过滤 + DataTable 列表 + 行操作）。
//
// 一行 = 一个槽位。所有编辑动作都收进「配置」弹窗，列表本身只负责：
//   ① 一眼看出哪些配了 / 没配 / 配了但失效  ② 提供入口（配置 / 预览 / 恢复默认）
// 这样列表行高度稳定，池子里有十几个候选也不会把表格撑爆。
import { useMemo, useState } from "react"
import { Button, Checkbox, Form, Input, Popconfirm, Space, Tag, Tooltip } from "antd"
import { Maximize2, Pencil, RotateCcw } from "lucide-react"
import { FilterBar, DataTable, actionColumn } from "@/components/admin"
import type { AssetSlot } from "@/lib/spire-assets"
import { Thumb, type AssetIndex } from "./shared"

export default function SlotTable({ slots, index, assets, assetPool, invalidBySlot, unpublishedKeys, onConfig, onPreview, onResetDefault }: {
  /** 本 Tab（本种类）下的槽位 */
  slots: AssetSlot[]
  index: AssetIndex
  /** 当前使用：key → 素材路径（空 = 内置默认） */
  assets: Record<string, string>
  /** 资源池：key → 候选路径数组 */
  assetPool: Record<string, string[]>
  /** 槽位 key → 清单中已找不到的路径 */
  invalidBySlot: Record<string, string[]>
  /** 与已发布快照不一致（= 玩家还看不到）的槽位 key */
  unpublishedKeys: Set<string>
  onConfig: (slot: AssetSlot) => void
  onPreview: (url: string, slot: AssetSlot) => void
  onResetDefault: (slot: AssetSlot) => void
}) {
  const [form] = Form.useForm()
  const [kw, setKw] = useState("")
  const [onlyUnset, setOnlyUnset] = useState(false)

  const rows = useMemo(() => {
    const q = kw.trim().toLowerCase()
    return slots.filter((s) => {
      if (onlyUnset && assets[s.key]) return false
      if (!q) return true
      const pool = assetPool[s.key] || []
      return (
        s.label.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        (assets[s.key] || "").toLowerCase().includes(q) ||
        pool.some((u) => u.toLowerCase().includes(q))
      )
    })
  }, [slots, kw, onlyUnset, assets, assetPool])

  const columns = [
    {
      title: "槽位",
      dataIndex: "label",
      width: 230,
      render: (_: unknown, s: AssetSlot) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.label}</span>
          <div className="flex items-center gap-1">
            <code className="text-[11px] text-zinc-400 dark:text-zinc-500">{s.key}</code>
            {s.hint && (
              <Tooltip title={s.hint}>
                <span className="cursor-help text-[11px] text-indigo-400">说明</span>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "当前使用",
      dataIndex: "key",
      width: 230,
      render: (_: unknown, s: AssetSlot) => {
        const cur = assets[s.key]
        if (!cur) {
          return s.default
            ? <Tag className="!mr-0">内置默认：{index.fileOf(s.default)}</Tag>
            : <Tag className="!mr-0" color="orange">未配置（C 端自绘兜底）</Tag>
        }
        const bad = (invalidBySlot[s.key] || []).includes(cur)
        return (
          <div className="flex items-center gap-2">
            <Thumb url={cur} size={36} />
            <span className="min-w-0 flex-1 truncate text-xs" title={cur}>{index.nameOf(cur)}</span>
            {bad && <Tag color="red" className="!mr-0 !text-[10px]">失效</Tag>}
          </div>
        )
      },
    },
    {
      title: "资源池",
      dataIndex: "key",
      width: 200,
      render: (_: unknown, s: AssetSlot) => {
        const pool = assetPool[s.key] || []
        if (!pool.length) return <span className="text-xs text-zinc-400 dark:text-zinc-500">— 空 —</span>
        const shown = pool.slice(0, 6)
        return (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
              {shown.map((u) => (
                <Tooltip key={u} title={index.nameOf(u)}><Thumb url={u} size={26} /></Tooltip>
              ))}
              {pool.length > shown.length && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">+{pool.length - shown.length}</span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{pool.length} 个候选</span>
          </div>
        )
      },
    },
    {
      title: "状态",
      dataIndex: "key",
      width: 190,
      render: (_: unknown, s: AssetSlot) => {
        const bad = (invalidBySlot[s.key] || []).length
        const cur = assets[s.key]
        const notInPool = !!cur && !(assetPool[s.key] || []).includes(cur)
        return (
          <div className="flex flex-wrap items-center gap-1">
            {cur
              ? <Tag color="green" className="!mr-0">已指定</Tag>
              : <Tag className="!mr-0" color="orange">未指定</Tag>}
            {bad > 0 && <Tag color="red" className="!mr-0">{bad} 个失效</Tag>}
            {notInPool && (
              <Tooltip title="配置里存了这张图，但资源池里没有它（手工改过路径或旧数据残留）；可在弹窗里「并入池子」">
                <Tag color="orange" className="!mr-0">当前值不在池中</Tag>
              </Tooltip>
            )}
            {unpublishedKeys.has(s.key) && (
              <Tooltip title="与玩家当前看到的版本不同 —— 保存后还需「发布到 C 端」">
                <Tag color="blue" className="!mr-0">未发布</Tag>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    actionColumn((_: unknown, s: AssetSlot) => (
      <Space size={4}>
        <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => onConfig(s)}>配置</Button>
        {assets[s.key] && (
          <Tooltip title="看大图与素材说明">
            <Button size="small" type="text" icon={<Maximize2 size={13} />}
              onClick={() => onPreview(assets[s.key], s)} />
          </Tooltip>
        )}
        {assets[s.key] && (
          <Popconfirm title="恢复内置默认" description={`清空「${s.label}」当前使用的素材（资源池保留）。`}
            okText="恢复" cancelText="取消" onConfirm={() => onResetDefault(s)}>
            <Button size="small" type="text" icon={<RotateCcw size={13} />} />
          </Popconfirm>
        )}
      </Space>
    ), 190),
  ]

  return (
    <div className="flex flex-col gap-3">
      <FilterBar form={form}
        onSearch={(v) => { setKw(String(v.kw || "")); setOnlyUnset(!!v.onlyUnset) }}
        onReset={() => { setKw(""); setOnlyUnset(false) }}>
        <Form.Item name="kw" label="关键字">
          <Input allowClear placeholder="槽位名 / key / 素材文件名" style={{ width: 240 }} />
        </Form.Item>
        <Form.Item name="onlyUnset" valuePropName="checked">
          <Checkbox>只看未配置</Checkbox>
        </Form.Item>
      </FilterBar>

      <DataTable<AssetSlot>
        rowKey="key"
        size="middle"
        columns={columns as any}
        dataSource={rows}
        pagination={rows.length > 20 ? { pageSize: 20, showTotal: (t: number) => `共 ${t} 个槽位` } : false}
      />
    </div>
  )
}
