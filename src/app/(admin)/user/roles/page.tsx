"use client"

// 角色组管理（antd 版）：Table 列表 + Modal 表单（创建/重命名/分配路由组）
import { useCallback, useEffect, useState } from "react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { Table, Modal, Form, Input, Button, Tag, Tree, Popconfirm, Space, Result } from "antd"
import { Plus, ShieldCheck, Pencil } from "lucide-react"

type Route = { code: string; path: string; method: string; kind: string; name: string }
type Role = { code: string; name: string; route_codes: string[] }
type User = { id: number; username: string; email: string | null; role: string; created_at: string }
type Overview = { me: { id: number; username: string; role: string }; routes: Route[]; roles: Role[]; users: User[] }
type MenuItem = { key: string; name: string; icon?: string; path?: string; children?: MenuItem[] }

export default function UserRolesPage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [denied, setDenied] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [nr, setNr] = useState({ code: "", name: "" })
  const [renaming, setRenaming] = useState<Role | null>(null)
  const [renameVal, setRenameVal] = useState("")
  const [assigning, setAssigning] = useState<Role | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiJson<Overview>("/api/perm/overview")
      .then(setOv)
      .catch((e) => { if (String(e.message).includes("403")) setDenied(true) })
    apiJson<{ menu: MenuItem[] }>("/api/menu")
      .then((d) => setMenu(d.menu || []))
      .catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const memberCount = (code: string) => (ov?.users || []).filter((u) => u.role === code).length

  async function createRole() {
    if (!nr.code.trim() || !nr.name.trim()) { toast.warning("角色编码和名称必填"); return }
    setBusy(true)
    try {
      await postJson("/api/perm/roles", nr)
      toast.success("角色组已创建，可立即为其分配路由")
      setCreateOpen(false); setNr({ code: "", name: "" })
      load()
    } catch (e: any) { toast.error(e.message || "创建失败") }
    setBusy(false)
  }

  async function saveRename() {
    if (!renaming) return
    setBusy(true)
    try {
      await postJson(`/api/perm/roles/${renaming.code}/name`, { name: renameVal })
      toast.success("角色已重命名")
      setRenaming(null)
      load()
    } catch (e: any) { toast.error(e.message || "重命名失败") }
    setBusy(false)
  }

  async function removeRole(r: Role) {
    try { await api(`/api/perm/roles/${r.code}`, { method: "DELETE" }); toast.success("角色组已删除"); load() }
    catch (e: any) { toast.error(e.message || "删除失败") }
  }

  function openAssign(r: Role) {
    setAssigning(r)
    setDraft([...(r.route_codes || [])])
  }

  async function saveRoutes() {
    if (!assigning) return
    setBusy(true)
    try {
      await postJson(`/api/perm/roles/${assigning.code}/routes`, { codes: draft })
      toast.success(`「${assigning.name}」路由组已保存，成员菜单即时生效`)
      setAssigning(null)
      load()
    } catch (e: any) { toast.error(e.message || "保存失败") }
    setBusy(false)
  }

  if (denied) return <Result status="403" title="403" subTitle="此页面仅超级管理员可见" />
  if (!ov) return <div className="text-zinc-500 dark:text-zinc-400">加载中...</div>

  const pageRoutes = ov.routes.filter((r) => r.kind === "page")
  const apiRoutes = ov.routes.filter((r) => r.kind === "api")
  const pageByPath = new Map(pageRoutes.map((r) => [r.path, r]))

  // 分配路由树（三层结构）：根分组 → 菜单分组/API 模块 → 具体路由
  // 勾选父节点即全选子节点；onCheck 时过滤掉非路由 key（路由 code 均以 page:/api: 开头）
  function menuNodes(items: MenuItem[]): any[] {
    const nodes: any[] = []
    for (const it of items) {
      if (it.children?.length) {
        const kids = menuNodes(it.children)
        if (kids.length) nodes.push({ title: `${it.icon || ""} ${it.name}`, key: `grp:menu:${it.key}`, selectable: false, children: kids })
      } else if (it.path) {
        const r = pageByPath.get(it.path)
        if (r) {
          consumedPage.add(r.code)
          nodes.push({ title: <span><span className="text-sm text-zinc-700 dark:text-zinc-200">{r.name}</span><span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono ml-1.5">{r.path}</span></span>, key: r.code, selectable: false })
        }
      }
    }
    return nodes
  }
  const consumedPage = new Set<string>()
  const menuGroupNodes = menuNodes(menu)
  const orphanPages = pageRoutes.filter((r) => !consumedPage.has(r.code)).map((r) => ({
    title: <span><span className="text-sm text-zinc-700 dark:text-zinc-200">{r.name}</span><span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono ml-1.5">{r.path}</span></span>,
    key: r.code, selectable: false,
  }))
  if (orphanPages.length) menuGroupNodes.push({ title: "📦 未挂菜单的页面", key: "grp:page:orphan", selectable: false, children: orphanPages })

  // API 路由按第一段路径归模块分组，单段接口归入「系统基础」
  const apiModuleName: Record<string, string> = { perm: "权限管理", english: "英语学习", trpg: "TRPG 剧本", rag: "文档问答", conversations: "智能对话", tools: "AI 工具库" }
  const apiGroups = new Map<string, Route[]>()
  for (const r of apiRoutes) {
    const segs = r.path.split("/").filter(Boolean) // ["api", "perm", "roles", ...]
    const g = segs.length > 2 ? segs[1] : "_base"
    if (!apiGroups.has(g)) apiGroups.set(g, [])
    apiGroups.get(g)!.push(r)
  }
  const apiGroupNodes = [...apiGroups.entries()].map(([g, rs]) => ({
    title: `${g === "_base" ? "⚙️ 系统基础" : "📦 " + (apiModuleName[g] || g)} · ${rs.length} 条`, key: `grp:api:${g}`, selectable: false,
    children: rs.map((r) => ({
      title: <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{r.method} {r.path}</span>, key: r.code, selectable: false,
    })),
  }))

  const routeTree = [
    { title: `🧭 页面路由（决定可见菜单）· ${pageRoutes.length} 条`, key: "grp:root:page", selectable: false, children: menuGroupNodes },
    { title: `🔌 API 路由（已登记备用）· ${apiRoutes.length} 条`, key: "grp:root:api", selectable: false, children: apiGroupNodes },
  ]

  const columns = [
    {
      title: "角色组", dataIndex: "name",
      render: (_: any, r: Role) => (
        <Space size={6}>
          <span>{r.code === "super_admin" ? "👑" : r.code === "user" ? "🙋" : "🛡️"}</span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.name}</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">{r.code}</span>
          {(r.code === "super_admin" || r.code === "user") && <Tag>内置</Tag>}
        </Space>
      ),
    },
    { title: "成员数", width: 110, render: (_: any, r: Role) => <Tag>👤 {memberCount(r.code)} 名</Tag> },
    {
      title: "路由授权", width: 150,
      render: (_: any, r: Role) => r.code === "super_admin"
        ? <Tag color="gold">全部路由</Tag>
        : <Tag color="blue">🧭 {r.route_codes.length} 条</Tag>,
    },
    {
      title: "说明", dataIndex: "code",
      render: (code: string) => code === "super_admin"
        ? <span className="text-xs text-zinc-400 dark:text-zinc-500">默认拥有全部路由（含未来自动注册的新路由），无需分配</span>
        : <span className="text-xs text-zinc-400 dark:text-zinc-500">分配路由组后，成员菜单即时生效</span>,
    },
    {
      title: "操作", align: "right" as const, width: 240,
      render: (_: any, r: Role) => r.code === "super_admin" ? null : (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<ShieldCheck size={13} />} onClick={() => openAssign(r)}>分配路由</Button>
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => { setRenaming(r); setRenameVal(r.name) }}>重命名</Button>
          {r.code !== "user" && (
            <Popconfirm title="删除角色组"
              description={`删除角色组「${r.name}」？${memberCount(r.code) > 0 ? `其下 ${memberCount(r.code)} 名成员将并入「普通用户」。` : ""}该操作不可恢复。`}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeRole(r)}>
              <Button size="small" type="text" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>创建角色组</Button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">共 {ov.roles.length} 个角色组 · 给角色分配路由组后，成员菜单即时生效</span>
      </div>

      <Table rowKey="code" size="middle" columns={columns as any} dataSource={ov.roles} pagination={false} />

      {/* 创建角色组 */}
      <Modal open={createOpen} onCancel={() => { if (!busy) setCreateOpen(false) }} title="➕ 创建角色组"
        okText="创建" cancelText="取消" confirmLoading={busy} onOk={createRole} maskClosable={false}>
        <Form layout="vertical" className="mt-3">
          <Form.Item label="角色编码" required extra="2-30 位小写字母/数字/下划线，创建后不可修改">
            <Input className="font-mono" placeholder="如：editor" value={nr.code} onChange={(e) => setNr({ ...nr, code: e.target.value })} />
          </Form.Item>
          <Form.Item label="角色名称" required extra="1-20 字，如：内容编辑">
            <Input placeholder="如：内容编辑" value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名 */}
      {renaming && (
        <Modal open onCancel={() => { if (!busy) setRenaming(null) }} title={`✏️ 重命名角色 · ${renaming.code}`}
          okText="保存" cancelText="取消" confirmLoading={busy} onOk={saveRename} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="角色名称" required>
              <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onPressEnter={saveRename} />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* 分配路由（Tree 勾选） */}
      {assigning && (
        <Modal open onCancel={() => { if (!busy) setAssigning(null) }} title={`🛡️ 分配路由 · ${assigning.name}`} width={560}
          okText={`保存路由组（已选 ${draft.length}）`} cancelText="取消" confirmLoading={busy} onOk={saveRoutes} maskClosable={false}>
          <div className="mt-2">
            <Tree checkable defaultExpandAll height={420} treeData={routeTree}
              checkedKeys={draft}
              onCheck={(keys) => {
                const arr = Array.isArray(keys) ? keys : keys.checked
                setDraft(arr.filter((k) => String(k).startsWith("page:") || String(k).startsWith("api:")) as string[])
              }} />
            <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">共 {ov.routes.length} 条路由 · 已勾选 {draft.length} 条；勾选分组节点可整组选/取消</div>
          </div>
        </Modal>
      )}
    </div>
  )
}
