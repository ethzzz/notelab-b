"use client"
// 协作画布（B 端）：列表 + 编辑器。
//
// 单页两态：
//   - 列表态：/admin/canvas
//   - 编辑态：/admin/canvas?room=<roomId>
//
// ⚠️ 编辑态刻意用 **query 参数**而不是子路由（/canvas/[roomId]）：B 端页面守卫是
//    pages.includes(pathname) 的**精确匹配**（见 (admin)/layout.tsx），子路由不在
//    PageRoutes 表里会被判无权限；而给每个房间号登记一条路由不现实。
//
// **本页面不认识任何具体引擎**：引擎的选择只体现在「新建时写一个字符串」和
// 「把 meta.engine 透传给 CanvasHost」。渲染由 components/canvas/canvas-host.tsx 分派。
import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Card, Empty, Input, Modal, Popconfirm, Segmented, Spin } from "antd"
import { ArrowLeft, Copy, PenLine, Plus, RefreshCw, Trash2 } from "lucide-react"
import CanvasHost from "@/components/canvas/canvas-host"
import {
  asEngine, createCanvas, deleteCanvas, DEFAULT_ENGINE, ENGINE_META, getCanvas, listCanvases,
  renameCanvas, type CanvasEngine, type CanvasMeta,
} from "@/lib/canvas"
import { toast } from "@/lib/toast"

const ENGINE_ORDER: CanvasEngine[] = ["tldraw", "excalidraw"]

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
  const [newEngine, setNewEngine] = useState<CanvasEngine>(DEFAULT_ENGINE)
  const [renaming, setRenaming] = useState<CanvasMeta | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async (kw?: string) => {
    setLoading(true)
    try {
      setItems(await listCanvases(kw))
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "加载画布列表失败")
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
      const r = await createCanvas(t, newEngine)
      setCreating(false)
      setNewTitle("")
      toast.success(`画布已创建（${ENGINE_META[newEngine].label}）`)
      onOpen(r.roomId)
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "创建失败")
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
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "重命名失败")
    } finally {
      setPending(false)
    }
  }

  const doDelete = async (roomId: string) => {
    try {
      await deleteCanvas(roomId)
      toast.success("画布已删除")
      void load(q)
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "删除失败")
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-800">协作画布</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            白板 / 画布编辑器，多人同屏实时协作，内容自动保存。两套引擎可选，建好即固定。
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
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setNewTitle(""); setNewEngine(DEFAULT_ENGINE); setCreating(true) }}
          >
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
          {items.map((c) => {
            const eng = asEngine(c.engine)
            const meta = ENGINE_META[eng]
            return (
              <Card
                key={c.room_id}
                className="!rounded-2xl transition hover:shadow-md"
                styles={{ body: { padding: 16 } }}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-lg">
                    {meta.badge}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-800" title={c.title}>
                      {c.title}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-zinc-500">最近编辑 {fmtTime(c.updated_at)}</span>
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
            )
          })}
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
        <div className="flex flex-col gap-4">
          <Input
            placeholder="画布名称，如「架构草图」"
            value={newTitle}
            maxLength={200}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={() => void doCreate()}
          />
          <div>
            <div className="mb-1.5 text-xs text-zinc-500">画布引擎（建好后不可更改）</div>
            <Segmented
              block
              value={newEngine}
              onChange={(v) => setNewEngine(v as CanvasEngine)}
              options={ENGINE_ORDER.map((k) => ({
                value: k,
                label: `${ENGINE_META[k].badge} ${ENGINE_META[k].label}`,
              }))}
            />
            <div className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
              {ENGINE_META[newEngine].desc}
              <br />
              两套引擎的文档格式不通用，内容不互通。
            </div>
          </div>
        </div>
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
      .catch((e: unknown) => {
        toast.error((e as Error)?.message || "画布不存在")
        router.replace("/canvas")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [roomId, router])

  if (loading) {
    return <div className="grid place-items-center py-24"><Spin /></div>
  }

  const eng = asEngine(meta?.engine)

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[560px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/canvas")}>返回</Button>
        <span className="text-base font-semibold text-zinc-800">{meta?.title || "画布"}</span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
          {ENGINE_META[eng].badge} {ENGINE_META[eng].label}
        </span>
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

      {/* 引擎需要父容器有确定尺寸：flex-1 + min-h，子元素 absolute inset-0 */}
      <div className="relative min-h-[480px] flex-1">
        <CanvasHost engine={eng} roomId={roomId} />
      </div>
    </div>
  )
}
