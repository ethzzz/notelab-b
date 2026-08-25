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

// 首帧防闪烁：解析到 <body> 第一个子节点时同步执行（早于任何绘制），
// 读取持久化主题并给 <html> 打上 .dark（未设置按 light）。
// 说明：Next App Router 中 <head> 由框架托管，官方推荐的内联方式即放在 body 顶部，效果等同 <head> 内联。
const themeInitScript = `(function(){try{var t=localStorage.getItem("notelab_b_theme");if(t==="dark"){document.documentElement.classList.add("dark")}else{document.documentElement.classList.remove("dark")}}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning：内联脚本会在 React 水合前修改 <html> 的 class，属预期行为
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
