import Link from "next/link"

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-4 relative overflow-hidden">
      <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="relative bg-white/95 backdrop-blur rounded-3xl shadow-2xl shadow-indigo-950/40 p-8 w-full max-w-sm flex flex-col gap-3 text-center items-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl shadow-lg shadow-indigo-500/30">🧪</span>
        <h1 className="text-xl font-bold">注册入口已关闭</h1>
        <p className="text-sm text-zinc-500">本系统不再开放自助注册。如需账号，请联系管理员在「权限管理」中创建。</p>
        <Link href="/login" className="btn-primary w-full mt-2">返回登录</Link>
      </div>
    </div>
  )
}
