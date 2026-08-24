"use client"
// 在 antd <App> 上下文内注册 message 实例，供 lib/toast.ts 全局调用
import { useEffect } from "react"
import { App } from "antd"
import { registerToast } from "@/lib/toast"

export default function ToastHost() {
  const { message } = App.useApp()
  useEffect(() => {
    registerToast({
      success: (s) => message.success(s),
      error: (s) => message.error(s),
      warning: (s) => message.warning(s),
      info: (s) => message.info(s),
    })
  }, [message])
  return null
}
