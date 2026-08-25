"use client"
// 权限管理（antd 版）：路由组总览 + C 端用户管理直达入口
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Table, Tag, Button, Card, Result } from "antd"
import { Users } from "lucide-react"
import { apiJson } from "@/lib/api"

type Route = { code: string; path: string; method: string; kind: string; name: string }
type Role = { code: string; name: string; route_codes: string[] }
type User = { id: number; username: string; email: string | null; role: string; created_at: string }
type Overview = { me: { id: number; username: string; role: string }; routes: Route[]; roles: Role[]; users: User[] }

export default function PermPage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(() => {
    apiJson<Overview>("/api/perm/overview")
      .then(setOv)
      .catch((e) => { if (String(e.message).includes("403")) setDenied(true) })
  }, [])
  useEffect(() => { load() }, [load])

  if (denied) return <Result status="403" title="403" subTitle="此页面仅超级管理员可见，如需权限请联系管理员。" />
  if (!ov) return <div className="text-zinc-500">加载中...</div>

  const pageRoutes = ov.routes.filter((r) => r.kind === "page")
  const apiRoutes = ov.routes.filter((r) => r.kind === "api")

  const columns = [
    { title: "权限码", dataIndex: "code", width: 220, render: (v: string, r: Route) => <span className={`font-mono text-xs ${r.kind === "page" ? "text-indigo-600" : "text-zinc-500"}`}>{v}</span> },
    { title: "路由", dataIndex: "path", render: (v: string) => <span className="font-mono text-xs">{v}</span> },
    { title: "方法", dataIndex: "method", width: 90, render: (v: string, r: Route) => <span className="text-xs text-zinc-400">{r.kind === "page" ? "-" : v}</span> },
    { title: "类型", dataIndex: "kind", width: 80, render: (k: string) => k === "page" ? <Tag color="success">页面</Tag> : <Tag>API</Tag> },
    { title: "名称", dataIndex: "name", render: (v: string, r: Route) => <span className={`text-xs ${r.kind === "page" ? "" : "text-zinc-400"}`}>{v}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">权限路由表</h1>
        <Tag color="indigo">当前账户：{ov.me.username}（{ov.me.role === "super_admin" ? "超级管理员" : "普通用户"}）</Tag>
      </div>
      <p className="text-zinc-600 text-sm -mt-2">后端每次启动会采集所有 Controller 路由与页面路由写入权限路由表，新增功能路由重启即自动出现。账户与角色管理请前往「用户管理」菜单。</p>

      {/* C 端用户管理直达入口：后端菜单树（MenuTree 常量）暂无该项，前端在此提供入口 */}
      <Card size="small" className="shadow-sm border-indigo-200/70">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg">👥</span>
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold text-sm text-zinc-800">C 端用户管理</div>
            <div className="text-xs text-zinc-400">管理游戏中心（C 端）账号与用户组：新建/编辑/重置密码/停用，接口 /api/c-admin/*</div>
          </div>
          <Link href="/c-users">
            <Button type="primary" icon={<Users size={14} />}>前往 C 端用户管理</Button>
          </Link>
        </div>
      </Card>

      <Card size="small" className="shadow-sm"
        title={<span className="text-sm">🧭 权限路由表（共 {ov.routes.length} 条，启动时自动注册）</span>}>
        <Table rowKey="code" size="small" columns={columns as any}
          dataSource={[...pageRoutes, ...apiRoutes]} pagination={false} scroll={{ x: 720 }} />
        <p className="text-xs text-zinc-400 mt-2 mb-0">API 路由权限码已登记备用（当前仅页面路由参与菜单过滤；后续可基于权限码做接口级拦截）。</p>
      </Card>
    </div>
  )
}
