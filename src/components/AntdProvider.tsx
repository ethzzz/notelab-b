"use client"

// antd 全局配置：中文语言包 + 主题色与站内 indigo 对齐 + light/dark 双主题（客户端组件，供根 layout 包裹）
// - 主题模式持久化于 localStorage（notelab_b_theme），默认 light
// - 切换时同步 <html> 的 .dark class（Tailwind dark: 变体 + globals.css 深色变量）
// - 首帧防闪烁由根 layout 的内联脚本负责（SSR 前读 localStorage 打 .dark class）
import { createContext, useContext, useEffect, useState } from "react"
import { ConfigProvider, theme as antdTheme } from "antd"
import zhCN from "antd/locale/zh_CN"

export type ThemeMode = "light" | "dark"

export const THEME_STORAGE_KEY = "notelab_b_theme"

const ThemeContext = createContext<{ mode: ThemeMode; toggleTheme: () => void }>({
  mode: "light",
  toggleTheme: () => {},
})

/** 读取当前主题模式（供 Header 切换按钮等消费） */
export function useTheme() {
  return useContext(ThemeContext)
}

function readStoredMode(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  // SSR 与客户端首帧一致用 light（深色用户由根 layout 内联脚本先把页面底色压暗，水合后一帧内切到 darkAlgorithm）
  const [mode, setMode] = useState<ThemeMode>("light")
  const [hydrated, setHydrated] = useState(false)

  // 水合后读取持久化主题
  useEffect(() => {
    setMode(readStoredMode())
    setHydrated(true)
  }, [])

  // 模式变化 → 同步 <html> 的 .dark class（水合前不动：内联脚本已处理，避免闪一下）
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle("dark", mode === "dark")
  }, [hydrated, mode])

  function toggleTheme() {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: { colorPrimary: "#6366f1", borderRadius: 8 },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
