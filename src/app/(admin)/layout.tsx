"use client"
// B 端外壳（传统管理后台风）：antd Layout = 白底固定 Sider（Logo + Menu）+ 白底 Header（用户信息/退出）+ 浅灰内容区
// 认证守卫逻辑与 myapp 一致：/api/me 401 → rememberPath → /login；背景/主题不再参与外壳（由 /ui 页为 C 端管理）
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Layout, Menu, Tag, Button, Drawer, Spin, Avatar, Result } from "antd"
import type { MenuProps } from "antd"
import { api, apiJson, rememberPath, clearRememberedPath } from "@/lib/api"
import { Menu as MenuIcon, LogOut } from "lucide-react"

type MenuItem = { key: string; path?: string; ready?: boolean; name: string; icon: string; children?: MenuItem[] }

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [state, setState] = useState<"loading" | "ok" | "out">("loading")
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const me = await apiJson("/api/me")
        setUser(me)
      } catch {
        // 未登录或会话（token）失效：记录当前路由（登录后回跳），弹出提示后强制跳转登录页
        setState("out")
        rememberPath(window.location.pathname + window.location.search)
        setTimeout(() => router.replace("/login"), 1200)
        return
      }
      try {
        const m = await apiJson("/api/menu")
        setMenu(m.menu || [])
      } catch { /* 外壳配置失败不阻断 */ }
      setState("ok")
    })()
  }, [router])

  async function logout() {
    try { await api("/api/logout", { method: "POST" }) } catch { /* ignore */ }
    clearRememberedPath()
    router.replace("/login")
  }

  // /api/menu 树 → antd Menu items（分组 SubMenu 递归；ready=false 打 Tag 并禁用）
  const { items, allGroupKeys, selectedKey } = useMemo(() => {
    const groupKeys: string[] = []
    let sel = ""
    const toAntd = (nodes: MenuItem[]): MenuProps["items"] =>
      nodes.map((m) => {
        const icon = m.icon ? <span className="anticon inline-flex items-center justify-center text-base leading-none">{m.icon}</span> : undefined
        if (m.children) {
          groupKeys.push(m.key)
          return { key: m.key, label: m.name, icon, children: toAntd(m.children) }
        }
        if (m.path === pathname || (m.path === "/" && pathname === "/dashboard")) sel = m.key
        if (!m.ready) {
          return {
            key: m.key, icon, disabled: true,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {m.name}
                <Tag className="!m-0" style={{ fontSize: 10, lineHeight: "16px", padding: "0 6px" }}>敬请期待</Tag>
              </span>
            ),
          }
        }
        return { key: m.key, icon, label: <Link href={m.path!} onClick={() => setDrawerOpen(false)}>{m.name}</Link> }
      })
    return { items: toAntd(menu), allGroupKeys: groupKeys, selectedKey: sel }
  }, [menu, pathname])

  const menuEl = (
    <Menu
      mode="inline"
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultOpenKeys={allGroupKeys}
      items={items}
      style={{ borderInlineEnd: "none" }}
    />
  )

  const logo = (
    <div className="flex items-center gap-2 px-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500 text-base text-white">🧪</span>
      <span className="font-bold tracking-wide text-zinc-800">NoteLab</span>
    </div>
  )

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Spin size="large" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    )
  }
  if (state === "out") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <Result
          status="warning"
          title="登录状态不存在或已失效"
          subTitle="正在跳转到登录页…"
          extra={<Spin />}
        />
      </div>
    )
  }
  if (state !== "ok" || !user) return null

  const isSuperAdmin = user.role === "super_admin"
  const avatarChar = String(user.username || "?").trim().charAt(0).toUpperCase()

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* 桌面端固定侧边栏（md 及以上）：白底 + Logo + 菜单 */}
      <Layout.Sider
        theme="light"
        width={220}
        className="!hidden md:!block !fixed !left-0 !top-0 !bottom-0 z-50 overflow-hidden"
        style={{ borderRight: "1px solid #f0f0f0" }}
      >
        <div className="flex h-14 items-center border-b border-zinc-100 px-4">{logo}</div>
        <div className="h-[calc(100vh-56px-34px)] overflow-y-auto py-2">{menuEl}</div>
        <div className="border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-400">🧪 NoteLab · AI 试验后台</div>
      </Layout.Sider>

      {/* 移动端抽屉菜单 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={256}
        styles={{ body: { padding: 0 } }}
        closeIcon={null}
      >
        <div className="flex h-14 items-center border-b border-zinc-100 px-4">{logo}</div>
        <div className="py-2">{menuEl}</div>
      </Drawer>

      {/* 右侧主区域 */}
      <Layout className="md:!ml-[220px]" style={{ background: "#f0f2f5" }}>
        {/* 顶部 Header：白底，左移动端菜单按钮，右用户信息 */}
        <Layout.Header
          className="!flex items-center gap-3 !bg-white !px-4 md:!px-6 border-b border-zinc-100"
          style={{ height: 56, lineHeight: "56px", position: "sticky", top: 0, zIndex: 40 }}
        >
          <Button
            className="md:!hidden"
            type="text"
            icon={<MenuIcon size={18} className="text-zinc-600" />}
            onClick={() => setDrawerOpen(true)}
            aria-label="菜单"
          />
          <span className="text-sm text-zinc-400 hidden sm:inline">AI 试验后台 · B 端管理</span>
          <div className="ml-auto flex items-center gap-2.5 min-w-0">
            <Avatar size={28} style={{ background: "#6366f1", fontSize: 12, fontWeight: 700 }}>{avatarChar}</Avatar>
            <span className="hidden sm:block truncate max-w-[9rem] text-sm text-zinc-700">{user.username}</span>
            {isSuperAdmin && <Tag color="purple" className="!m-0 hidden md:inline-block">超级管理员</Tag>}
            <Button type="text" icon={<LogOut size={15} className="text-zinc-500" />} onClick={logout}>
              退出
            </Button>
          </div>
        </Layout.Header>

        {/* 主内容区：浅灰背景 */}
        <Layout.Content style={{ background: "#f0f2f5", padding: "16px 16px 24px" }} className="md:!px-6">
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
