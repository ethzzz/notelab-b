import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // B 端挂在统一入口的 /admin 前缀下（nginx ^~ /admin -> :3020，保留前缀）
  basePath: "/admin",
  // 注意：不加任何 /api rewrites —— /api 由 nginx 直达 :8001（notelab-java）
}

export default nextConfig
