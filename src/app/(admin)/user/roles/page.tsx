"use client"

// 角色组管理（antd 版）：Table 列表 + Modal 表单（创建/重命名/分配路由组）
import { useCallback, useEffect, useState } from "react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { Table, Modal, Form, Input, Button, Tag, Tree, Popconfirm, Space, Result, Tabs } from "antd"
import { Plus, ShieldCheck, Pencil, Users } from "lucide-react"
import { AdminPage, DataTable, actionColumn } from "@/components/admin"
import { methodColor } from "@/lib/http-method"
import { ROLE_EXTERNAL, ROLE_SUPER_ADMIN, ROLE_USER, isBuiltinRole, roleAssignNotice, roleHint, roleIcon } from "@/lib/roles"

// 「页面用哪些接口」的归属、模块键与展示名**全部由后端下发**（PermService.listRoutes 附加
// modules / module / module_name / menu_group，权威在 notelab-java 的 model/RouteGroups 与 model/ApiModules）。
// 本页不持有任何「路径 → 模块」映射，也不持有归属表 —— 两端各写一半会出现「模块落进系统通用」
// 却以为配过了的静默失配。后端启动时还会校验悬空键并 warn。
type Route = {
  code: string; path: string; method: string; kind: string; name: string
  /** 1 = 仅超管（受限前缀）。树里锁死不可勾，后端也会拒绝授予 */
  super_only?: number | boolean
  /** 后端算好的模块键（admin/ops、perm/users 这类细分键） */
  module?: string
  /** 模块展示名 */
  module_name?: string
  /** 本页用到的接口模块键（仅 kind=page，来自 RouteGroups.PAGE_MODULES） */
  modules?: string[]
  /** 多页面共用的模块挂到哪个菜单分组（仅 kind=api，来自 RouteGroups.SHARED_MODULES） */
  menu_group?: string
}
type Role = { code: string; name: string; route_codes: string[] }
type User = { id: number; username: string; email: string | null; role: string; created_at: string }
type Overview = { me: { id: number; username: string; role: string }; routes: Route[]; roles: Role[]; users: User[] }
type MenuItem = { key: string; name: string; icon?: string; path?: string; children?: MenuItem[] }

/**
 * 宽松判定「仅超管」：MySQL TINYINT 经 Jackson 出来通常是 0/1 数字，
 * 但不同驱动/序列化路径也可能是 true / "1" —— 三种都认，宁严勿宽。
 */
function isSuperOnly(r: Route): boolean {
  const v = r.super_only
  return v === 1 || v === true || (v as unknown) === "1"
}

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
  // 成员管理（批量加入/移出）：账户全量取自 /api/perm/overview 的 users，不额外发请求
  const [managing, setManaging] = useState<Role | null>(null)
  const [memTab, setMemTab] = useState<"add" | "current">("add")
  const [memQ, setMemQ] = useState("")
  const [addIds, setAddIds] = useState<number[]>([])
  const [removeIds, setRemoveIds] = useState<number[]>([])

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
    // 「仅超管」的码不进草稿：后端已拒绝授予，界面也不该显示成已勾选（那会让人以为配上了）
    const cur = new Set<string>((r.route_codes || []).filter((c) => !superOnlySet.has(c)))
    // 勾了页面但没勾其接口的历史数据：加载时自动补上，与树的「勾页面连带接口」语义一致
    for (const code of [...cur]) {
      if (!code.startsWith("page:")) continue
      for (const m of pageByPath.get(code.slice("page:".length))?.modules || []) {
        for (const rt of byModule.get(m) || []) if (!isSuperOnly(rt)) cur.add(rt.code)
      }
    }
    setAssigning(r)
    setDraft([...cur])
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

  // ---------------- 成员管理：批量把账户加入/移出本用户组 ----------------
  // 语义基础：users.role 是单值，一个账户只属于一个用户组。
  // 所以「加入 A 组」= 把这批人从原组移到 A 组；「移出」= 并入内置的「普通用户」组。
  function openMembers(r: Role) {
    setManaging(r)
    setMemTab("add"); setMemQ(""); setAddIds([]); setRemoveIds([])
  }

  async function saveMembers() {
    if (!managing) return
    const nAdd = addIds.length, nDel = removeIds.length
    if (nAdd + nDel === 0) { toast.warning("没有需要变更的成员"); return }
    setBusy(true)
    try {
      // 先加后移：这样中途失败时已生效的是「加入」，不会先把人踢出组造成临时失去权限
      if (nAdd) await postJson("/api/perm/users/batch-role", { ids: addIds, role: managing.code })
      if (nDel) await postJson("/api/perm/users/batch-role", { ids: removeIds, role: ROLE_USER })
      toast.success(`「${managing.name}」成员已更新：加入 ${nAdd} 人、移出 ${nDel} 人`)
      setManaging(null)
      load()
    } catch (e: any) {
      toast.error(e.message || "保存失败")
      load() // 部分成功时也要把最新成员数刷回来
    }
    setBusy(false)
  }

  if (denied) return <Result status="403" title="403" subTitle="此页面仅超级管理员可见" />
  if (!ov) return <div className="text-zinc-500 dark:text-zinc-400">加载中...</div>

  const pageRoutes = ov.routes.filter((r) => r.kind === "page")
  const apiRoutes = ov.routes.filter((r) => r.kind === "api")
  const pageByPath = new Map(pageRoutes.map((r) => [r.path, r]))

  // ---------- 分配路由树（按页面分组：页面与其用到的接口同级展示） ----------
  // 归属规则由后端下发（notelab-java model/RouteGroups）：页面节点下挂自己的接口模块（r.modules）；
  // 多页面共用的模块（爬塔/摸金）按 r.menu_group 挂到菜单分组；没归属的落「系统通用」。
  // ⚠️ 模块键（r.module）、展示名（r.module_name）、归属（r.modules / r.menu_group）全部来自后端 ——
  //    本页不持有任何映射表，避免「两端各写一半」的静默失配。
  const byModule = new Map<string, Route[]>()
  for (const r of apiRoutes) {
    const m = r.module || "base"
    if (!byModule.has(m)) byModule.set(m, [])
    byModule.get(m)!.push(r)
  }
  const consumedModules = new Set<string>()
  const superOnlySet = new Set(apiRoutes.filter(isSuperOnly).map((r) => r.code))
  /** 多页面共用的接口模块 → 所属菜单分组（后端 RouteGroups.SHARED_MODULES 下发） */
  const sharedByGroup = new Map<string, string[]>()
  for (const r of apiRoutes) {
    if (!r.menu_group || !r.module) continue
    const arr = sharedByGroup.get(r.menu_group) || []
    if (!arr.includes(r.module)) arr.push(r.module)
    sharedByGroup.set(r.menu_group, arr)
  }

  const apiNode = (r: Route) => {
    const locked = isSuperOnly(r)
    return {
      title: (
        <span className={`text-xs font-mono ${locked ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          {locked ? "🔒 " : ""}
          {/* ⚠️ 方法单独上色：同一 URL 的 GET/POST 现在是**两条独立权限码**（可分别授权），
              纯文字前缀在长列表里容易看漏，配色让「这条是读还是写」一眼分清。 */}
          <Tag color={methodColor(r.method)} className="!mx-0 !px-1 !text-[10px] !leading-4">{r.method}</Tag>
          {" "}{r.path}
          {locked && <span className="ml-1.5 font-sans not-italic">仅超管</span>}
        </span>
      ),
      key: r.code,
      selectable: false,
      // 后端会拒绝授予；这里禁掉复选框，让「不能勾」在动手前就看得见
      disableCheckbox: locked,
    }
  }
  /** 接口模块节点（同时登记「已消费」，避免同一模块重复出现在树里 → key 冲突） */
  const moduleNode = (m: string) => {
    consumedModules.add(m)
    const rs = byModule.get(m) || []
    const allLocked = rs.length > 0 && rs.every(isSuperOnly)
    const label = rs[0]?.module_name || m
    return {
      title: (
        <span className={`text-xs ${allLocked ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {allLocked ? "🔒" : "🔌"} {label} · {rs.length} 条
        </span>
      ),
      key: `grp:mod:${m}`, selectable: false,
      disableCheckbox: allLocked,
      children: rs.map(apiNode),
    }
  }
  /** 页面节点可挂的模块（后端下发的归属，跳过已被别的页面/分组挂掉的） */
  const modsFor = (path: string) =>
    (pageByPath.get(path)?.modules || []).filter((m) => !consumedModules.has(m) && byModule.has(m))

  // 勾选父节点即全选子节点；onCheck 时过滤掉非路由 key（路由 code 均以 page:/api: 开头）
  function menuNodes(items: MenuItem[]): any[] {
    const nodes: any[] = []
    for (const it of items) {
      if (it.children?.length) {
        const kids = menuNodes(it.children)
        // 多页面共用的接口模块挂在本分组上（如爬塔 8 页共用 spire-content）
        const shared = (sharedByGroup.get(it.key) || []).filter((m) => !consumedModules.has(m) && byModule.has(m))
        if (shared.length) {
          kids.unshift({
            title: "🔌 本组共用接口", key: `grp:shared:${it.key}`, selectable: false,
            children: shared.map(moduleNode),
          })
        }
        if (kids.length) nodes.push({ title: `${it.icon || ""} ${it.name}`, key: `grp:menu:${it.key}`, selectable: false, children: kids })
      } else if (it.path) {
        const r = pageByPath.get(it.path)
        if (r) {
          consumedPage.add(r.code)
          const mods = modsFor(it.path)
          nodes.push({
            title: <span><span className="text-sm text-zinc-700 dark:text-zinc-200">{r.name}</span><span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono ml-1.5">{r.path}</span></span>,
            key: r.code, selectable: false,
            children: mods.length ? mods.map(moduleNode) : undefined,
          })
        }
      }
    }
    return nodes
  }
  const consumedPage = new Set<string>()
  const topKeys: string[] = []
  const routeTree: any[] = []
  for (const g of menuNodes(menu)) { routeTree.push(g); topKeys.push(g.key) }

  const orphanPages = pageRoutes.filter((r) => !consumedPage.has(r.code)).map((r) => ({
    title: <span><span className="text-sm text-zinc-700 dark:text-zinc-200">{r.name}</span><span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono ml-1.5">{r.path}</span></span>,
    key: r.code, selectable: false,
    children: modsFor(r.path).length ? modsFor(r.path).map(moduleNode) : undefined,
  }))
  if (orphanPages.length) {
    routeTree.push({ title: "📦 未挂菜单的页面", key: "grp:page:orphan", selectable: false, children: orphanPages })
    topKeys.push("grp:page:orphan")
  }

  // 没归属到任何页面的接口：/api/c/** 豁免鉴权单独一组，其余进「系统通用」
  const cRoutes = consumedModules.has("c") ? [] : byModule.get("c") || []
  if (cRoutes.length) consumedModules.add("c")
  const sysMods = [...byModule.keys()].filter((m) => !consumedModules.has(m))
  if (cRoutes.length) {
    routeTree.push({
      title: `🌐 C 端开放接口（PermGuard 豁免，无需分配）· ${cRoutes.length} 条`,
      key: "grp:root:capi", selectable: false, children: cRoutes.map(apiNode),
    })
    topKeys.push("grp:root:capi")
  }
  if (sysMods.length) {
    routeTree.push({
      title: "⚙️ 系统通用接口（登录/会话等，全角色建议全选）",
      key: "grp:root:sys", selectable: false, children: sysMods.map(moduleNode),
    })
    topKeys.push("grp:root:sys")
  }

  // 成员管理用的派生数据：账户全量来自 overview 的 users（本来就为算成员数而拉），按 role 切成两半
  const roleLabel = (c: string) => ov.roles.find((r) => r.code === c)?.name || c
  const memKw = memQ.trim().toLowerCase()
  const hitKw = (u: User) => !memKw || u.username.toLowerCase().includes(memKw)
    || String(u.email || "").toLowerCase().includes(memKw)
  const groupMembers = managing ? ov.users.filter((u) => u.role === managing.code) : []
  const nonMembers = managing ? ov.users.filter((u) => u.role !== managing.code) : []
  const memberCols = [
    {
      title: "用户名", dataIndex: "username",
      render: (v: string, u: User) => (
        <Space size={6}>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{v}</span>
          {u.id === ov.me.id && <Tag color="processing">我</Tag>}
          {u.role === ROLE_SUPER_ADMIN && <Tag color="gold">👑 超管</Tag>}
          {u.role === ROLE_EXTERNAL && <Tag color="cyan">🏷️ 外部</Tag>}
        </Space>
      ),
    },
    { title: "邮箱", dataIndex: "email", width: 190, render: (v: string | null) => <span className="text-zinc-500 dark:text-zinc-400">{v || "—"}</span> },
    { title: "当前用户组", dataIndex: "role", width: 140, render: (c: string) => <Tag color="blue">{roleLabel(c)}</Tag> },
  ]

  const columns = [
    {
      title: "角色组", dataIndex: "name",
      render: (_: any, r: Role) => (
        <Space size={6}>
          <span>{roleIcon(r.code)}</span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.name}</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">{r.code}</span>
          {isBuiltinRole(r.code) && <Tag>内置</Tag>}
        </Space>
      ),
    },
    { title: "成员数", width: 110, render: (_: any, r: Role) => <Tag>👤 {memberCount(r.code)} 名</Tag> },
    {
      title: "路由授权", width: 150,
      render: (_: any, r: Role) => r.code === ROLE_SUPER_ADMIN
        ? <Tag color="gold">全部路由</Tag>
        : <Tag color="blue">🧭 {r.route_codes.length} 条</Tag>,
    },
    {
      title: "说明", dataIndex: "code",
      render: (code: string) => <span className="text-xs text-zinc-400 dark:text-zinc-500">{roleHint(code)}</span>,
    },
    actionColumn((_: any, r: Role) => r.code === ROLE_SUPER_ADMIN ? null : (
      <Space size={4}>
        <Button size="small" type="primary" ghost icon={<ShieldCheck size={13} />} onClick={() => openAssign(r)}>分配路由</Button>
        {/* 内置「普通用户」组不给批量入口：它的成员 = 所有未分到其它组的人，且「移出普通用户」无处可去，
            变更内置组成员请去「账户管理」用单人或批量设置 */}
        {r.code !== ROLE_USER && (
          <Button size="small" type="text" icon={<Users size={13} />} onClick={() => openMembers(r)}>成员</Button>
        )}
        <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => { setRenaming(r); setRenameVal(r.name) }}>重命名</Button>
        {/* 内置角色组不提供删除入口（后端也会拒）—— external 与 user 同属内置 */}
        {!isBuiltinRole(r.code) && (
          <Popconfirm title="删除角色组"
            description={`删除角色组「${r.name}」？${memberCount(r.code) > 0 ? `其下 ${memberCount(r.code)} 名成员将并入「普通用户」。` : ""}该操作不可恢复。`}
            okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeRole(r)}>
            <Button size="small" type="text" danger>删除</Button>
          </Popconfirm>
        )}
      </Space>
    ), 330),
  ]

  return (
    <AdminPage title="角色组管理（B端）" description="给 B 端角色分配 B 端路由组后，成员菜单即时生效；C 端另有「C端用户管理 → 用户组」。">
      <div className="flex items-center gap-2">
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>创建角色组</Button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">共 {ov.roles.length} 个角色组 · 给角色分配路由组后，成员菜单即时生效</span>
      </div>

      <DataTable size="middle" rowKey="code" columns={columns as any} dataSource={ov.roles} pagination={false} />

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

      {/* 分配路由（按页面分组：页面与其接口同级，勾页面连带勾接口） */}
      {assigning && (
        <Modal open onCancel={() => { if (!busy) setAssigning(null) }} title={`🛡️ 分配路由 · ${assigning.name}`} width={880}
          okText={`保存路由组（已选 ${draft.length}）`} cancelText="取消" confirmLoading={busy} onOk={saveRoutes} maskClosable={false}>
          <div className="mt-2">
            <Tree checkable defaultExpandAll={false} defaultExpandedKeys={topKeys} height={460} treeData={routeTree}
              checkedKeys={draft}
              onCheck={(keys) => {
                const arr = Array.isArray(keys) ? keys : keys.checked
                // 只留真正的权限码，并**剔除「仅超管」的码** —— antd 勾父节点会把禁勾的子节点
                // 也带进 checkedKeys，不剔的话草稿里会混进后端必然拒绝的码（保存后静默消失）
                setDraft(arr
                  .filter((k) => String(k).startsWith("page:") || String(k).startsWith("api:"))
                  .filter((k) => !superOnlySet.has(String(k))) as string[])
              }} />
            <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              按页面分组：展开页面即见它用到的接口，<b>勾选页面会连同接口一起勾上</b>（可单独取消）；
              爬塔/摸金等共用的接口挂在其分组节点上。共 {ov.routes.length} 条路由 · 已勾选 {draft.length} 条
            </div>
            {/* B/C 分流：本页只下发 B 端路由，C 端那套在 C 端用户管理页（按 c_user_groups 分配） */}
            <div className="mt-1 text-xs text-cyan-700 dark:text-cyan-400">
              本页只配置 <b>B 端后台</b>的页面与接口。C 端页面和 <span className="font-mono">/api/c/**</span> 接口
              请到「C端用户管理 → 用户组 → 分配路由」配置 —— 两端身份体系不同，交叉配置不生效。
            </div>
            {/* 2026-09-27 起接口层是「默认拒绝」，api:* 真正生效。说明两件容易被误解的事。 */}
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              后端按「默认拒绝」校验 api 权限：没勾选的接口会被 403 拦下。注意<b>普通用户组（user）的 api 权限由后端每次启动时自动重算</b>
              （🔒 仅超管的那些不给，其余全给），在这里手工改的 api 勾选会在重启后被覆盖；
              页面路由（page:*）不受影响，任意调整都会被保留。
            </div>
            {roleAssignNotice(assigning.code) && (
              <div className="mt-2 text-xs text-cyan-700 dark:text-cyan-400">{roleAssignNotice(assigning.code)}</div>
            )}
            {/* 仅超管的接口：四道防线（后端拒绝授予 + 启动收回历史授予 + denyReason 兜底 + 这里禁勾） */}
            {superOnlySet.size > 0 && (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                🔒 <b>仅超管</b>的接口（共 {superOnlySet.size} 条：运营与运维、权限管理、C端用户管理、数据看板、界面配置等）
                一律不可分配 —— 它们后端自带零超管校验，给出去等于送权限。节点已锁定、保存时也会被后端拒绝。
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 成员管理（批量加/移） */}
      {managing && (
        <Modal open onCancel={() => { if (!busy) setManaging(null) }}
          title={<span>👥 管理成员 · {managing.name}<span className="ml-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{managing.code}</span></span>}
          width={680}
          okText={addIds.length + removeIds.length ? `保存（加入 ${addIds.length} · 移出 ${removeIds.length}）` : "保存"}
          okButtonProps={{ disabled: addIds.length + removeIds.length === 0 }}
          cancelText="取消" confirmLoading={busy} onOk={saveMembers} maskClosable={false}>
          <Tabs activeKey={memTab} onChange={(k) => setMemTab(k as "add" | "current")} items={[
            { key: "add", label: `➕ 添加成员（可选 ${nonMembers.length}）` },
            { key: "current", label: `👥 当前成员（${groupMembers.length}）` },
          ]} />
          <Input.Search placeholder="搜索用户名 / 邮箱" allowClear value={memQ}
            onChange={(e) => setMemQ(e.target.value)} className="mb-2" />
          {memTab === "add" ? (
            <Table rowKey="id" size="small" columns={memberCols as any} dataSource={nonMembers.filter(hitKw)}
              pagination={false} scroll={{ y: 300 }} locale={{ emptyText: "没有可加入的账户（所有人都已在本组）" }}
              rowSelection={{ selectedRowKeys: addIds, onChange: (ks) => setAddIds(ks as number[]) }} />
          ) : (
            <Table rowKey="id" size="small" columns={memberCols as any} dataSource={groupMembers.filter(hitKw)}
              pagination={false} scroll={{ y: 300 }} locale={{ emptyText: "本组暂无成员" }}
              rowSelection={{ selectedRowKeys: removeIds, onChange: (ks) => setRemoveIds(ks as number[]) }} />
          )}
          <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            一个账户只属于一个用户组，故「加入本组」= 从原组移到本组；被移出的成员统一并入「普通用户」。
          </div>
        </Modal>
      )}
    </AdminPage>
  )
}
