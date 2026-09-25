"use client"
// B 端无权限页：由 (admin)/layout.tsx 的页面级守卫跳转而来。
// 刻意放在 (admin) 分组之外——不套后台外壳、也不再经受守卫判定，否则会自我跳转成死循环。
// URL：/admin/no-access?next=<下发清单里的首个可进入页面>
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Result, Spin } from "antd"
import { api, apiJson, clearRememberedPath } from "@/lib/api"

function NoAccessBody() {
  const router = useRouter()
  const params = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [me, setMe] = useState<any>(null)

  // 只做两件事：确认登录态仍在（不在就回登录页）、拿到账户名展示给用户
  useEffect(() => {
    (async () => {
      try {
        setMe(await apiJson("/api/me"))
      } catch {
        router.replace("/login")
        return
      }
      setChecking(false)
    })()
  }, [router])

  // next 由守卫带入，来源是后端下发的清单；仍做站内路径校验，挡掉 "//host" 这类协议相对地址
  const raw = params.get("next") || ""
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : ""

  async function logout() {
    try { await api("/api/logout", { method: "POST" }) } catch { /* ignore */ }
    clearRememberedPath()
    router.replace("/login")
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414]">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <Spin size="large" />
          <span className="text-sm">正在校验登录状态…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#141414] p-4">
      <Result
        status="403"
        title="无权访问"
        subTitle={
          <span>
            当前账户
            {me?.username ? ` ${me.username}` : ""}
            {me?.role ? `（角色 ${me.role}）` : ""}
            的角色组未被授予该页面的访问权限。
            <br />
            需要使用时，请联系管理员在「用户管理 → 角色组管理」里给该角色组勾选对应页面路由。
          </span>
        }
        extra={
          <>
            {next && (
              <Button type="primary" key="go" onClick={() => router.replace(next)}>
                前往可访问的页面
              </Button>
            )}
            <Button key="back" onClick={() => router.back()}>返回上一页</Button>
            <Button key="out" onClick={logout}>退出登录</Button>
          </>
        }
      />
    </div>
  )
}

// useSearchParams 在客户端组件里必须包一层 Suspense，否则静态预渲染会报错
export default function NoAccessPage() {
  return (
    <Suspense fallback={null}>
      <NoAccessBody />
    </Suspense>
  )
}
