"use client"

// 账户管理（antd 版）：服务端分页 Table + Modal 表单（创建/编辑信息/重置密码）
import { useCallback, useEffect, useState } from "react"
import { api, apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"
import { Table, Modal, Form, Input, Select, Button, Tag, Popconfirm, Space } from "antd"
import { Plus, Pencil, KeyRound } from "lucide-react"

type Role = { code: string; name: string; route_codes: string[] }
type User = { id: number; username: string; email: string | null; role: string; created_at: string }
type Overview = { me: { id: number; username: string; role: string }; roles: Role[] }
type UsersPage = { items: User[]; total: number; page: number; size: number }

export default function UserAccountsPage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [denied, setDenied] = useState(false)
  // 分页状态（服务端分页）
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [loading, setLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [nu, setNu] = useState({ username: "", email: "", password: "", role: "user" })
  const [editing, setEditing] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ username: "", email: "" })
  const [pwdUser, setPwdUser] = useState<User | null>(null)
  const [pwd, setPwd] = useState("")
  const [busy, setBusy] = useState(false)

  const loadOverview = useCallback(() => {
    apiJson<Overview>("/api/perm/overview")
      .then(setOv)
      .catch((e) => { if (String(e.message).includes("403")) setDenied(true) })
  }, [])

  const fetchUsers = useCallback((p: number, s: number, kw: string, role: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), size: String(s) })
    if (kw.trim()) params.set("q", kw.trim())
    if (role) params.set("role", role)
    apiJson<UsersPage>(`/api/perm/users?${params.toString()}`)
      .then((d) => { setUsers(d.items || []); setTotal(d.total || 0) })
      .catch((e) => {
        if (String(e.message).includes("403")) setDenied(true)
        else toast.error(e.message || "加载账户失败")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { fetchUsers(page, pageSize, q, roleFilter) }, [page, pageSize, q, roleFilter, fetchUsers])

  /** 变更后刷新当前页；若删页后当前页为空则回退一页 */
  function refresh(opts?: { removedOne?: boolean; gotoLastPage?: boolean }) {
    if (opts?.gotoLastPage) {
      const last = Math.max(1, Math.ceil((total + 1) / pageSize))
      if (last === page) fetchUsers(page, pageSize, q, roleFilter)
      else setPage(last)
      return
    }
    if (opts?.removedOne && users.length <= 1 && page > 1) { setPage(page - 1); return }
    fetchUsers(page, pageSize, q, roleFilter)
  }

  const roleOptions = (ov?.roles || []).map((r) => ({ value: r.code, label: r.name }))

  async function createUser() {
    if (!nu.username || !nu.password) { toast.warning("用户名和密码必填"); return }
    setBusy(true)
    try {
      await postJson("/api/perm/users", nu)
      toast.success("账户已创建")
      setCreateOpen(false)
      setNu({ username: "", email: "", password: "", role: "user" })
      refresh({ gotoLastPage: true })
    } catch (e: any) { toast.error(e.message || "创建失败") }
    setBusy(false)
  }

  async function saveInfo() {
    if (!editing) return
    setBusy(true)
    try {
      await postJson(`/api/perm/users/${editing.id}/info`, editForm)
      toast.success("账户信息已更新")
      setEditing(null)
      refresh()
    } catch (e: any) { toast.error(e.message || "保存失败") }
    setBusy(false)
  }

  async function changeRole(u: User, role: string) {
    try {
      await postJson(`/api/perm/users/${u.id}/role`, { role })
      toast.success(`${u.username} 的角色已更新`)
      refresh()
    } catch (e: any) { toast.error(e.message || "修改失败"); refresh() }
  }

  /** 切换角色前二次确认 */
  function confirmChangeRole(u: User, role: string) {
    if (role === u.role) return
    const roleName = (code: string) => roleOptions.find((r) => r.value === code)?.label || code
    Modal.confirm({
      title: "切换角色组",
      content: `确定将「${u.username}」的角色从「${roleName(u.role)}」切换为「${roleName(role)}」吗？切换后该账户的菜单权限即时生效。`,
      okText: "确认切换",
      cancelText: "取消",
      onOk: () => changeRole(u, role),
    })
  }

  async function resetPwd() {
    if (!pwdUser) return
    if (pwd.length < 6) { toast.warning("密码至少 6 位"); return }
    setBusy(true)
    try {
      await postJson(`/api/perm/users/${pwdUser.id}/password`, { password: pwd })
      toast.success(`${pwdUser.username} 的密码已重置`)
      setPwdUser(null); setPwd("")
    } catch (e: any) { toast.error(e.message || "重置失败") }
    setBusy(false)
  }

  async function removeUser(u: User) {
    try { await api(`/api/perm/users/${u.id}`, { method: "DELETE" }); toast.success("账户已删除"); refresh({ removedOne: true }) }
    catch (e: any) { toast.error(e.message || "删除失败") }
  }

  if (denied) return <div className="card p-8 text-center text-zinc-500">🔒 此页面仅超级管理员可见</div>
  if (!ov) return <div className="text-zinc-500">加载中...</div>

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "用户名", dataIndex: "username",
      render: (_: any, u: User) => (
        <Space size={6}>
          <span className="font-medium text-zinc-800">{u.username}</span>
          {u.id === ov.me.id && <Tag color="processing">我</Tag>}
          {u.role === "super_admin" && <Tag color="gold">👑 超管</Tag>}
        </Space>
      ),
    },
    { title: "邮箱", dataIndex: "email", render: (v: string | null) => <span className="text-zinc-500">{v || "—"}</span> },
    {
      title: "角色", dataIndex: "role", width: 170,
      render: (_: any, u: User) => <Select size="small" value={u.role} onChange={(v) => confirmChangeRole(u, v)} options={roleOptions} className="w-36" />,
    },
    { title: "创建时间", dataIndex: "created_at", render: (v: string) => <span className="text-zinc-400 text-xs">{String(v || "").slice(0, 16)}</span> },
    {
      title: "操作", align: "right" as const, width: 200,
      render: (_: any, u: User) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => { setEditing(u); setEditForm({ username: u.username, email: u.email || "" }) }}>编辑</Button>
          <Button size="small" type="text" icon={<KeyRound size={13} />} onClick={() => { setPwdUser(u); setPwd("") }}>密码</Button>
          <Popconfirm title="删除账户" description={`删除账户「${u.username}」？该操作不可恢复。`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
            onConfirm={() => removeUser(u)} disabled={u.id === ov.me.id}>
            <Button size="small" type="text" danger disabled={u.id === ov.me.id}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>创建账户</Button>
        <Input.Search placeholder="搜索用户名/邮箱" allowClear style={{ width: 220 }}
          onSearch={(v) => { setQ(v); setPage(1) }} />
        <Select placeholder="角色筛选" allowClear style={{ width: 150 }} value={roleFilter || undefined}
          onChange={(v) => { setRoleFilter(v || ""); setPage(1) }} options={roleOptions} />
        <span className="text-xs text-zinc-400">共 {total} 个账户 · 注册入口已关闭，统一由此建号</span>
      </div>

      <Table rowKey="id" size="middle" columns={columns as any} dataSource={users} loading={loading}
        className="card overflow-hidden [&_.ant-table]:bg-transparent"
        pagination={{
          current: page, pageSize, total,
          showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100],
          showTotal: (t) => `共 ${t} 个账户`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }} />

      {/* 创建账户 */}
      <Modal open={createOpen} onCancel={() => { if (!busy) setCreateOpen(false) }} title="➕ 创建账户"
        okText="创建" cancelText="取消" confirmLoading={busy} onOk={createUser} maskClosable={false}>
        <Form layout="vertical" className="mt-3">
          <Form.Item label="用户名" required extra="2-20 位字母/数字/下划线/中文">
            <Input placeholder="请输入用户名" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          </Form.Item>
          <Form.Item label="邮箱" extra="可选">
            <Input placeholder="name@example.com" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          </Form.Item>
          <Form.Item label="密码" required extra="至少 6 位">
            <Input.Password placeholder="设置登录密码" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          </Form.Item>
          <Form.Item label="角色">
            <Select value={nu.role} onChange={(v) => setNu({ ...nu, role: v })} options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑账户信息 */}
      {editing && (
        <Modal open onCancel={() => { if (!busy) setEditing(null) }} title={`✏️ 编辑账户 · ${editing.username}`}
          okText="保存" cancelText="取消" confirmLoading={busy} onOk={saveInfo} maskClosable={false}>
          <Form layout="vertical" className="mt-3">
            <Form.Item label="用户名" required>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
            </Form.Item>
            <Form.Item label="邮箱" extra="留空表示清除">
              <Input placeholder="name@example.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
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
              <Input.Password placeholder="输入新密码" value={pwd} onChange={(e) => setPwd(e.target.value)}
                onPressEnter={resetPwd} />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  )
}
