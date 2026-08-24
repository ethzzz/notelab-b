"use client"
import { useEffect, useState } from "react"
import { apiJson, postJson } from "@/lib/api"
import { THEMES, themeById, resolveBgStyle } from "@/lib/themes"
import { confirmDialog } from "@/components/ui/confirm"

export default function UiConfigPage() {
  const [config, setConfig] = useState<any>(null)
  const [defaults, setDefaults] = useState<any>(null)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    apiJson("/api/ui-config").then((j) => { setConfig(j.config); setDefaults(j.defaults) }).catch(() => {})
  }, [])

  if (!config || !defaults) return <div className="text-zinc-500">加载中...</div>

  const bg = config.background || {}
  const customMode: "color" | "image" = bg.type === "image" ? "image" : "color"

  function pickTheme(id: string) { setConfig({ ...config, background: { theme: id } }) }
  function setCustomColor(c: string) { setConfig({ ...config, background: { type: "color", color: c } }) }
  function setCustomImage(u: string) { setConfig({ ...config, background: { type: "image", image_url: u } }) }
  function switchCustom(mode: "color" | "image") {
    if (mode === "color") setConfig({ ...config, background: { type: "color", color: /^#[0-9a-fA-F]{6}$/.test(bg.color) ? bg.color : "#f6f7f9" } })
    else setConfig({ ...config, background: { type: "image", image_url: bg.image_url || "" } })
  }
  function setMenu(key: string, patch: any) {
    setConfig({ ...config, menus: { ...config.menus, [key]: { ...(config.menus[key] || {}), ...patch } } })
  }
  async function save(cfg: any) {
    setMsg("保存中...")
    try {
      await postJson("/api/ui-config", { config: cfg })
      setMsg("✅ 已保存，整站生效")
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) { setMsg("⚠️ " + (e.message || "保存失败")) }
  }

  const menuKeys = Object.keys(defaults.menus || {})

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">界面配置</h1>
      <p className="text-zinc-600 text-sm">配置后台的整体外观与菜单展示，保存后整站即时生效。也可以在任意页面右上角「🎨 主题风格」快速切换。</p>

      {/* B/C 拆分阶段4：C 端背景说明 —— 此处保存的 background 即 C 端匿名拉取的全局背景 */}
      <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/60 p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm text-indigo-700">🌐 C 端背景说明</div>
        <p className="text-xs text-zinc-600 leading-relaxed mb-0">
          本页保存的「主题风格 / 自定义背景」会写入 ui_config.background，
          C 端游戏中心（/）启动时会匿名调用 <span className="font-mono">GET /api/c/config/background</span> 拉取同一份配置作为全局背景 ——
          也就是说，<b>在这里切换主题，C 端用户看到的背景会同步变化</b>（无需 C 端登录）。
        </p>
        <div className="flex items-center gap-3">
          <div className="h-16 w-28 rounded-xl border border-zinc-200 shadow-inner shrink-0" style={{ ...resolveBgStyle(bg), backgroundAttachment: "scroll" }} />
          <div className="text-xs text-zinc-500">
            当前背景预览：{bg.theme ? `主题「${themeById(bg.theme)?.name}」` : bg.type === "image" ? "自定义背景图" : `自定义颜色 ${bg.color || "#f6f7f9"}`}
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm">🎨 主题风格（一键切换整站背景）</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => pickTheme(t.id)} title={t.desc}
              className={`rounded-xl border p-2 text-left transition-all ${bg.theme === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-zinc-200 hover:border-indigo-300 hover:shadow-sm"}`}>
              <div className="h-14 rounded-lg border border-zinc-200/70" style={{ ...t.style, backgroundAttachment: "scroll" }} />
              <div className="mt-1.5 text-xs font-medium text-zinc-700 flex items-center gap-1">
                <span>{t.emoji}</span>
                <span className="truncate">{t.name}</span>
                {bg.theme === t.id && <span className="ml-auto text-indigo-600 font-bold">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm">🖌️ 自定义背景（覆盖主题）</div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={!bg.theme && customMode === "color"} onChange={() => switchCustom("color")} /> 背景色
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={!bg.theme && customMode === "image"} onChange={() => switchCustom("image")} /> 背景图
          </label>
        </div>
        {!bg.theme && customMode === "color" && (
          <div className="flex items-center gap-3">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(bg.color) ? bg.color : "#f6f7f9"}
              onChange={(e) => setCustomColor(e.target.value)} className="w-11 h-9 rounded-lg cursor-pointer border border-zinc-300" />
            <input value={bg.color || ""} onChange={(e) => setCustomColor(e.target.value)} placeholder="#f6f7f9"
              className="flex-1 input" />
          </div>
        )}
        {!bg.theme && customMode === "image" && (
          <input value={bg.image_url || ""} onChange={(e) => setCustomImage(e.target.value)}
            placeholder="背景图 URL，如 https://.../bg.jpg"
            className="input" />
        )}
        {bg.theme && <div className="text-xs text-zinc-400">当前使用主题「{themeById(bg.theme)?.name}」；选择上方背景色/背景图可切换为自定义。</div>}
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm">🧭 菜单展示（icon 与名称）</div>
        <div className="flex flex-col gap-2">
          {menuKeys.map((key) => {
            const d = defaults.menus[key] || {}
            const c = config.menus?.[key] || {}
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20 text-xs text-zinc-400 font-mono shrink-0">{key}</span>
                <input value={c.icon !== undefined ? c.icon : (d.icon || "")} onChange={(e) => setMenu(key, { icon: e.target.value })}
                  placeholder="icon" className="w-16 text-center input px-2 py-2 text-base" />
                <input value={c.name !== undefined ? c.name : (d.name || "")} onChange={(e) => setMenu(key, { name: e.target.value })}
                  placeholder="菜单名称" className="flex-1 input" />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => save(config)} className="btn-primary">保存配置</button>
        <button onClick={async () => { if (await confirmDialog({ message: "恢复为默认外观配置？", confirmText: "恢复", danger: false })) save(defaults) }}
          className="btn-ghost">恢复默认</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  )
}
