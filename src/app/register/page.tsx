import Link from "next/link"
import { Card, Button } from "antd"

// 注册入口已关闭的静态说明页（保持与 myapp 一致的可访问性），朴素管理台风
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
      <Card className="!w-full max-w-sm text-center shadow-md" styles={{ body: { padding: 28 } }}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-indigo-500 text-2xl text-white">🧪</span>
        <h1 className="text-lg font-bold text-zinc-800 mt-3 mb-1">NoteLab 管理后台</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          注册入口已关闭，账号由管理员在「账户管理」中统一创建。如已有账号，请直接登录。
        </p>
        <Link href="/login" className="block mt-4">
          <Button type="primary" block>返回登录</Button>
        </Link>
      </Card>
    </div>
  )
}
