"use client"

// 爬塔工坊 · 角色授权（原「角色授权」Tab，已独立成页）
// 给 C 端用户组勾选可选择哪些角色；写入 spire.charAccess，随「发布到 C 端」生效。
//
// 形态：**列表为主**（一行 = 一个 C 端用户组，列出该组拥有的角色）+ **弹窗编辑**（点「编辑」改这批角色）。
// 列表只读、编辑收敛在弹窗里，所有改动只写 store（草稿），统一由页头「保存」提交 ——
// 不在弹窗里直接落库，是因为 POST /api/spire-content 是整包覆盖写，一次编辑触发一次保存已经够重了。
//
// fail-open：某组没有对应键时 C 端**不筛选**（全部可选），避免未配置把玩家全锁死。
import { useMemo, useState } from "react"
import { Alert, Button, Card, Checkbox, Empty, Form, Input, Modal, Space, Tag } from "antd"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import { presetAccess, type PoolChar } from "../_shared/access"
import { DataTable, actionColumn } from "@/components/admin"

/** 表格行：一行 = 一个用户组；orphan = charAccess 里有配置但用户组已不存在（脏数据） */
interface Row { code: string; name: string; member_count?: number; orphan: boolean }

/** 已授权角色列最多展示几个标签，超出折叠成 +N（一行塞太多标签会把表格撑爆） */
const MAX_TAGS = 8

/**
 * 编辑弹窗：改某一个用户组的角色白名单。
 * 由父组件用 key={code} 挂载，所以 useState 初值可以直接取自 props（换组即重挂载）。
 * 确定后只回调父级写 store，不自己保存。
 */
function AccessModal({ code, label, stored, pool, onCancel, onSubmit }: {
  code: string
  label: string
  /** 已存白名单；null = 该组未配置（C 端不筛选） */
  stored: string[] | null
  pool: PoolChar[]
  onCancel: () => void
  onSubmit: (ids: string[]) => void
}) {
  const [draft, setDraft] = useState<string[]>(stored ? [...stored] : presetAccess(code, pool))

  const toggle = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Modal open onCancel={onCancel} title={`✏️ 编辑角色授权 · ${label}`}
      okText="确定" cancelText="取消" onOk={() => onSubmit(draft)} maskClosable={false} width={640}>
      <div className="mt-3 flex flex-col gap-3">
        {stored === null && (
          <Alert type="warning" showIcon
            message={<span className="text-xs">该组尚未配置，当前 C 端不筛选（全部可选）。下面已按推荐预填，确定后即写入白名单。</span>} />
        )}
        {draft.length === 0 && (
          <Alert type="error" showIcon
            message={<span className="text-xs">一个都不选 = 该组玩家在 C 端<b>没有任何角色可选</b>，通常不是你想要的。</span>} />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Tag color="blue">已选 {draft.length} / {pool.length}</Tag>
          <div className="ml-auto flex items-center gap-2">
            <Button size="small" onClick={() => setDraft(pool.map((c) => c.id))}>全选</Button>
            <Button size="small" onClick={() => setDraft([])}>全不选</Button>
            <Button size="small" onClick={() => setDraft(presetAccess(code, pool))}>按推荐预填</Button>
          </div>
        </div>

        <Form layout="vertical">
          <Form.Item
            label="可选择的角色"
            extra="勾选后，该组玩家在「选择角色」页只能看到这些角色；未勾选的显示为锁定。"
            className="!mb-0"
          >
            {pool.length === 0 ? (
              <Empty description="暂无可授权角色（内置角色清单加载失败？）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {pool.map((c) => (
                  <div key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 dark:border-zinc-700">
                    <Checkbox checked={draft.includes(c.id)} onChange={() => toggle(c.id)}>
                      {c.icon} {c.name}
                    </Checkbox>
                    <Tag className="!ml-auto !mr-0" color={c.custom ? "purple" : "default"}>
                      {c.custom ? "工坊" : "内置"}
                    </Tag>
                  </div>
                ))}
              </div>
            )}
          </Form.Item>
        </Form>
      </div>
    </Modal>
  )
}

export default function SpireAccessPage() {
  const { groups, charPool, charAccess, setCharAccess, busy, saveQuiet, dirty } = useSpire()
  const [kw, setKw] = useState("")
  /** 正在编辑的组码；null = 弹窗关闭 */
  const [editing, setEditing] = useState<string | null>(null)

  /** 组列表 + charAccess 里的孤儿键；孤儿键单列出来，避免删了用户组后配置静默残留 */
  const rows = useMemo<Row[]>(() => {
    const known: Row[] = groups.map((g) => ({
      code: g.code, name: g.name, member_count: g.member_count, orphan: false,
    }))
    const codes = new Set(groups.map((g) => g.code))
    const orphans: Row[] = Object.keys(charAccess)
      .filter((c) => !codes.has(c))
      .map((c) => ({ code: c, name: "", member_count: undefined, orphan: true }))
    return [...known, ...orphans]
  }, [groups, charAccess])

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    if (!k) return rows
    return rows.filter((r) => r.code.toLowerCase().includes(k) || r.name.toLowerCase().includes(k))
  }, [rows, kw])

  const editingRow = editing ? rows.find((r) => r.code === editing) || null : null
  /** 弹窗标题里的显示名：孤儿组没有名称，退回组码 */
  const editingLabel = editingRow ? (editingRow.orphan ? editingRow.code : editingRow.name) : editing || ""

  const nameOf = (id: string) => charPool.find((c) => c.id === id)?.name || id

  /** 某组已存的白名单；null = 该组未配置（C 端不筛选） */
  const stored = (code: string): string[] | null =>
    Array.isArray(charAccess[code]) ? charAccess[code] : null

  /** 弹窗确定：只写 store 草稿，落库交给页头「保存」 */
  const submitEdit = (ids: string[]) => {
    if (!editing) return
    setCharAccess((prev) => ({ ...prev, [editing]: ids.filter((id, i, a) => a.indexOf(id) === i) }))
    setEditing(null)
    toast.success(`「${editingLabel}」角色已更新 · 还需「保存」+「发布到 C 端」`)
  }

  /** 删除孤儿配置：让该组回到「未配置 = 不筛选」 */
  const dropConfig = (code: string) =>
    setCharAccess((prev) => {
      const n = { ...prev }
      delete n[code]
      return n
    })

  const saveAccess = async () => {
    if (await saveQuiet()) toast.success("角色授权已保存，点「发布到 C 端」后生效")
  }

  /** 已授权角色列：未配置 → 全部可选；空数组 → 全部锁定（危险，标红）；否则列标签 */
  const renderRoles = (_: unknown, r: Row) => {
    const ids = stored(r.code)
    if (ids === null) {
      return <span className="text-xs text-amber-600 dark:text-amber-400">全部可选（未配置，C 端不筛选）</span>
    }
    if (!ids.length) {
      return <Tag color="red" className="!mr-0">全部锁定 · 0 个（该组玩家将无角色可选）</Tag>
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {ids.slice(0, MAX_TAGS).map((id) => <Tag key={id} className="!mr-0">{nameOf(id)}</Tag>)}
        {ids.length > MAX_TAGS && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">+{ids.length - MAX_TAGS}</span>
        )}
      </div>
    )
  }

  const columns = [
    {
      title: "编码", dataIndex: "code", width: 160,
      render: (v: string, r: Row) => (
        <span className="font-mono text-xs">
          {v}{r.code === "default" && <Tag className="!ml-2 !mr-0">默认组</Tag>}
        </span>
      ),
    },
    {
      title: "名称", dataIndex: "name", width: 160,
      render: (v: string, r: Row) =>
        r.orphan
          ? <span className="text-xs text-zinc-400 dark:text-zinc-500">（用户组已不存在）</span>
          : <span className="font-medium">{v}</span>,
    },
    {
      title: "成员数", dataIndex: "member_count", width: 90,
      render: (n: number | undefined, r: Row) =>
        r.orphan ? <span className="text-zinc-400 dark:text-zinc-500">—</span> : <Tag className="!mr-0">👤 {n ?? 0} 名</Tag>,
    },
    { title: "已授权角色", key: "roles", render: renderRoles },
    {
      title: "状态", key: "state", width: 130,
      render: (_: unknown, r: Row) => {
        const ids = stored(r.code)
        if (ids === null) return <Tag color="orange" className="!mr-0">未配置</Tag>
        if (!ids.length) return <Tag color="red" className="!mr-0">全锁</Tag>
        return <Tag color="blue" className="!mr-0">已配置 {ids.length}/{charPool.length}</Tag>
      },
    },
    actionColumn((_: unknown, r: Row) => (
      <Space size={4}>
        <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => setEditing(r.code)}>
          编辑
        </Button>
        {r.orphan && (
          <Button size="small" type="text" danger icon={<Trash2 size={13} />} onClick={() => dropConfig(r.code)}>
            删除配置
          </Button>
        )}
      </Space>
    ), 180),
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="👥 角色授权"
        hint={`共 ${rows.length} 个用户组 · ${charPool.length} 个可选角色；列表只读，改角色请点「编辑」`}
        onSave={saveAccess}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后还需要「发布到 C 端」</span> : null}
      />

      <Alert type="info" showIcon
        message="授权改动需「保存」+「发布到 C 端」两步才在玩家侧生效"
        description={<span className="text-xs">
          白名单外的角色在 C 端锁定；<b>某组未配置（无键）时不筛选、全部可选</b>（fail-open，避免未配置时把玩家全锁死）。
          组内成员在「C 端用户管理 → 用户」页调整。
        </span>} />

      <Card size="small" className="shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input.Search allowClear placeholder="搜索用户组编码 / 名称" style={{ width: 240 }}
              onChange={(e) => setKw(e.target.value)} />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              角色池 = 内置基础角色 + 本工坊「角色制作」页的自定义角色（按 id 去重，自定义优先）
            </span>
          </div>

          <DataTable size="middle" rowKey="code" columns={columns as any} dataSource={filtered} pagination={false}
            locale={{
              emptyText: groups.length
                ? "没有匹配的用户组"
                : "用户组列表加载失败或无可用组（需 B 端登录，可在「C 端用户管理」新建组）",
            }} />
        </div>
      </Card>

      {editingRow && (
        <AccessModal key={editingRow.code} code={editingRow.code} label={editingLabel}
          stored={stored(editingRow.code)} pool={charPool}
          onCancel={() => setEditing(null)} onSubmit={submitEdit} />
      )}
    </div>
  )
}
