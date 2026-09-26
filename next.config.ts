import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // B 端挂在统一入口的 /admin 前缀下（nginx ^~ /admin -> :3020，保留前缀）
  basePath: "/admin",
  // 注意：不加任何 /api rewrites —— /api 由 nginx 直达 :8001（notelab-java）
  redirects: async () => [
    // B/C 拆分 P6：游玩功能已移至 C 端，旧 /trpg 入口统一 307 到生成剧本页（服务端级跳转）
    { source: "/trpg", destination: "/trpg/gen", permanent: false },
    // 爬塔工坊已由单页 4 个 Tab 拆成 6 个子页（见 java MenuTree.gc_spire），
    // 旧入口与历史书签 307 到第一个子页。放在 config 层是为了让它发生在 React 之前，
    // 不经过 (admin) 的页面守卫（守卫只认"能进入的页面"，重定向不是页面）。
    { source: "/spire-editor", destination: "/spire-editor/cards", permanent: false },
  ],
}

export default nextConfig
