"use client"
import { useState } from "react"
import { THEMES } from "@/lib/themes"
import { apiJson, postJson } from "@/lib/api"

// 主题选择面板：点击即应用到整站背景（写入 /api/ui-config，后端 30s 缓存会即时失效）
export default function ThemePicker({ current, onApplied, onClose }: {
  current?: string
  onApplied: (bg: { theme: string }) => void
  onClose?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState("")

  async function apply(id: string) {
    if (busy) return
    setBusy(id)
    setErr("")
    try {
      const j = await apiJson("/api/ui-config")
      const cfg = { ...(j.config || {}) }
      cfg.background = { theme: id }
      await postJson("/api/ui-config", { config: cfg })
      onApplied({ theme: id })
      onClose?.()
    } catch (e: any) {
      setErr("⚠️ " + (e?.message || "应用失败"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-bold text-zinc-800">🎨 选择主题风格</div>
        {onClose && <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="关闭">✕</button>}
      </div>
      <p className="text-xs text-zinc-400 -mt-2">点击任意主题，立即应用到整站背景并保存</p>
      <div className="grid grid-cols-2 gap-2.5">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => apply(t.id)} disabled={!!busy} title={t.desc}
            className={`rounded-xl border p-2 text-left transition-all ${current === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-zinc-200 hover:border-indigo-300 hover:shadow-sm"} ${busy ? "opacity-60 cursor-wait" : ""}`}>
            <div className="h-12 rounded-lg border border-zinc-200/70" style={{ ...t.style, backgroundAttachment: "scroll" }} />
            <div className="mt-1.5 text-xs font-medium text-zinc-700 flex items-center gap-1">
              <span>{t.emoji}</span>
              <span className="truncate">{t.name}</span>
              {current === t.id && <span className="ml-auto text-indigo-600 font-bold">✓</span>}
            </div>
          </button>
        ))}
      </div>
      {busy && <div className="text-xs text-zinc-400">应用中...</div>}
      {err && <div className="text-xs text-red-500">{err}</div>}
    </div>
  )
}
