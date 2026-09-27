// 传统后台页面外壳：标题 + 描述 + 右侧操作区，下方为内容区。
// 统一所有 admin 配置页的顶部布局，替代各页手写的 <h1>/<p>/底部按钮栏，消除不一致。
import type { ReactNode } from "react"

export default function AdminPage({
  title,
  description,
  extra,
  children,
  className = "",
  level = 1,
}: {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  className?: string
  /** 标题层级：1 = 页面主标题（h1 / xl）；2 = 子页或分区标题（h2 / lg，用于外壳已有 h1 的场景，如爬塔工坊各子页） */
  level?: 1 | 2
}) {
  const Heading = level === 2 ? "h2" : "h1"
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading className={`m-0 font-semibold text-zinc-800 dark:text-zinc-100 ${level === 2 ? "text-lg" : "text-xl"}`}>
            {title}
          </Heading>
          {description && <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      {children}
    </div>
  )
}
