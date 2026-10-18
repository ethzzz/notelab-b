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
    // 文档管理（2026-10-18）：文档编辑 / 笔记从「工具箱」移到新的一级菜单「文档管理」，
    // 路径同时迁到 /documents/*。权限码是 page:<path>，所以改路径 = 权限码变更
    // （非超管角色要重新授权，旧 page:/docs、page:/notes 成为死码）。
    // 这里只兜住历史书签与外部链接；与上面两条同理，跳转发生在 React 之前，不经过页面守卫。
    { source: "/docs", destination: "/documents/editor", permanent: false },
    { source: "/notes", destination: "/documents/notes", permanent: false },
    // 学习路线文档（2026-10-18）：/study 本身不是页面，默认进 Java 路线。
    // 与上面同理放在 config 层：/study 不在 PageRoutes 里，放到页面里会被守卫拦掉。
    { source: "/study", destination: "/study/java", permanent: false },
  ],
}

export default nextConfig
