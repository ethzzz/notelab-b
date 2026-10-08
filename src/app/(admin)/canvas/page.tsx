"use client"
// 协作画布（B 端）：列表 + tldraw 编辑器
//
// 单页两态：
//   - 列表态：/admin/canvas
//   - 编辑态：/admin/canvas?room=<roomId>
//
// ⚠️ 编辑态刻意用 **query 参数**而不是子路由（/canvas/[roomId]）：B 端页面守卫是
//    pages.includes(pathname) 的**精确匹配**（见 (admin)/layout.tsx），子路由不在
//    PageRoutes 表里会被判无权限；而给每个房间号登记一条路由不现实。
//
// 元数据（标题等）走 Java /api/canvas；画布内容的实时同步由 CanvasBoard 里的
// useSync 连协作服务（/collab/connect/<roomId>）完成，两者互不干扰。
import { Suspense, useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Card, Empty, Input, Modal, Popconfirm, Spin } from "antd"
import { ArrowLeft, Copy, PenLine, Plus, RefreshCw, Trash2 } from "lucide-react"
import {
  createCanvas, deleteCanvas, getCanvas, listCanvases, renameCanvas, type CanvasMeta,
} from "@/lib/canvas"
import { toast } from "@/lib/toast"

// tldraw 依赖浏览器环境且体积大：只在进入编辑态时才加载
const CanvasBoard = dynamic(() => import("@/components/canvas-board"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-zinc-500">
        <Spin />
        <span>正在加载画布引擎…</span>
      </div>
    </div>
  ),
})

/** MySQL DATETIME（"YYYY-MM-DD HH:mm:ss"）在部分浏览器 new Date 会 NaN，补 T 再解析 */
function fmtTime(s?: string | null): string {
  if (!s) return "-"
  const d = new Date(String(s).replace(" ", "T"))
  if (Number.isNaN(d.getTime())) return String(s)
  return d.toLocaleString("zh-CN", { hour12: false })
}

export default function CanvasPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
      <CanvasInner />
    </Suspense>
  )
}

function CanvasInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const roomId = sp.get("room") || ""
  if (roomId) return <EditorView roomId={roomId} />
  return <ListView onOpen={(r) => router.push(`/canvas?room=${r}`)} />
}

// ---------------------------------------------------------------- 列表态

function ListView({ onOpen }: { onOpen: (roomId: string) => void }) {
  const [items, setItems] = useState<CanvasMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [renaming, setRenaming] = useState<CanvasMeta | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async (kw?: string) => {
    setLoading(true)
    try {
      setItems(await listCanvases(kw))
    } catch (e: any) {
      toast.error(e?.message || "加载画布列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const doCreate = async () => {
    const t = newTitle.trim()
    if (!t) { toast.error("请填写画布名称"); return }
    setPending(true)
    try {
      const r = await createCanvas(t)
      setCreating(false)
      setNewTitle("")
      toast.success("画布已创建")
      onOpen(r.roomId)
    } catch (e: any) {
      toast.error(e?.message || "创建失败")
    } finally {
      setPending(false)
    }
  }

  const doRename = async () => {
    if (!renaming) return
    const t = renameTitle.trim()
    if (!t) { toast.error("请填写名称"); return }
    setPending(true)
    try {
      await renameCanvas(renaming.room_id, t)
      toast.success("已重命名")
      setRenaming(null)
      void load(q)
    } catch (e: any) {
      toast.error(e?.message || "重命名失败")
    } finally {
      setPending(false)
    }
  }

  const doDelete = async (roomId: string) => {
    try {
      await deleteCanvas(roomId)
      toast.success("画布已删除")
      void load(q)
    } catch (e: any) {
      toast.error(e?.message || "删除失败")
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-800">协作画布</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            tldraw 白板：图形 / 便签 / 富文本卡片 / 手绘。多人同屏实时协作，内容自动保存。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input.Search
            placeholder="搜索画布名称"
            allowClear
            style={{ width: 200 }}
            onSearch={(v) => { setQ(v); void load(v) }}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => void load(q)}>刷新</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setNewTitle(""); setCreating(true) }}>
            新建画布
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Spin /></div>
      ) : items.length === 0 ? (
        <Card className="!rounded-2xl">
          <Empty description={q ? "没有匹配的画布" : "还没有画布，点右上角新建一个"} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <Card
              key={c.room_id}
              className="!rounded-2xl transition hover:shadow-md"
              styles={{ body: { padding: 16 } }}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-lg">
                  🖌️
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-800" title={c.title}>
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    最近编辑 {fmtTime(c.updated_at)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400">#{c.room_id}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-black/5 pt-3">
                <Button size="small" type="primary" ghost onClick={() => onOpen(c.room_id)}>
                  打开
                </Button>
                <Button
                  size="small"
                  type="text"
                  icon={<PenLine size={13} />}
                  onClick={() => { setRenaming(c); setRenameTitle(c.title) }}
                >
                  重命名
                </Button>
                <Popconfirm
                  title="删除后画布内容不可恢复，确定删除？"
                  onConfirm={() => void doDelete(c.room_id)}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" type="text" danger className="ml-auto" icon={<Trash2 size={13} />}>
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="新建画布"
        open={creating}
        onOk={() => void doCreate()}
        onCancel={() => setCreating(false)}
        confirmLoading={pending}
        okText="创建并打开"
        cancelText="取消"
      >
        <Input
          placeholder="画布名称，如「架构草图」"
          value={newTitle}
          maxLength={200}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={() => void doCreate()}
        />
      </Modal>

      <Modal
        title="重命名画布"
        open={!!renaming}
        onOk={() => void doRename()}
        onCancel={() => setRenaming(null)}
        confirmLoading={pending}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={renameTitle}
          maxLength={200}
          onChange={(e) => setRenameTitle(e.target.value)}
          onPressEnter={() => void doRename()}
        />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- 编辑态

function EditorView({ roomId }: { roomId: string }) {
  const router = useRouter()
  const [meta, setMeta] = useState<CanvasMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getCanvas(roomId)
      .then((m) => { if (alive) setMeta(m) })
      .catch((e: any) => {
        toast.error(e?.message || "画布不存在")
        router.replace("/canvas")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [roomId, router])

  if (loading) {
    return <div className="grid place-items-center py-24"><Spin /></div>
  }

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[560px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/canvas")}>返回</Button>
        <span className="text-base font-semibold text-zinc-800">{meta?.title || "画布"}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          实时协作中
        </span>
        <span className="font-mono text-[10px] text-zinc-400">#{roomId}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            icon={<Copy size={14} />}
            onClick={() => {
              const url = `${window.location.origin}/admin/canvas?room=${roomId}`
              void navigator.clipboard?.writeText(url)
              toast.success("链接已复制（需登录后台才能打开）")
            }}
          >
            复制链接
          </Button>
        </div>
      </div>

      {/* tldraw 需要父容器有确定尺寸：flex-1 + min-h，子元素 absolute inset-0 */}
      <div className="relative min-h-[480px] flex-1">
        <CanvasBoard roomId={roomId} />
      </div>
    </div>
  )
}
