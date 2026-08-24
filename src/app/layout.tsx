import type { Metadata } from "next"
import { AntdRegistry } from "@ant-design/nextjs-registry"
import { App as AntApp } from "antd"
import AntdProvider from "@/components/AntdProvider"
import ToastHost from "@/components/ToastHost"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "NoteLab 管理后台", template: "%s · NoteLab" },
  description: "NoteLab B 端管理后台（Next.js + antd，后端 notelab-java）",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AntdRegistry>
          <AntdProvider>
            <AntApp style={{ minHeight: "100vh" }}>
              <ToastHost />
              {children}
            </AntApp>
          </AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
