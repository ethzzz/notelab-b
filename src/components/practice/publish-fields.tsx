"use client"

// 发布信息表单字段（不含标题/类型）—— 创建记录弹窗与二级页的「发布信息」弹窗**共用**这一份。
//
// 为什么必须共用：这些字段决定了博客上的**文件名（= URL）**和归组位置，两边各写一份必然漂移，
// 最后变成「创建时填了 module，编辑时改不到」或者「校验规则不一致」。
//
// 值由 antd Form 托管（ModalForm 内部就是 <Form>），所以这里只声明 Form.Item，
// 底部那条 slug 预览用 Form.useWatch 实时读。

import { Form, Input, InputNumber, Select } from "antd"
import { slugPreview, type PracticeModule } from "@/lib/practice"

/** 英文短名：小写字母/数字/连字符（与后端的 SLUG_NAME_RE 同口径，这里只是提前拦） */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export default function PublishFieldsForm({
  modules,
  difficulties,
}: {
  modules: PracticeModule[]
  difficulties: string[]
}) {
  const form = Form.useFormInstance()
  const module = Form.useWatch("module", form)
  const chapter = Form.useWatch("chapter", form)
  const orderNo = Form.useWatch("order_no", form)
  const slugName = Form.useWatch("slug_name", form)

  const slug = slugPreview({
    module: module || "",
    chapter: chapter || "",
    order_no: Number(orderNo) || 0,
    slug_name: slugName || "",
    difficulty: "",
    tags: "",
    description: "",
  })

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Form.Item
          name="module"
          label="路线模块"
          rules={[{ required: true, message: "请选择路线模块" }]}
          tooltip="决定发到博客后归到哪个模块下（与「类型」不是一回事：类型是语言，这里是学习路线模块）"
        >
          <Select
            placeholder="如 算法与手写题"
            options={modules.map((m) => ({ value: m.value, label: `${m.label}（${m.value}）` }))}
          />
        </Form.Item>

        <Form.Item
          name="chapter"
          label="篇章号"
          rules={[
            { required: true, message: "请填篇章号" },
            { pattern: /^\d{1,2}$/, message: "1–2 位数字，如 01" },
          ]}
          tooltip="对应路线文章的序号：01 → <模块>-roadmap-01-*。博客据此自动把解答挂到那篇文章下"
        >
          <Input placeholder="01" maxLength={2} />
        </Form.Item>

        <Form.Item
          name="order_no"
          label="题号"
          rules={[{ required: true, message: "请填题号" }]}
          tooltip="该篇练习清单里的第几题（决定聚合页排序与上一篇/下一篇）"
        >
          <InputNumber min={1} max={999} className="!w-full" placeholder="1" />
        </Form.Item>

        <Form.Item name="difficulty" label="难度" rules={[{ required: true, message: "请选择难度" }]}>
          <Select options={difficulties.map((d) => ({ value: d, label: d }))} />
        </Form.Item>
      </div>

      <Form.Item
        name="slug_name"
        label="英文短名"
        rules={[
          { required: true, message: "请填英文短名" },
          {
            validator: (_r, v: string) =>
              !v || SLUG_RE.test(v)
                ? Promise.resolve()
                : Promise.reject(new Error("只能小写字母/数字/连字符，且不能以连字符开头")),
          },
        ]}
        tooltip="作为 URL 的一段，用英文：pivot-index。中文标题写在「标题」里"
      >
        <Input placeholder="pivot-index" maxLength={100} />
      </Form.Item>

      <Form.Item name="tags" label="标签" tooltip="逗号分隔，会写进博客 frontmatter 的 tags">
        <Input placeholder="算法,对撞指针,LeetCode" maxLength={255} />
      </Form.Item>

      <Form.Item name="description" label="描述" tooltip="博客列表页与 SEO 摘要；留空会自动用标题">
        <Input.TextArea rows={2} maxLength={500} showCount placeholder="一句话说清这题考什么" />
      </Form.Item>

      {/* 文件名预览：它同时就是博客 URL，填错只能靠「看一眼」发现 */}
      <div className="rounded-lg border border-dashed border-[rgba(128,128,128,.45)] px-3 py-2 text-xs leading-relaxed">
        {slug ? (
          <>
            <span className="text-zinc-500">将发布为 </span>
            <code className="font-mono text-[12px] font-medium">{slug}.md</code>
            <div className="mt-0.5 text-zinc-500">
              博客地址：<span className="font-mono">/blog/solutions/{slug}/</span>
            </div>
          </>
        ) : (
          <span className="text-zinc-500">
            填完「路线模块 / 篇章号 / 题号 / 英文短名」后，这里会显示将生成的博客文件名
          </span>
        )}
      </div>
    </>
  )
}
