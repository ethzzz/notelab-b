"use client"
// B 端外壳（antd 版）：Layout = Header（用户信息/主题切换/退出）+ Sider（antd Menu，数据源 /api/menu）+ Content
// 认证守卫逻辑与 myapp 一致：/api/me 401 → rememberPath → /login
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Layout, Menu, Tag, Button, Modal, Drawer, Spin, Avatar, Space } from "antd"
import type { MenuProps } from "antd"
import { api, apiJson, rememberPath, clearRememberedPath } from "@/lib/api"
import { resolveBgStyle, themeById } from "@/lib/themes"
import ThemePicker from "@/components/ThemePicker"
import { Menu as MenuIcon, Palette, LogOut } from "lucide-react"

type MenuItem = { key: string; path?: string; ready?: boolean; name: string; icon: string; children?: MenuItem[] }

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [bg, setBg] = useState<any>(null)
  const [state, setState] = useState<"loading" | "ok" | "out">("loading")
  const [themeOpen, setThemeOpen] = useState(false)
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
        setBg(m.background || {})
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
      style={{ background: "transparent", borderInlineEnd: "none" }}
    />
  )

  // 主题背景铺满整个视口（Header 与侧边栏之下），元素以毛玻璃呈现
  const bgStyle = resolveBgStyle(bg)
  const curTheme = themeById(bg?.theme)
  const dark = !!curTheme?.dark

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Spin size="large" />
          <span className="text-sm font-medium">加载中...</span>
        </div>
      </div>
    )
  }
  if (state === "out") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-indigo-50">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-red-50/90 border border-red-200 text-red-600 text-sm font-medium px-6 py-3.5 rounded-2xl shadow-sm">⚠️ 登录状态不存在或已失效，正在跳转到登录页…</div>
          <Spin />
        </div>
      </div>
    )
  }
  if (state !== "ok" || !user) return null

  const isSuperAdmin = user.role === "super_admin"
  const avatarChar = String(user.username || "?").trim().charAt(0).toUpperCase()

  const siderMenuBox = (
    <div
      className="h-full overflow-y-auto rounded-2xl border backdrop-blur-md"
      style={dark
        ? { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" }
        : { background: "rgba(255,255,255,0.62)", borderColor: "rgba(0,0,0,0.05)" }}
    >
      <div className="px-3 pt-3 pb-1">
        <div className={`flex items-center gap-2 px-1 pb-2 ${dark ? "text-zinc-100" : "text-zinc-800"}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base shadow-md shadow-indigo-600/30">🧪</span>
          <span className="font-bold tracking-wide">NoteLab</span>
        </div>
      </div>
      {menuEl}
      <div className={`px-4 pb-3 pt-2 text-[10px] ${dark ? "text-zinc-500" : "text-zinc-400"}`}>🧪 NoteLab · AI 试验后台</div>
    </div>
  )

  return (
    <div className={`min-h-screen ${dark ? "theme-dark" : ""}`} style={bgStyle}>
      <Layout style={{ background: "transparent", minHeight: "100vh" }}>
        {/* 顶部 Header：毛玻璃，用户信息在右上角 */}
        <Layout.Header
          className="!fixed !top-0 !inset-x-0 z-[60] flex items-center gap-3 !px-3 md:!px-5 border-b backdrop-blur-md"
          style={{
            height: 56, lineHeight: "56px",
            background: dark ? "rgba(10,10,20,0.35)" : "rgba(255,255,255,0.55)",
            borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          }}
        >
          <Button
            className="md:!hidden"
            type="text"
            icon={<MenuIcon size={18} className={dark ? "text-zinc-100" : "text-zinc-700"} />}
            onClick={() => setDrawerOpen(true)}
            aria-label="菜单"
          />
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base shadow-md shadow-indigo-600/30">🧪</span>
            <span className={`font-bold tracking-wide whitespace-nowrap ${dark ? "text-zinc-100" : "text-zinc-800"}`}>NoteLab</span>
            <span className={`hidden lg:inline text-[10px] rounded-full px-2.5 py-1 whitespace-nowrap border ${dark ? "text-zinc-300 bg-white/10 border-white/10" : "text-zinc-500 bg-black/[0.04] border-black/5"}`}>AI 试验后台 · B 端</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <Button
              type="text"
              title={curTheme ? `主题风格 · ${curTheme.name}` : "主题风格"}
              icon={<Palette size={18} className={dark ? "text-zinc-100" : "text-zinc-700"} />}
              onClick={() => setThemeOpen(true)}
            />
            <div className={`flex items-center gap-2 rounded-xl border py-1 pl-2 pr-3 min-w-0 ${dark ? "bg-white/10 border-white/10" : "bg-white/70 border-black/5 shadow-sm"}`}>
              <Avatar size={24} style={{ background: "linear-gradient(135deg,#818cf8,#8b5cf6)", fontSize: 11, fontWeight: 700 }}>{avatarChar}</Avatar>
              <span className={`hidden sm:block truncate max-w-[8rem] text-sm font-medium ${dark ? "text-zinc-100" : "text-zinc-800"}`}>{user.username}</span>
              {isSuperAdmin && (
                <Tag color="purple" className="!m-0 hidden md:inline-block">超级管理员</Tag>
              )}
            </div>
            <Button
              icon={<LogOut size={14} />}
              onClick={logout}
              className={dark ? "!text-zinc-200" : "!text-zinc-600"}
            >
              退出
            </Button>
          </div>
        </Layout.Header>

        {/* 桌面端侧边栏（md 及以上） */}
        <div className="hidden md:block fixed left-0 top-14 bottom-0 w-60 z-50 p-3">
          {siderMenuBox}
        </div>

        {/* 移动端抽屉菜单 */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={264}
          styles={{ body: { padding: 12, background: dark ? "#101018" : "#f6f7f9" } }}
          closeIcon={null}
        >
          {siderMenuBox}
        </Drawer>

        {/* 主内容区 */}
        <Layout style={{ background: "transparent" }}>
          <Layout.Content className="md:!ml-60 pt-14 min-w-0" style={{ minHeight: "100vh" }}>
            <div className="p-4 md:p-6">{children}</div>
          </Layout.Content>
        </Layout>
      </Layout>

      {/* 主题选择弹窗（沿用 /api/ui-config 写 background） */}
      <Modal
        open={themeOpen}
        onCancel={() => setThemeOpen(false)}
        footer={null}
        width={520}
        title="🎨 主题风格"
        destroyOnHidden
      >
        <ThemePicker current={bg?.theme} onApplied={(b) => setBg(b)} onClose={() => setThemeOpen(false)} />
      </Modal>
    </div>
  )
}
