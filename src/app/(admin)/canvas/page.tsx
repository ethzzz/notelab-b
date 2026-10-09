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
//
// 列表态走站内标准后台套件（AdminPage + FilterBar + DataTable + ModalForm），
// 与 c-users / user-roles 等页观感一致；编辑态是全屏画布，不受后台外壳约束。
import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Tag } from "antd"
import { ArrowLeft, Copy, ExternalLink, PenLine, Plus, RefreshCw, Stethoscope, Trash2 } from "lucide-react"
import CanvasHost from "@/components/canvas/canvas-host"
import { AdminPage, DataTable, FilterBar, ModalForm, actionColumn } from "@/components/admin"
import {
  asEngine, createCanvas, deleteCanvas, DEFAULT_ENGINE, ENGINE_META, getCanvas, listCanvases,
  purgeCanvasOrphans, reconcileCanvas, renameCanvas,
  type CanvasEngine, type CanvasMeta, type ReconcileResult,
} from "@/lib/canvas"
import { toast } from "@/lib/toast"

const ENGINE_ORDER: CanvasEngine[] = ["tldraw", "excalidraw"]
const ENGINE_OPTIONS = ENGINE_ORDER.map((k) => ({
  value: k,
  label: `${ENGINE_META[k].badge} ${ENGINE_META[k].label}`,
}))

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
  const [searchForm] = Form.useForm()

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<CanvasMeta | null>(null)
  const [pending, setPending] = useState(false)

  // 对账（元数据 ↔ 内容）：初始不请求，点了才拉
  const [reconOpen, setReconOpen] = useState(false)
  const [recon, setRecon] = useState<ReconcileResult | null>(null)
  const [reconLoading, setReconLoading] = useState(false)
  const [purging, setPurging] = useState(false)

  const load = useCallback(async (q?: string, engine?: string) => {
    setLoading(true)
    try {
      setItems(await listCanvases(q, engine))
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "加载画布列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const search = (v: Record<string, unknown>) =>
    void load(v.q as string | undefined, v.engine as string | undefined)

  const doCreate = async (v: { title: string; engine: CanvasEngine }) => {
    setPending(true)
    try {
      const r = await createCanvas(v.title.trim(), v.engine)
      setCreating(false)
      toast.success(`画布已创建（${ENGINE_META[v.engine].label}）`)
      onOpen(r.roomId)
    } finally {
      setPending(false)
    }
  }

  const doRename = async (v: { title: string }) => {
    if (!renaming) return
    setPending(true)
    try {
      await renameCanvas(renaming.room_id, v.title.trim())
      toast.success("已重命名")
      setRenaming(null)
      search(searchForm.getFieldsValue())
    } finally {
      setPending(false)
    }
  }

  const doDelete = async (c: CanvasMeta) => {
    try {
      const r = await deleteCanvas(c.room_id)
      // purged=false：元数据删了、协作服务没清掉房间 → 已留孤儿表，得如实说
      if (r?.purged === false) toast.warning(r.warning || "内容未清理干净，已留下孤儿表")
      else toast.success("画布已删除")
      search(searchForm.getFieldsValue())
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "删除失败")
    }
  }

  const openReconcile = async () => {
    setReconOpen(true)
    setRecon(null)
    setReconLoading(true)
    try {
      setRecon(await reconcileCanvas())
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "对账失败")
    } finally {
      setReconLoading(false)
    }
  }

  const doPurge = async () => {
    setPurging(true)
    try {
      const r = await purgeCanvasOrphans()
      toast.success(r.removedCount ? `已清理 ${r.removedCount} 个孤儿房间` : "没有需要清理的孤儿")
      setRecon(await reconcileCanvas())
      search(searchForm.getFieldsValue())
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "清理失败")
    } finally {
      setPurging(false)
    }
  }

  const columns = [
    {
      title: "名称", dataIndex: "title", width: 240,
      render: (v: string, c: CanvasMeta) => (
        <a className="font-medium text-zinc-800 dark:text-zinc-100 hover:text-indigo-600" onClick={() => onOpen(c.room_id)}>
          {v || "未命名画布"}
        </a>
      ),
    },
    {
      title: "引擎", dataIndex: "engine", width: 130,
      render: (v: string) => {
        const m = ENGINE_META[asEngine(v)]
        return <Tag>{m.badge} {m.label}</Tag>
      },
    },
    {
      title: "房间号", dataIndex: "room_id", width: 170,
      render: (v: string) => <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{v}</span>,
    },
    {
      title: "创建人", dataIndex: "created_by", width: 90,
      render: (v: number | null) =>
        v == null ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                  : <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">#{v}</span>,
    },
    {
      title: "最近编辑", dataIndex: "updated_at", width: 170,
      render: (v: string) => <span className="text-xs text-zinc-400 dark:text-zinc-500">{fmtTime(v)}</span>,
    },
    actionColumn((_: unknown, c: CanvasMeta) => (
      <Space size={4}>
        <Button size="small" type="text" icon={<ExternalLink size={13} />} onClick={() => onOpen(c.room_id)}>
          打开
        </Button>
        <Button size="small" type="text" icon={<PenLine size={13} />} onClick={() => setRenaming(c)}>
          重命名
        </Button>
        <Popconfirm title="删除画布"
          description={`删除「${c.title || "未命名画布"}」？画布内容不可恢复。`}
          okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
          onConfirm={() => doDelete(c)}>
          <Button size="small" type="text" danger icon={<Trash2 size={13} />}>删除</Button>
        </Popconfirm>
      </Space>
    ), 210),
  ]

  return (
    <AdminPage
      title="协作画布"
      description="白板 / 画布编辑器，多人同屏实时协作，内容自动保存。两套引擎可选，建好即固定。"
      extra={
        <>
          <Button icon={<RefreshCw size={14} />} onClick={() => search(searchForm.getFieldsValue())}>刷新</Button>
          <Button icon={<Stethoscope size={14} />} onClick={() => void openReconcile()}>对账</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>新建画布</Button>
        </>
      }
    >
      <Card size="small" className="shadow-sm">
        {/* 查询表单走站内标准 FilterBar：inline Form + 查询/重置 */}
        <FilterBar form={searchForm} onSearch={search} loading={loading}>
          <Form.Item name="q" label="名称">
            <Input allowClear placeholder="模糊匹配画布名称" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="engine" label="引擎">
            <Select allowClear placeholder="全部引擎" style={{ width: 160 }} options={ENGINE_OPTIONS} />
          </Form.Item>
        </FilterBar>

        <DataTable rowKey="room_id" columns={columns as any} dataSource={items} loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t: number) => `共 ${t} 个画布` }} />
      </Card>

      {creating && (
        <ModalForm
          open title="➕ 新建画布" entity="canvas"
          okText="创建并打开" cancelText="取消" confirmLoading={pending}
          initialValues={{ title: "", engine: DEFAULT_ENGINE }}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => doCreate(v as { title: string; engine: CanvasEngine })}
        >
          <Form.Item name="title" label="画布名称" required
            rules={[{ required: true, whitespace: true, message: "请填写画布名称" }, { max: 200, message: "最多 200 字" }]}>
            <Input placeholder="如：架构草图" maxLength={200} autoFocus />
          </Form.Item>
          <Form.Item name="engine" label="画布引擎" extra="两套引擎的文档格式不通用、内容不互通，建好后不可更改">
            <Select options={ENGINE_OPTIONS} />
          </Form.Item>
        </ModalForm>
      )}

      {renaming && (
        <ModalForm
          open title={`✏️ 重命名 · ${renaming.title || "未命名画布"}`} entity="canvas"
          okText="保存" cancelText="取消" confirmLoading={pending}
          initialValues={{ title: renaming.title }}
          onCancel={() => setRenaming(null)}
          onSubmit={(v) => doRename(v as { title: string })}
        >
          <Form.Item name="title" label="画布名称" required
            rules={[{ required: true, whitespace: true, message: "请填写名称" }, { max: 200, message: "最多 200 字" }]}>
            <Input maxLength={200} autoFocus />
          </Form.Item>
        </ModalForm>
      )}

      <Modal
        open={reconOpen}
        title="🩺 画布对账（元数据 ↔ 内容）"
        width={760}
        onCancel={() => setReconOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setReconOpen(false)}>关闭</Button>
            <Button danger type="primary" loading={purging}
              disabled={!recon?.orphanContent?.length}
              onClick={() => void doPurge()}>
              清理孤儿内容{recon?.orphanContent?.length ? `（${recon.orphanContent.length}）` : ""}
            </Button>
          </Space>
        }
      >
        <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 mb-3">
          画布<strong>元数据</strong>在 MySQL、<strong>内容</strong>在协作服务的 SQLite，两边只靠 room_id 关联，
          删除是跨进程两步 —— 所以要对账。
        </div>

        {reconLoading ? (
          <div className="py-8 text-center text-sm text-zinc-400">对账中…</div>
        ) : !recon ? (
          <div className="py-8 text-center text-sm text-zinc-400">未取到结果</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              元数据 <b className="text-zinc-800 dark:text-zinc-100">{recon.metaCount}</b> 条 ·
              内容 <b className="text-zinc-800 dark:text-zinc-100">{recon.contentCount}</b> 个房间
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                ① 有内容、没元数据（{recon.orphanContent.length}）— 删画布时清房间失败留下的，可清理
              </div>
              <DataTable size="small" rowKey="roomId" pagination={false}
                dataSource={recon.orphanContent}
                columns={[
                  { title: "房间号", dataIndex: "roomId", render: (v: string) => <span className="font-mono text-[11px]">{v}</span> },
                  { title: "引擎", dataIndex: "engine", width: 110 },
                  { title: "表数", dataIndex: "tables", width: 70 },
                  { title: "行数", dataIndex: "rows", width: 80 },
                ] as any}
                locale={{ emptyText: "没有孤儿内容 🎉" }} />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                ② 有元数据、没内容（{recon.orphanMeta.length}）— ⚠️ 多数是正常的
              </div>
              <div className="mb-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                房间表是懒建的：只建了元数据、从没打开过编辑器就没有表。这里**只作提示，不提供批量删除**。
              </div>
              <DataTable size="small" rowKey="roomId" pagination={false}
                dataSource={recon.orphanMeta}
                columns={[
                  { title: "房间号", dataIndex: "roomId", render: (v: string) => <span className="font-mono text-[11px]">{v}</span> },
                  { title: "标题", dataIndex: "title" },
                  { title: "引擎", dataIndex: "engine", width: 110 },
                  { title: "最近编辑", dataIndex: "updated_at", width: 160 },
                ] as any}
                locale={{ emptyText: "无" }} />
            </div>
          </div>
        )}
      </Modal>
    </AdminPage>
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
    return <div className="grid place-items-center py-24"><span className="text-sm text-zinc-400">加载中…</span></div>
  }

  const eng = asEngine(meta?.engine)

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/canvas")}>返回</Button>
        <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{meta?.title || "画布"}</span>
        <Tag className="!m-0">{ENGINE_META[eng].badge} {ENGINE_META[eng].label}</Tag>
        <Tag color="success" className="!m-0">实时协作中</Tag>
        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">#{roomId}</span>
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
