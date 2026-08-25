import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // B 端挂在统一入口的 /admin 前缀下（nginx ^~ /admin -> :3020，保留前缀）
  basePath: "/admin",
  // 注意：不加任何 /api rewrites —— /api 由 nginx 直达 :8001（notelab-java）
  redirects: async () => [
    // B/C 拆分 P6：游玩功能已移至 C 端，旧 /trpg 入口统一 307 到生成剧本页（服务端级跳转）
    { source: "/trpg", destination: "/trpg/gen", permanent: false },
  ],
}

export default nextConfig
