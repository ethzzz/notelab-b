"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { apiJson } from "@/lib/api"

const ICON_BG = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-indigo-500",
  "from-lime-500 to-green-500",
  "from-cyan-500 to-sky-500",
  "from-fuchsia-500 to-purple-500",
]

export default function DashboardPage() {
  const [menu, setMenu] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    apiJson("/api/me").then(setUser).catch(() => {})
    apiJson("/api/menu").then((m) => setMenu(m.menu || [])).catch(() => {})
  }, [])
  const ready = menu.filter((m) => m.ready && m.path !== "/")
  return (
    <div className="w-full flex flex-col gap-6">
      {/* 欢迎横幅 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-7 text-white shadow-lg shadow-indigo-600/20">
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-32 -bottom-16 h-40 w-40 rounded-full bg-white/10 blur-xl" />
        <h1 className="text-2xl font-bold relative">你好{user ? `，${user.username}` : ""} 👋</h1>
        <p className="mt-1.5 text-sm text-white/85 relative">欢迎来到 NoteLab —— 你的 AI 试验台与学习沙盒，左侧菜单逐个试玩。</p>
      </div>
      {/* 功能入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {ready.map((m, i) => (
          <Link key={m.key} href={m.path} className="card card-hover group p-5 flex items-start gap-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${ICON_BG[i % ICON_BG.length]} text-xl shadow-md`}>{m.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
                {m.name}
                <span className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 text-indigo-500">→</span>
              </span>
              <span className="block text-sm text-zinc-600 mt-1">点击进入</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
