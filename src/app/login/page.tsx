"use client"
// B 端登录页（antd 版）：逻辑与 myapp 一致 —— 进页先查登录态、登录成功回跳被拦截路由（菜单权限内）
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Form, Input, Button, Spin } from "antd"
import { User, Lock } from "lucide-react"
import { apiJson, postJson, takeRedirectPath } from "@/lib/api"
import { toast } from "@/lib/toast"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  /** 登录成功后回跳：优先返回被拦截前记录的路由（需在菜单权限内），无效则回 dashboard */
  async function goNext() {
    try {
      const m = await apiJson("/api/menu")
      const paths: string[] = []
      const walk = (items: any[]) => {
        for (const t of items) {
          if (t.path) paths.push(t.path)
          if (t.children) walk(t.children)
        }
      }
      walk(m.menu || [])
      router.replace(takeRedirectPath(paths))
    } catch {
      // 菜单拉取失败时只做格式校验
      router.replace(takeRedirectPath())
    }
  }

  // 进入登录页先校验登录态：会话（token）仍有效则直接回原页面（或 dashboard），不再展示登录表单
  useEffect(() => {
    (async () => {
      try {
        await apiJson("/api/me")
        await goNext()
      } catch {
        setChecking(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function submit(values: { username: string; password: string }) {
    setLoading(true)
    try {
      await postJson("/api/login", { username: values.username, password: values.password })
      await goNext()
    } catch (e: any) {
      toast.error(e.message || "登录失败")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-4">
        <div className="flex flex-col items-center gap-3 text-indigo-200">
          <Spin size="large" />
          <span className="text-sm font-medium">正在检查登录状态…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/25 blur-3xl" />
      <div className="relative bg-white/95 backdrop-blur rounded-3xl shadow-2xl shadow-indigo-950/40 p-8 w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-1">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl shadow-lg shadow-indigo-500/30">🧪</span>
          <div className="text-2xl font-bold">NoteLab</div>
          <div className="text-xs text-zinc-400 tracking-wide">AI 试验后台 · B 端管理</div>
        </div>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input size="large" prefix={<User size={14} className="text-zinc-400" />} placeholder="请输入用户名" autoFocus />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" prefix={<Lock size={14} className="text-zinc-400" />} placeholder="请输入密码"
              onPressEnter={(e) => (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit()} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {loading ? "登录中…" : "登 录"}
          </Button>
        </Form>
        <p className="text-xs text-zinc-400 text-center">账号由管理员统一创建，如需开通请联系管理员</p>
      </div>
    </div>
  )
}
