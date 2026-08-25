"use client"
// C 端用户管理（B/C 拆分阶段4新增页）：接口全走 /api/c-admin/*（契约以 CAdminController 为准）
// 说明：后端菜单树（Java MenuTree 常量）暂无本页面菜单项，入口由「权限管理」页提供（不改 Java 代码）
import { useCallback, useEffect, useState } from "react"
import {
  Tabs, Table, Button, Input, Select, Tag, Modal, Form, Space, Popconfirm, Card,
} from "antd"
import { Plus, Pencil, KeyRound, Users } from "lucide-react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type CUser = { id: number; username: string; nickname: string; group_code: string; status: string; created_at: string }
type CGroup = { code: string; name: string; created_at: string; member_count: number }

export default function CUsersPage() {
  const [tab, setTab] = useState("users")

  // ---------------- 用户 ----------------
  const [users, setUsers] = useState<CUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const [groups, setGroups] = useState<CGroup[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [nu, setNu] = useState({ username: "", password: "", nickname: "", group_code: "default" })
  const [editing, setEditing] = useState<CUser | null>(null)
  const [editForm, setEditForm] = useState({ nickname: "", group_code: "default", status: "active" })
  const [pwdUser, setPwdUser] = useState<CUser | null>(null)
  const [pwd, setPwd] = useState("")
  const [busy, setBusy] = useState(false)

  const loadGroups = useCallback(() => {
    apiJson("/api/c-admin/groups").then((j) => setGroups(j.items || [])).catch(() => {})
  }, [])

  const fetchUsers = useCallback((p: number, s: number, kw: string, g?: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(s), offset: String((p - 1) * s) })
    if (kw.trim()) params.set("q", kw.trim())
    if (g) params.set("group_code", g)
    apiJson(`/api/c-admin/users?${params.toString()}`)
      .then((j) => { setUsers(j.items || []); setTotal(j.total || 0) })
      .catch((e) => toast.error(e.message || "加载用户失败"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => { fetchUsers(page, pageSize, q, groupFilter) }, [page, pageSize, q, groupFilter, fetchUsers])

  /** 变更后刷新当前页；删页后当前页为空则回退一页 */
  function refresh(removedOne = false) {
    if (removedOne && users.length <= 1 && page > 1) { setPage(page - 1); return }
    fetchUsers(page, pageSize, q, groupFilter)
    loadGroups() // member_count 可能变化
  }

  async function createUser() {
    if (!nu.username.trim() || !nu.password) { toast.warning("用户名和密码必填"); return }
    setBusy(true)
    try {
      await postJson("/api/c-admin/users", nu)
      toast.success("C 端账户已创建")
      setCreateOpen(false)
      setNu({ username: "", password: "", nickname: "", group_code: "default" })
      refresh()
    } catch (e: any) { toast.error(e.message || "创建失败") }
    setBusy(false)
  }

  async function saveEdit() {
    if (!editing) return
    setBusy(true)
    try {
      await apiJson(`/api/c-admin/users/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      toast.success("用户信息已更新")
      setEditing(null)
      refresh()
    } catch (e: any) { toast.error(e.message || "保存失败") }
    setBusy(false)
  }

  async function resetPwd() {
    if (!pwdUser) return
    if (pwd.length < 6) { toast.warning("密码至少 6 位"); return }
    setBusy(true)
    try {
      await postJson(`/api/c-admin/users/${pwdUser.id}/reset-password`, { password: pwd })
      toast.success(`「${pwdUser.username}」密码已重置`)
      setPwdUser(null); setPwd("")
    } catch (e: any) { toast.error(e.message || "重置失败") }
    setBusy(false)
  }

  async function removeUser(u: CUser) {
    try {
      await api(`/api/c-admin/users/${u.id}`, { method: "DELETE" })
      toast.success("用户已删除")
      refresh(true)
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  const groupName = (code: string) => groups.find((g) => g.code === code)?.name || code

  const userColumns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "用户名", dataIndex: "username", width: 160,
      render: (v: string) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{v}</span>,
    },
    { title: "昵称", dataIndex: "nickname", render: (v: string) => v || <span className="text-zinc-400 dark:text-zinc-500">—</span> },
    {
      title: "用户组", dataIndex: "group_code", width: 140,
      render: (v: string) => <Tag>{groupName(v)}<span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] ml-1">{v}</span></Tag>,
    },
    {
      title: "状态", dataIndex: "status", width: 90,
      render: (s: string) => s === "active" ? <Tag color="success">启用</Tag> : <Tag color="error">停用</Tag>,
    },
    {
      title: "创建时间", dataIndex: "created_at", width: 150,
      render: (v: string) => <span className="text-xs text-zinc-400 dark:text-zinc-500">{String(v || "").slice(0, 16)}</span>,
    },
    {
      title: "操作", align: "right" as const, width: 210,
      render: (_: any, u: CUser) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<Pencil size={13} />}
            onClick={() => { setEditing(u); setEditForm({ nickname: u.nickname || "", group_code: u.group_code, status: u.status }) }}>
            编辑
          </Button>
          <Button size="small" type="text" icon={<KeyRound size={13} />} onClick={() => { setPwdUser(u); setPwd("") }}>
            重置密码
          </Button>
          <Popconfirm title="删除用户" description={`删除 C 端用户「${u.username}」？该操作不可恢复。`}
            okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeUser(u)}>
            <Button size="small" type="text" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ---------------- 用户组 ----------------
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [ng, setNg] = useState({ code: "", name: "" })
  const [renaming, setRenaming] = useState<CGroup | null>(null)
  const [renameVal, setRenameVal] = useState("")

  async function createGroup() {
    if (!ng.code.trim() || !ng.name.trim()) { toast.warning("用户组编码和名称必填"); return }
    setBusy(true)
    try {
      await postJson("/api/c-admin/groups", ng)
      toast.success("用户组已创建")
      setGroupCreateOpen(false); setNg({ code: "", name: "" })
      loadGroups()
    } catch (e: any) { toast.error(e.message || "创建失败") }
    setBusy(false)
  }

  async function saveRename() {
    if (!renaming) return
    setBusy(true)
    try {
      await apiJson(`/api/c-admin/groups/${renaming.code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameVal }),
      })
      toast.success("用户组已重命名")
      setRenaming(null)
      loadGroups()
    } catch (e: any) { toast.error(e.message || "重命名失败") }
    setBusy(false)
  }

  async function removeGroup(g: CGroup) {
    try {
      await api(`/api/c-admin/groups/${g.code}`, { method: "DELETE" })
      toast.success("用户组已删除")
      loadGroups()
    } catch (e: any) { toast.error(e.message || "删除失败") }
  }

  const groupColumns = [
    { title: "编码", dataIndex: "code", width: 160, render: (v: string) => <span className="font-mono text-xs">{v}</span> },
    { title: "名称", dataIndex: "name", render: (v: string, g: CGroup) => <span className="font-medium">{v}{g.code === "default" && <Tag className="!ml-2">默认</Tag>}</span> },
    { title: "成员数", dataIndex: "member_count", width: 110, render: (n: number) => <Tag>👤 {n} 名</Tag> },
    {
      title: "创建时间", dataIndex: "created_at", width: 150,
      render: (v: string) => <span className="text-xs text-zinc-400 dark:text-zinc-500">{String(v || "").slice(0, 16)}</span>,
    },
    {
      title: "操作", align: "right" as const, width: 170,
      render: (_: any, g: CGroup) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => { setRenaming(g); setRenameVal(g.name) }}>重命名</Button>
          {g.code !== "default" && (
            <Popconfirm title="删除用户组" description={`删除用户组「${g.name}」？组内有成员时不可删除。`}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeGroup(g)}>
              <Button size="small" type="text" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">C 端用户管理</h1>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">管理游戏中心（C 端）账号 · 接口 /api/c-admin/*</span>
      </div>

      <Card size="small" className="shadow-sm">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: "users",
              label: <span>👤 C 端用户（{total}）</span>,
              children: (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input.Search allowClear placeholder="搜索用户名 / 昵称" style={{ width: 240 }}
                      onSearch={(v) => { setPage(1); setQ(v) }} />
                    <Select allowClear placeholder="全部用户组" style={{ width: 180 }}
                      value={groupFilter}
                      onChange={(v) => { setPage(1); setGroupFilter(v) }}
                      options={groups.map((g) => ({ value: g.code, label: `${g.name}（${g.code}）` }))} />
                    <Button type="primary" icon={<Plus size={14} />} className="ml-auto" onClick={() => setCreateOpen(true)}>
                      新建 C 端用户
                    </Button>
                  </div>
                  <Table rowKey="id" size="middle" columns={userColumns as any} dataSource={users} loading={loading}
                    pagination={{
                      current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 名用户`,
                      onChange: (p, s) => { setPage(p); setPageSize(s) },
                    }} />
                </div>
              ),
            },
            {
              key: "groups",
              label: <span><Users size={13} className="inline mr-1" />用户组（{groups.length}）</span>,
              children: (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <Button type="primary" icon={<Plus size={14} />} onClick={() => setGroupCreateOpen(true)}>新建用户组</Button>
                  </div>
                  <Table rowKey="code" size="middle" columns={groupColumns as any} dataSource={groups} pagination={false} />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 新建用户 */}
      <Modal open={createOpen} onCancel={() => { if (!busy) setCreateOpen(false) }} title="➕ 新建 C 端用户"
        okText="创建" cancelText="取消" confirmLoading={busy} onOk={createUser} maskClosable={false}>
        <Form layout="vertical" className="mt-3">
          <Form.Item label="用户名" required extra="2-20 位字母/数字/下划线/中文">
            <Input placeholder="如：player01" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          </Form.Item>
          <Form.Item label="密码" required extra="至少 6 位">
            <Input.Password placeholder="初始密码" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          </Form.Item>
          <Form.Item label="昵称">
            <Input placeholder="可选，游戏中展示" value={nu.nickname} onChange={(e) => setNu({ ...nu, nickname: e.target.value })} />
          </Form.Item>
          <Form.Item label="用户组">
            <Select value={nu.group_code} onChange={(v) => setNu({ ...nu, group_code: v })}
              options={groups.map((g) => ({ value: g.code, label: `${g.name}（${g.code}）` }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 */}
      {editing && (
        <Modal open onCancel={() => { if (!busy) setEditing(null) }} title={`✏️ 编辑用户 · ${editing.username}`}
          okText="保存" cancelText="取消" confirmLoading={busy} onOk={saveEdit} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="昵称">
              <Input value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} />
            </Form.Item>
            <Form.Item label="用户组">
              <Select value={editForm.group_code} onChange={(v) => setEditForm({ ...editForm, group_code: v })}
                options={groups.map((g) => ({ value: g.code, label: `${g.name}（${g.code}）` }))} />
            </Form.Item>
            <Form.Item label="状态">
              <Select value={editForm.status} onChange={(v) => setEditForm({ ...editForm, status: v })}
                options={[{ value: "active", label: "启用" }, { value: "disabled", label: "停用" }]} />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* 重置密码 */}
      {pwdUser && (
        <Modal open onCancel={() => { if (!busy) setPwdUser(null) }} title={`🔑 重置密码 · ${pwdUser.username}`}
          okText="重置" cancelText="取消" confirmLoading={busy} onOk={resetPwd} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="新密码" required extra="至少 6 位">
              <Input.Password value={pwd} onChange={(e) => setPwd(e.target.value)} onPressEnter={resetPwd} autoFocus />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* 新建用户组 */}
      <Modal open={groupCreateOpen} onCancel={() => { if (!busy) setGroupCreateOpen(false) }} title="➕ 新建用户组"
        okText="创建" cancelText="取消" confirmLoading={busy} onOk={createGroup} maskClosable={false}>
        <Form layout="vertical" className="mt-3">
          <Form.Item label="用户组编码" required extra="2-30 位小写字母/数字/下划线，创建后不可修改">
            <Input className="font-mono" placeholder="如：vip" value={ng.code} onChange={(e) => setNg({ ...ng, code: e.target.value })} />
          </Form.Item>
          <Form.Item label="用户组名称" required extra="1-20 字">
            <Input placeholder="如：VIP 玩家" value={ng.name} onChange={(e) => setNg({ ...ng, name: e.target.value })} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名用户组 */}
      {renaming && (
        <Modal open onCancel={() => { if (!busy) setRenaming(null) }} title={`✏️ 重命名用户组 · ${renaming.code}`}
          okText="保存" cancelText="取消" confirmLoading={busy} onOk={saveRename} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="用户组名称" required>
              <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onPressEnter={saveRename} autoFocus />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
