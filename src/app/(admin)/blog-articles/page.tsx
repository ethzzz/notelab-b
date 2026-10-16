"use client"
// 文章记录（博客管理 → 文章记录）。
//
// 这个页面回答两个问题：**哪篇文章有人看**、**它最后一次被改是什么时候**。
//
// ⚠️ 数据来自三个地方，边界要让看的人明白（页面上也标了）：
//   · 标题 / 分类 / 发布日 ← 博客仓库的 md 文件（文章本身）
//   · 浏览数 ← 博客侧读者浏览器匿名上报，**按访客去重**（同一个人同一篇只算一次）
//   · 改动记录 ← **只记经过后台系统的改动**。日常维护是直接在仓库里改 md 的，那些不在里面
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Drawer, Empty, Input, Popconfirm, Space, Spin, Tag, Tooltip } from "antd"
import { Eye, Pencil, RefreshCw, RotateCw, Send, Trash2, Undo2 } from "lucide-react"
import { AdminPage, DataTable, actionColumn } from "@/components/admin"
import { apiJson } from "@/lib/api"
import { toast } from "@/lib/toast"

type LastChange = { action: string; title: string; by: string; at: string } | null

type Article = {
  slug: string
  title: string
  category: string
  published: string
  draft: boolean
  views: number
  lastChange: LastChange
}

type ArticleLog = {
  action: string
  title: string
  detail: string
  created_by_name: string
  created_at: string
}

/** "2026-10-13T10:00:00+08:00" / "2026-10-13 10:00:00.0" → "2026-10-13 10:00" */
function fmtTime(v: string): string {
  if (!v) return "-"
  const s = v.replace("T", " ").replace(/(\+|Z).*$/, "")
  return s.length >= 16 ? s.slice(0, 16) : s
}

export default function BlogArticlesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [detail, setDetail] = useState<{ article: Article; logs: ArticleLog[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState("")

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiJson<{ items: Article[]; total: number }>("/api/blog/articles")
      setItems(r.items || [])
    } catch (e) {
      toast.error(`加载失败：${(e as Error)?.message || e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchList() }, [fetchList])

  async function openDetail(slug: string) {
    setDetailLoading(true)
    setDetail({ article: items.find((a) => a.slug === slug)!, logs: [] })
    try {
      const r = await apiJson<Article & { logs: ArticleLog[] }>(`/api/blog/articles/${encodeURIComponent(slug)}`)
      setDetail({ article: r, logs: r.logs || [] })
    } catch (e) {
      toast.error(`详情加载失败：${(e as Error)?.message || e}`)
    } finally {
      setDetailLoading(false)
    }
  }

  /**
   * 上线 / 下线：只动 frontmatter 的 draft 那一行（正文与其它字段一个字节都不动）。
   * 两个方向都会触发一次构建 —— 上线要让它出现，下线要让它消失，都是读者能看到的变化。
   */
  async function toggleDraft(a: Article) {
    const next = !a.draft
    setBusy(`draft-${a.slug}`)
    try {
      const r = await apiJson<any>(`/api/blog/articles/${encodeURIComponent(a.slug)}/draft`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: next }),
      })
      const dep = r.deploy
      toast.success(
        `已${next ? "下线（转草稿）" : "上线"}：${a.slug}` +
        (dep?.skipped ? "" : dep?.ok ? `；已排队部署 #${dep.jobId}（约 1 分钟）` : `；没触发部署：${dep?.reason || "未知"}`),
      )
      void fetchList()
    } catch (e) {
      toast.error((e as Error).message || "操作失败")
    } finally { setBusy("") }
  }

  /** 删除：服务端只允许删草稿（已发布必须先下线），所以按钮也只在草稿行出现 */
  async function remove(a: Article) {
    setBusy(`del-${a.slug}`)
    try {
      await apiJson(`/api/blog/articles/${encodeURIComponent(a.slug)}`, { method: "DELETE" })
      toast.success(`已删除：${a.slug}`)
      setDetail(null)
      void fetchList()
    } catch (e) {
      toast.error((e as Error).message || "删除失败")
    } finally { setBusy("") }
  }

  /** 重新构建并发布（内容没变也想重跑 —— 例如线上被别的部署覆盖过） */
  async function redeploy(a: Article) {
    setBusy(`dep-${a.slug}`)
    try {
      const r = await apiJson<any>("/api/blog/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a.draft ? {} : { slug: a.slug }),
      })
      toast.success(`已排队部署 #${r.jobId}，进度见「部署状态」`)
    } catch (e) {
      toast.warning((e as Error).message || "没能开始部署")
    } finally { setBusy("") }
  }

  // 前端筛选：202 篇一次取回，没必要为搜索再跑一次接口
  const shown = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return items
    return items.filter((a) =>
      a.slug.toLowerCase().includes(q) || (a.title || "").toLowerCase().includes(q)
      || (a.category || "").toLowerCase().includes(q))
  }, [items, keyword])

  const totalViews = useMemo(() => items.reduce((s, a) => s + (a.views || 0), 0), [items])
  const viewedCount = useMemo(() => items.filter((a) => (a.views || 0) > 0).length, [items])

  const columns = useMemo(() => [
    {
      title: "标题", dataIndex: "title", key: "title", ellipsis: true,
      render: (v: string, r: Article) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{v || r.slug}</div>
          <div className="text-xs text-zinc-400 truncate font-mono">{r.slug}</div>
        </div>
      ),
    },
    {
      title: "分类", dataIndex: "category", key: "category", width: 150,
      render: (v: string) => v ? <Tag className="!m-0">{v}</Tag> : <span className="text-zinc-400">-</span>,
    },
    {
      title: "发布", dataIndex: "published", key: "published", width: 110,
      render: (v: string) => <span className="text-zinc-500 text-xs">{fmtTime(v).slice(0, 10)}</span>,
    },
    {
      title: "状态", dataIndex: "draft", key: "draft", width: 90,
      render: (v: boolean) => v
        ? <Tag color="orange" className="!m-0">草稿</Tag>
        : <Tag color="green" className="!m-0">已发布</Tag>,
    },
    {
      title: "浏览数", dataIndex: "views", key: "views", width: 110,
      // 默认按浏览数倒序最有用：一眼看到哪篇在被读
      sorter: (a: Article, b: Article) => (a.views || 0) - (b.views || 0),
      render: (v: number) => (
        <span className={v > 0 ? "font-medium" : "text-zinc-400"}>
          <Eye size={13} className="inline align-[-2px] mr-1" />
          {v || 0}
        </span>
      ),
    },
    {
      title: "最后改动", dataIndex: "lastChange", key: "lastChange", width: 190,
      render: (v: LastChange) => v
        ? (
          <Tooltip title={`${v.action}${v.by ? ` · ${v.by}` : ""}`}>
            <span className="text-xs text-zinc-500">{fmtTime(v.at)}</span>
          </Tooltip>
        )
        : <span className="text-xs text-zinc-400">后台无记录</span>,
    },
    actionColumn((_: unknown, r: Article) => (
      <Space size={0}>
        <Button size="small" type="text" icon={<Eye size={13} />} onClick={() => void openDetail(r.slug)}>详情</Button>
        <Button size="small" type="text" icon={<Pencil size={13} />}
          onClick={() => router.push(`/blog-gen?slug=${encodeURIComponent(r.slug)}`)}>编辑</Button>
        <Tooltip title={r.draft ? "发布上线（会触发一次构建，约 1 分钟）" : "下线：转草稿，线上不再可访问"}>
          <Button size="small" type="text" loading={busy === `draft-${r.slug}`}
            icon={r.draft ? <Send size={13} /> : <Undo2 size={13} />}
            onClick={() => void toggleDraft(r)}>{r.draft ? "上线" : "下线"}</Button>
        </Tooltip>
        <Tooltip title="重新构建并发布（约 1 分钟）">
          <Button size="small" type="text" loading={busy === `dep-${r.slug}`}
            icon={<RotateCw size={13} />} onClick={() => void redeploy(r)}>部署</Button>
        </Tooltip>
        {r.draft && (
          <Popconfirm
            title={`删除 ${r.slug}？`}
            description="删除只对草稿开放（线上本来就没有它）。已发布的请先下线。"
            okText="删除" okButtonProps={{ danger: true }} cancelText="取消"
            onConfirm={() => void remove(r)}
          >
            <Button size="small" type="text" danger loading={busy === `del-${r.slug}`} icon={<Trash2 size={13} />}>删除</Button>
          </Popconfirm>
        )}
      </Space>
    ), 340),
  ], [items])

  return (
    <div className="flex flex-col gap-4">
      <AdminPage
        level={1}
        title="📊 文章记录"
        description="博客上每篇文章的浏览数与改动记录。浏览数由读者浏览器匿名上报、按访客去重（同一人同一篇只算一次）。"
        extra={
          <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void fetchList()}>
            刷新
          </Button>
        }
      />

      {/* 概览：先把总量摆出来，再看明细 */}
      <div className="flex flex-wrap gap-4">
        <Card size="small" className="min-w-[9rem]">
          <div className="text-xs text-zinc-400">文章总数</div>
          <div className="text-lg font-semibold">{items.length}</div>
        </Card>
        <Card size="small" className="min-w-[9rem]">
          <div className="text-xs text-zinc-400">总浏览数</div>
          <div className="text-lg font-semibold">{totalViews.toLocaleString()}</div>
        </Card>
        <Card size="small" className="min-w-[9rem]">
          <div className="text-xs text-zinc-400">有浏览的文章</div>
          <div className="text-lg font-semibold">{viewedCount}</div>
        </Card>
      </div>

      <Card size="small" className="shadow-sm">
        <div className="mb-3">
          <Input.Search
            allowClear
            placeholder="搜标题 / slug / 分类"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
        <DataTable
          size="middle"
          rowKey="slug"
          columns={columns as never}
          dataSource={shown}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 篇` }}
        />
      </Card>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
        title={detail?.article?.title || detail?.article?.slug || "文章详情"}
      >
        {!detail ? null : detailLoading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : (
          <div className="flex flex-col gap-4">
            <Card size="small">
              <div className="text-xs text-zinc-400 mb-1">slug</div>
              <div className="font-mono text-sm mb-3">{detail.article.slug}</div>
              <Space size={16} wrap>
                <span className="text-sm">
                  <Eye size={13} className="inline align-[-2px] mr-1" />
                  <b>{detail.article.views || 0}</b> 次浏览
                </span>
                {detail.article.category && <Tag className="!m-0">{detail.article.category}</Tag>}
                {detail.article.draft
                  ? <Tag color="orange" className="!m-0">草稿</Tag>
                  : <Tag color="green" className="!m-0">已发布</Tag>}
              </Space>
            </Card>

            <div>
              <div className="text-sm font-medium mb-2">改动记录</div>
              {detail.logs.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-xs text-zinc-400">
                      后台没有记录。<br />
                      普通文章是直接在博客仓库里编辑 md 的，那类改动不进这个列表。
                    </span>
                  }
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.logs.map((l, i) => (
                    <Card key={i} size="small">
                      <div className="flex items-center justify-between gap-2">
                        <Tag color="blue" className="!m-0">{l.action}</Tag>
                        <span className="text-xs text-zinc-400">{fmtTime(l.created_at)}</span>
                      </div>
                      <div className="mt-1 text-sm">{l.detail}</div>
                      {l.created_by_name && (
                        <div className="mt-0.5 text-xs text-zinc-400">操作人：{l.created_by_name}</div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
