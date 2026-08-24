import { redirect } from "next/navigation"

// 旧 /trpg 地址重定向到玩剧本页（功能已拆分为 /trpg/play 与 /trpg/gen 两个子菜单）
export default function TrpgIndexPage() {
  redirect("/trpg/play")
}