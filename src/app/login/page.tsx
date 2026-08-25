"use client"
// B 端登录页（传统管理后台风）：逻辑与 myapp 一致 —— 进页先查登录态、登录成功回跳被拦截路由（菜单权限内）
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Form, Input, Button, Spin, Card } from "antd"
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
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414]">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <Spin size="large" />
          <span className="text-sm">正在检查登录状态…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414] p-4">
      <Card className="!w-full max-w-sm shadow-md" styles={{ body: { padding: 28 } }}>
        <div className="flex flex-col items-center gap-1.5 mb-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-500 text-2xl text-white">🧪</span>
          <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100">NoteLab 管理后台</div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">AI 试验后台 · B 端</div>
        </div>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input size="large" prefix={<User size={14} className="text-zinc-400 dark:text-zinc-500" />} placeholder="请输入用户名" autoFocus />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" prefix={<Lock size={14} className="text-zinc-400 dark:text-zinc-500" />} placeholder="请输入密码"
              onPressEnter={(e) => (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit()} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {loading ? "登录中…" : "登 录"}
          </Button>
        </Form>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-3 mb-0">账号由管理员统一创建，如需开通请联系管理员</p>
      </Card>
    </div>
  )
}
