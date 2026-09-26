"use client"

// 爬塔尖塔内容工坊 · 外壳（所有子页共用）
//
// 职责边界：这里只做「共享状态 + 顶部动作条 + 页内面包屑 + 加载门」。
// **不再放 Tabs** —— 各功能已拆成左侧菜单树下的独立子页（见 notelab-java 的
// MenuTree.gc_spire / PageRoutes），页面内再放一套 Tab 会形成两套并行的导航。
//
// 关键约定：cards / characters / skills / charAccess / assets / maps 是**同一份文档**，
// 后端 POST /api/spire-content 整包覆盖写 —— 任何子页保存都会提交全部切片，
// 所以编辑哪一页都不会把别的页清空，但也意味着"保存"是全局动作。
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button, Popconfirm, Tag } from "antd"
import { Save, ExternalLink } from "lucide-react"
import { SpireStoreProvider, useSpire } from "./_shared/store"

/** 子页清单：顺序与 java 的 MenuTree.gc_spire **逐条一致**；这里只用于页内面包屑 */
export const SPIRE_PAGES: { href: string; label: string; icon: string }[] = [
  { href: "/spire-editor/cards", label: "卡片制作", icon: "🎴" },
  { href: "/spire-editor/chars", label: "角色制作", icon: "🧙" },
  { href: "/spire-editor/skills", label: "技能制作", icon: "⚡" },
  { href: "/spire-editor/assets", label: "素材资源", icon: "🧩" },
  { href: "/spire-editor/map", label: "地图生成", icon: "🗺️" },
  { href: "/spire-editor/access", label: "角色授权", icon: "👥" },
]

function Shell({ children }: { children: React.ReactNode }) {
  const { loaded, dirty, published, busy, pubBusy, save, publish, unpublish } = useSpire()
  const pathname = usePathname()
  const current = SPIRE_PAGES.find((p) => pathname === p.href || pathname.startsWith(p.href + "/"))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">爬塔尖塔 · 内容工坊</h1>
        <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 px-2.5 py-1 rounded-full">
          自定义内容保存后在「爬塔尖塔」游戏中生效
        </span>

        <div className="ml-auto flex items-center gap-2">
          {dirty && <Tag color="orange">有未保存改动</Tag>}
          {published === true && <Tag color="success">已发布到 C 端</Tag>}
          {published === false && <Tag>未发布</Tag>}
          <Button type="primary" icon={<Save size={14} />} onClick={save} loading={busy}>保存并应用</Button>
          <Button type="primary" ghost loading={pubBusy} onClick={publish}>发布到 C 端</Button>
          {published === true && (
            <Popconfirm title="取消发布" description="下架后 C 端爬塔回落为内置内容，确定下架？"
              okText="下架" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={unpublish}>
              <Button danger loading={pubBusy}>取消发布</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      {/* 页内面包屑：导航本身由左侧菜单承担，这里只帮用户确认"我在哪一页" */}
      <nav className="flex items-center gap-1 flex-wrap text-xs text-zinc-500 dark:text-zinc-400">
        {SPIRE_PAGES.map((p, i) => {
          const active = current?.href === p.href
          return (
            <span key={p.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
              <Link href={p.href}
                className={active
                  ? "rounded-md bg-zinc-900 px-2 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}>
                {p.icon} {p.label}
              </Link>
            </span>
          )
        })}
      </nav>

      {/* 加载门：数据未就绪时子页**根本不挂载**，子页因此可以假定 slices 已可用 */}
      {!loaded
        ? <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">加载中...</div>
        : children}
    </div>
  )
}

export default function SpireEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <SpireStoreProvider>
      <Shell>{children}</Shell>
    </SpireStoreProvider>
  )
}
