"use client"

// 发布二次确认弹窗。
//
// 为什么要有「二次确认」而不是直接发：发布 = 往博客仓 commit + push，会触发线上构建部署。
// 所以这个弹窗必须让用户看得到**将要发生什么**，否则就只是「再点一次确定」：
//   · 文件名（它同时就是博客 URL，错了只能靠肉眼发现）
//   · 会归到哪篇路线文章下（找不到的话聚合页会把它丢进「独立分组」）
//   · 要带走几张插图（正文里的 /api/practice/images/{id} 在博客上是 404，必须导出）
//   · 这是在新建还是在覆盖上一版
//
// 内容全部来自服务端的 /publish-preview（和真实发布**共用同一个计划构建函数**），
// 所以「看到的」就是「会发生的」。

import { useEffect, useState } from "react"
import { Alert, Button, Descriptions, Modal, Spin, Tag } from "antd"
import { ExternalLink } from "lucide-react"
import { toast } from "@/lib/toast"
import { publishPreview, publishRecord, type PublishPreview, type PublishResult } from "@/lib/practice"

export default function PublishConfirm({
  recordId,
  open,
  onClose,
  onPublished,
}: {
  recordId: number | null
  open: boolean
  onClose: () => void
  onPublished: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [pv, setPv] = useState<PublishPreview | null>(null)
  const [doing, setDoing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  useEffect(() => {
    if (!open || recordId == null) {
      setPv(null)
      setResult(null)
      return
    }
    let alive = true
    setLoading(true)
    void publishPreview(recordId)
      .then((p) => { if (alive) setPv(p) })
      .catch((e: any) => { if (alive) toast.error(`预检失败：${e?.message || e}`) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, recordId])

  async function doPublish() {
    if (recordId == null) return
    setDoing(true)
    try {
      const r = await publishRecord(recordId)
      setResult(r)
      onPublished()
    } catch (e: any) {
      toast.error(`发布失败：${e?.message || e}`)
    } finally {
      setDoing(false)
    }
  }

  /** 发布成功后：把服务端给的警告也摊出来（不拦发布，但不能沉默） */
  const warnings = result?.warnings ?? pv?.warnings ?? []
  const blockers = pv?.blockers ?? []
  const ready = !!pv?.ready

  return (
    <Modal
      open={open}
      title={result ? "已发布" : "发布到博客"}
      width={680}
      maskClosable={false}
      onCancel={onClose}
      footer={
        result ? (
          <Button type="primary" onClick={onClose}>完成</Button>
        ) : (
          <>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={doing} disabled={loading || !ready} onClick={doPublish}>
              确认发布
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <div className="py-10 text-center"><Spin /> <span className="ml-2 text-sm text-zinc-500">正在预检…</span></div>
      ) : result ? (
        <div className="flex flex-col gap-3">
          <Alert
            type="success"
            showIcon
            message={result.updated ? "已更新博客上的这一篇" : "已发布到博客"}
            description={
              <>
                <div>
                  地址：
                  <a href={result.url} target="_blank" rel="noreferrer" className="font-mono">
                    {result.url} <ExternalLink size={12} className="inline align-[-1px]" />
                  </a>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  commit {result.commit} · 导出插图 {result.images} 张
                </div>
                <div className="mt-1 text-xs text-zinc-500">{result.note}</div>
              </>
            }
          />
          {warnings.length > 0 && (
            <Alert type="warning" showIcon message="有需要注意的地方" description={
              <ul className="m-0 pl-4">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            } />
          )}
        </div>
      ) : !pv ? (
        <div className="py-10 text-center text-sm text-zinc-500">没拿到预检结果，请重试</div>
      ) : (
        <div className="flex flex-col gap-3">
          {blockers.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message="还差一些发布信息"
              description={
                <>
                  <ul className="m-0 pl-4">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
                  <div className="mt-1 text-xs">把「发布信息」补全后，再来点发布。</div>
                </>
              }
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="这一步会往博客仓提交并推送，触发线上构建"
              description={<span className="text-xs">push 后约 3–5 分钟线上可见。此前的版本会被这次内容覆盖。</span>}
            />
          )}

          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: "file",
                label: "文件名",
                children: <span className="font-mono text-[12.5px]">{pv.slug}.md</span>,
              },
              {
                key: "url",
                label: "博客地址",
                children: <span className="font-mono text-[12.5px]">{pv.url}</span>,
              },
              {
                key: "group",
                label: "归到文章",
                children: pv.relatedPostFound
                  ? <span className="font-mono text-[12.5px]">{pv.relatedPost}</span>
                  : <Tag color="orange">未找到对应路线文章 · 聚合页会归到「独立分组」</Tag>,
              },
              {
                key: "meta",
                label: "模块 / 题号 / 难度",
                children: <>{pv.module} · 第 {pv.order} 题 · {pv.difficulty}</>,
              },
              {
                key: "images",
                label: "插图",
                children: pv.images.length === 0
                  ? <span className="text-zinc-500">无</span>
                  : <span>{pv.images.length} 张将被导出到博客：
                      <span className="ml-1 font-mono text-[11.5px] text-zinc-500">
                        public/images/solutions/{pv.slug}-1…
                      </span>
                    </span>,
              },
              {
                key: "state",
                label: "本次动作",
                children: pv.willUpdate
                  ? <Tag color="blue">覆盖已发布的同名解答</Tag>
                  : pv.published
                    ? <Tag color="orange">改名为新文件，并删除旧的 {pv.oldSlug}.md</Tag>
                    : <Tag color="green">新建</Tag>,
              },
            ]}
          />

          {warnings.length > 0 && (
            <Alert type="warning" showIcon message="警告（不阻塞发布）" description={
              <ul className="m-0 pl-4">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            } />
          )}

          <details className="rounded-lg border border-solid border-[rgba(128,128,128,.3)] px-3 py-2">
            <summary className="cursor-pointer text-xs text-zinc-500">查看将写入的 frontmatter</summary>
            <pre className="mt-2 overflow-x-auto text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              {pv.frontmatter}
            </pre>
          </details>
        </div>
      )}
    </Modal>
  )
}
