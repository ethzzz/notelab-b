"use client"
// 低代码平台 · 表单对外发布面板
//
// 一个表单从「后台自己填着玩」变成「能对外收数据」，只差三件事：
//   ① 打开发布开关（关掉 = 立刻收回，已发出的链接当场 404）
//   ② 定一个公开链接片段 slug（全库唯一，后端保存时校验）
//   ③ 把链接发出去
//
// ⚠️ 这里只改内存并置 dirty，落库仍由页面顶部的「保存到服务器」完成 ——
//    ui_config 是整包覆盖写， publishing 态属于设计稿的一部分，必须跟着设计稿一起存。
//   后果是：改完开关**不点保存就不会生效**，这与平台里其它改动的行为一致。
import { Button, Input, Space, Switch, Tag, Tooltip } from "antd"
import { ExportOutlined } from "@ant-design/icons"
import { defaultSlug, slugify, SLUG_RE, type FormPlan } from "../_lib/core"
import { publicFormUrl } from "../_lib/api"
import { CopyBtn, SectionTitle } from "./ui"

export default function PublishPanel({ plan, onPatch, publicTotal }: {
  plan: FormPlan | null
  onPatch: (patch: Record<string, any>) => void
  publicTotal: number
}) {
  if (!plan) return <div className="text-xs text-zinc-400 dark:text-zinc-500 py-2">先在上方选一个表单方案</div>

  const slug = plan.slug || ""
  const valid = SLUG_RE.test(slug)
  const url = publicFormUrl(slug)
  const published = !!plan.published

  function toggle(next: boolean) {
    // 首次打开发布时顺手补一个默认 slug：少一次「开了但链接是空的」的困惑
    const patch: Record<string, any> = { published: next }
    if (next && !slug) patch.slug = defaultSlug(plan!)
    onPatch(patch)
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <SectionTitle>对外发布</SectionTitle>
        <Space size={6}>
          <Tag color={published ? "green" : "default"}>{published ? "已发布" : "未发布"}</Tag>
          <Switch size="small" checked={published} onChange={toggle} />
        </Space>
      </div>

      {!published ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          打开开关后，这个表单会生成一个<b>无需登录</b>即可填写的公开链接，提交记入本表单的提交记录（来源标记为「公开」）。
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">公开链接</span>
            <Input size="small" className="!w-40" value={slug} status={valid ? undefined : "error"}
              onChange={(e) => onPatch({ slug: slugify(e.target.value) })} placeholder="链接名" />
            <span className={`text-xs break-all flex-1 min-w-[220px] ${valid ? "text-zinc-600 dark:text-zinc-300" : "text-red-500"}`}>
              {valid ? url : "链接名需为 3~32 位小写字母 / 数字 / 连字符"}
            </span>
            <CopyBtn text={valid ? url : ""} />
            <Tooltip title="新窗口打开填写页">
              <Button size="small" icon={<ExportOutlined />} disabled={!valid}
                onClick={() => window.open(url, "_blank", "noopener")}>打开</Button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">页面说明</span>
            <Input size="small" className="!flex-1 !min-w-[240px]" value={plan.intro || ""}
              onChange={(e) => onPatch({ intro: e.target.value })} placeholder="显示在表单顶部的说明（可留空）" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">按钮文案</span>
            <Input size="small" className="!w-32" value={plan.submitText || ""}
              onChange={(e) => onPatch({ submitText: e.target.value })} placeholder="提交" />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            已收到 <b className="text-zinc-700 dark:text-zinc-200">{publicTotal}</b> 份公开提交 ·
            关闭开关后该链接立即失效（已收回的数据不受影响）·
            <span className="text-amber-600 dark:text-amber-400"> 改动需点顶部「保存到服务器」才生效</span>
          </div>
        </div>
      )}
    </div>
  )
}
