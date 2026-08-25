"use client"
// 界面配置（传统管理后台风）：antd Card/Form 控件；background 仍由本页管理（供 C 端使用）
import { useEffect, useState } from "react"
import { Button, Card, Input, Modal, Radio, Spin } from "antd"
import { apiJson, postJson } from "@/lib/api"
import { THEMES, themeById, resolveBgStyle } from "@/lib/themes"
import { toast } from "@/lib/toast"

export default function UiConfigPage() {
  const [config, setConfig] = useState<any>(null)
  const [defaults, setDefaults] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiJson("/api/ui-config").then((j) => { setConfig(j.config); setDefaults(j.defaults) }).catch(() => {})
  }, [])

  if (!config || !defaults) return <div className="py-16 text-center"><Spin /></div>

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
    setSaving(true)
    try {
      await postJson("/api/ui-config", { config: cfg })
      toast.success("已保存，整站生效")
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) {
      toast.error(e.message || "保存失败")
      setSaving(false)
    }
  }

  const menuKeys = Object.keys(defaults.menus || {})

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold mb-0">界面配置</h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm -mt-2 mb-0">配置菜单展示与全局背景，保存后即时生效。</p>

      {/* B/C 拆分阶段4：C 端背景说明 —— 此处保存的 background 即 C 端匿名拉取的全局背景 */}
      <Card size="small" className="!border-indigo-200 !bg-indigo-50/40 dark:!border-indigo-500/30 dark:!bg-indigo-500/10">
        <div className="font-semibold text-sm text-indigo-700 mb-2">🌐 C 端背景说明</div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">
          本页保存的「主题风格 / 自定义背景」会写入 ui_config.background，
          C 端游戏中心（/）启动时会匿名调用 <span className="font-mono">GET /api/c/config/background</span> 拉取同一份配置作为全局背景 ——
          也就是说，<b>在这里切换主题，C 端用户看到的背景会同步变化</b>（无需 C 端登录）。
        </p>
        <div className="flex items-center gap-3">
          <div className="h-16 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0" style={{ ...resolveBgStyle(bg), backgroundAttachment: "scroll" }} />
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            当前背景预览：{bg.theme ? `主题「${themeById(bg.theme)?.name}」` : bg.type === "image" ? "自定义背景图" : `自定义颜色 ${bg.color || "#f6f7f9"}`}
          </div>
        </div>
      </Card>

      <Card size="small" title="🎨 主题风格（一键切换 C 端整站背景）">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => pickTheme(t.id)} title={t.desc}
              className={`rounded-lg border p-2 text-left transition-all ${bg.theme === t.id ? "border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-500/30" : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:shadow-sm"}`}>
              <div className="h-14 rounded-md border border-zinc-200/70 dark:border-zinc-700" style={{ ...t.style, backgroundAttachment: "scroll" }} />
              <div className="mt-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                <span>{t.emoji}</span>
                <span className="truncate">{t.name}</span>
                {bg.theme === t.id && <span className="ml-auto text-indigo-600 dark:text-indigo-300 font-bold">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card size="small" title="🖌️ 自定义背景（覆盖主题）">
        <div className="flex flex-col gap-3">
          <Radio.Group value={bg.theme ? "theme" : customMode}
            onChange={(e) => { const v = e.target.value; if (v === "color" || v === "image") switchCustom(v) }}
            options={[
              { value: "theme", label: "使用主题（见上方）", disabled: true },
              { value: "color", label: "背景色" },
              { value: "image", label: "背景图" },
            ]} />
          {!bg.theme && customMode === "color" && (
            <div className="flex items-center gap-3">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(bg.color) ? bg.color : "#f6f7f9"}
                onChange={(e) => setCustomColor(e.target.value)} className="w-11 h-9 rounded-md cursor-pointer border border-zinc-300 dark:border-zinc-600" />
              <Input value={bg.color || ""} onChange={(e) => setCustomColor(e.target.value)} placeholder="#f6f7f9" className="max-w-40" />
            </div>
          )}
          {!bg.theme && customMode === "image" && (
            <Input value={bg.image_url || ""} onChange={(e) => setCustomImage(e.target.value)}
              placeholder="背景图 URL，如 https://.../bg.jpg" />
          )}
          {bg.theme && <div className="text-xs text-zinc-400 dark:text-zinc-500">当前使用主题「{themeById(bg.theme)?.name}」；选择上方背景色/背景图可切换为自定义。</div>}
        </div>
      </Card>

      <Card size="small" title="🧭 菜单展示（icon 与名称）">
        <div className="flex flex-col gap-2">
          {menuKeys.map((key) => {
            const d = defaults.menus[key] || {}
            const c = config.menus?.[key] || {}
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-24 text-xs text-zinc-400 dark:text-zinc-500 font-mono shrink-0">{key}</span>
                <Input value={c.icon !== undefined ? c.icon : (d.icon || "")} onChange={(e) => setMenu(key, { icon: e.target.value })}
                  placeholder="icon" className="!w-16 text-center !text-base" />
                <Input value={c.name !== undefined ? c.name : (d.name || "")} onChange={(e) => setMenu(key, { name: e.target.value })}
                  placeholder="菜单名称" className="flex-1" />
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="primary" onClick={() => save(config)} loading={saving}>保存配置</Button>
        <Button onClick={() => Modal.confirm({
          title: "恢复为默认外观配置？",
          okText: "恢复",
          cancelText: "取消",
          onOk: () => save(defaults),
        })}>恢复默认</Button>
      </div>
    </div>
  )
}
