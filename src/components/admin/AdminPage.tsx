// 传统后台页面外壳：标题 + 描述 + 右侧操作区，下方为内容区。
// 统一所有 admin 配置页的顶部布局，替代各页手写的 <h1>/<p>/底部按钮栏，消除不一致。
import type { ReactNode } from "react"

export default function AdminPage({
  title,
  description,
  extra,
  children,
  className = "",
}: {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 text-xl font-semibold text-zinc-800 dark:text-zinc-100">{title}</h1>
          {description && <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      {children}
    </div>
  )
}
