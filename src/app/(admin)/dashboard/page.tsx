"use client"
// 仪表盘（传统管理后台风）：欢迎卡片 + 功能入口网格（antd Card）
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, Row, Col, Typography } from "antd"
import { apiJson } from "@/lib/api"

export default function DashboardPage() {
  const [menu, setMenu] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    apiJson("/api/me").then(setUser).catch(() => {})
    apiJson("/api/menu").then((m) => setMenu(m.menu || [])).catch(() => {})
  }, [])
  const ready = menu.filter((m) => m.ready && m.path !== "/")
  return (
    <div className="w-full flex flex-col gap-4">
      {/* 欢迎卡片 */}
      <Card styles={{ body: { padding: "20px 24px" } }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          你好{user ? `，${user.username}` : ""} 👋
        </Typography.Title>
        <Typography.Text type="secondary">
          欢迎来到 NoteLab —— AI 试验台与管理后台，左侧菜单进入各功能模块。
        </Typography.Text>
      </Card>

      {/* 功能入口 */}
      <Row gutter={[16, 16]}>
        {ready.map((m) => (
          <Col key={m.key} xs={24} sm={12} xl={8} xxl={6}>
            <Link href={m.path}>
              <Card hoverable size="small" styles={{ body: { padding: "14px 16px" } }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-lg">{m.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-800 truncate">{m.name}</div>
                    <div className="text-xs text-zinc-400">点击进入</div>
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  )
}
