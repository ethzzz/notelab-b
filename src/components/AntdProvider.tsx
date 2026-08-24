"use client"

// antd 全局配置：中文语言包 + 主题色与站内 indigo 对齐（客户端组件，供根 layout 包裹）
import { ConfigProvider } from "antd"
import zhCN from "antd/locale/zh_CN"

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#6366f1", borderRadius: 8 } }}>
      {children}
    </ConfigProvider>
  )
}
