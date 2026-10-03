"use client"
// 游戏登录管理（仅超管）：哪些游戏需要登录才能玩，哪些可游客进入。
// 配置写入 ui_config.game_access（结构：{ [gameCode]: { requireLogin: boolean } }）。
// 游客可玩的游戏进度存 localStorage；需登录的游戏进度落 MySQL（见 notelab-c lib/gameSave.ts）。
import { useEffect, useState } from "react"
import { Button, Card, Switch, Spin, Tag } from "antd"
import { apiJson, postJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type AccessMap = Record<string, { requireLogin: boolean }>

// 全部 C 端游戏（可扩展：新增游戏在此追加一行即可）
const GAMES: { code: string; name: string; desc: string }[] = [
  { code: "thunder", name: "雷霆战机", desc: "纵向射击，躲弹 + 升级火力" },
  { code: "vs", name: "幸存者割草", desc: "吸血鬼幸存者风，自动开火割草" },
  { code: "trpg", name: "文字冒险", desc: "TRPG 分支剧情选择" },
  { code: "spire", name: "爬塔 Roguelike", desc: "杀戮尖塔风，三幕爬塔" },
  // 2026-10-03 补登记：地牢领主此前漏了（既不在本列表、也无 RequireAuth layout），无法配置登录要求
  { code: "dungeon", name: "地牢领主", desc: "地下城经营 + 英雄派遣放置" },
  { code: "loot", name: "摸金行动", desc: "搜刮撤离：进图摸金、风险博弈" },
]

export default function GameAccessPage() {
  const [config, setConfig] = useState<any>(null)
  const [access, setAccess] = useState<AccessMap>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiJson("/api/ui-config")
      .then((j) => {
        setConfig(j.config || {})
        const ga: AccessMap = {}
        const src = (j.config?.game_access as AccessMap) || {}
        for (const g of GAMES) ga[g.code] = { requireLogin: !!(src[g.code] && src[g.code].requireLogin === true) }
        setAccess(ga)
      })
      .catch(() => {})
  }, [])

  if (!config) return <div className="py-16 text-center"><Spin /></div>

  function toggle(code: string, val: boolean) {
    setAccess((a) => ({ ...a, [code]: { requireLogin: val } }))
  }

  async function save() {
    setSaving(true)
    try {
      await postJson("/api/ui-config", { config: { ...config, game_access: access } })
      toast.success("已保存，C 端即时生效")
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) {
      toast.error(e.message || "保存失败")
      setSaving(false)
    }
  }

  const requireCount = GAMES.filter((g) => access[g.code]?.requireLogin).length

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold mb-0">游戏登录管理</h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm -mt-2 mb-0">
        设定每个游戏进入前是否需要 C 端账号登录。保存后立即生效（C 端客户端 30 秒内自动刷新）。
      </p>

      <Card size="small" className="!border-indigo-200 !bg-indigo-50/40 dark:!border-indigo-500/30 dark:!bg-indigo-500/10">
        <ul className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed list-disc pl-4 mb-0">
          <li><b>需登录</b>：进度保存在 MySQL（按用户隔离），换设备可同步。</li>
          <li><b>游客可玩</b>：进度保存在浏览器 localStorage（仅本机），登录态与游客态存档相互独立、不合并。</li>
          <li>未列出的游戏默认「游客可玩」。</li>
        </ul>
      </Card>

      <Card size="small" title="游戏进入权限">
        <div className="flex flex-col gap-1">
          {GAMES.map((g) => {
            const req = !!access[g.code]?.requireLogin
            return (
              <div key={g.code} className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-800 dark:text-zinc-100">{g.name}</span>
                    <span className="text-[11px] font-mono text-zinc-400">{g.code}</span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{g.desc}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Tag color={req ? "red" : "green"} className="!m-0">
                    {req ? "需登录" : "游客可玩"}
                  </Tag>
                  <Switch
                    checked={req}
                    onChange={(v) => toggle(g.code, v)}
                    checkedChildren="登录"
                    unCheckedChildren="游客"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="primary" onClick={save} loading={saving}>保存配置</Button>
        <span className="text-xs text-zinc-400">
          当前 {requireCount}/{GAMES.length} 个游戏需登录
        </span>
      </div>
    </div>
  )
}
