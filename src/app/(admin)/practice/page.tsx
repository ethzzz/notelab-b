"use client"

// 博客文章生成（原「练习实践」，2026-10-15 移进「博客管理」菜单）——
// 一条记录 = 一道题，写完一键发到博客的解答页；可再次发布覆盖内容，也可下线撤下来。
//
// 干什么：把「学习路线里每一篇的练习题」以及「非博客内容的自选练习」的解答沉淀下来，
// 一条记录 = 一道题，正文用 Markdown 写、可以贴截图；配好发布信息后可直接推到博客。
//
// 两个界面态（同一个路由，用查询参数区分）：
//   · 列表态  /practice                      筛选 + 表格 + 右上角「创建记录」
//   · 二级页  /practice?id=<N>&mode=view|edit 顶部标题+类型，下面编辑器 / 预览
//
// ⚠️ 二级页走 `?id=` 而**不是子路由** /practice/123：页面守卫的 pages.includes(pathname)
//    是精确匹配，子路由不在 PageRoutes 里会被判无权限（协作画布 / 编程学习踩过同一个坑）。
//
// ⚠️ 编辑态刻意分成两个保存动作（对应服务端的 kind=meta / kind=content）：
//    顶部「保存信息」管标题/类型/发布信息，内容区「保存内容」管正文。分成两个是为了**防覆盖** ——
//    改个标题不该把下面正在写的正文一起提交，反之亦然。
//
// 发布信息（module / 篇章号 / 题号 / 英文短名 / 难度 / 标签 / 描述）由 `PublishFieldsForm` 承载，
// 创建弹窗与二级页的「发布信息」弹窗**共用同一个组件** —— 它决定博客上的文件名（= URL），
// 两处各写一份必然漂移。

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Card, Empty, Form, Input, Popconfirm, Select, Space, Spin, Tag, Tooltip } from "antd"
import { ArrowLeft, Eye, Pencil, Plus, Save, Send, Trash2, Undo2 } from "lucide-react"
import { AdminPage, DataTable, FilterBar, ModalForm, actionColumn } from "@/components/admin"
import MdEditor, { MdPreview } from "@/components/md-editor"
import PublishFieldsForm from "@/components/practice/publish-fields"
import PublishConfirm from "@/components/practice/publish-confirm"
import { toast } from "@/lib/toast"
import {
  compressImage, createRecord, deleteRecord, imageRejectReason, loadMeta, loadRecord, loadRecords,
  publishFieldsOf, slugPreview, unpublishRecord, updateRecordContent, updateRecordMeta, uploadImage,
  type PracticeFields, type PracticeMeta, type PracticeRecord, type PracticeRecordFull, type PublishFields,
} from "@/lib/practice"

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">加载中…</div>}>
      <PracticeInner />
    </Suspense>
  )
}

function PracticeInner() {
  const sp = useSearchParams()
  const idRaw = sp.get("id") || ""
  // 只认纯数字，挡住 ?id=abc 这类脏参数（脏值当作没传，回到列表，不要抛错）
  const id = /^\d+$/.test(idRaw) ? Number(idRaw) : 0
  const mode = sp.get("mode") === "view" ? "view" : "edit"
  // key 带上 id/mode：切换记录或切换查看/编辑时**重建组件**，否则上一条的草稿会残留在 state 里
  if (id > 0) return <Detail key={`${id}-${mode}`} id={id} mode={mode} />
  return <List />
}

// ------------------------------------------------------------------ 展示辅助

/** 类型 Tag 的稳定配色：按值哈希取色，**不用数组下标** —— 下标法会在「加一个类型」时让所有已有类型集体换色 */
const TAG_COLORS = ["blue", "green", "orange", "purple", "cyan", "magenta", "gold", "geekblue", "volcano", "lime"]

function typeColor(value: string): string {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

/** 类型的展示名；字典里查不到就原样显示值（老记录的 type 可能已不在字典里，不该显示成空白） */
function labelOf(value: string, meta: PracticeMeta | null): string {
  return meta?.types.find((t) => t.value === value)?.label || value || "-"
}

/** 后端时间来自 String.valueOf(Timestamp)，形如 "2026-10-14 20:49:09.0" —— 去掉末尾小数秒 */
function fmtTime(s: string): string {
  if (!s) return "-"
  return s.replace(/\.\d+$/, "")
}

/** 发布状态标签（列表与详情共用） */
function PubTag({ r }: { r: PracticeRecord }) {
  if (!r.published_slug) return <Tag className="!m-0">未发布</Tag>
  return (
    <Tooltip title={`${r.published_slug} · ${fmtTime(r.published_at)}`}>
      <Tag color="green" className="!m-0">已发布</Tag>
    </Tooltip>
  )
}

// ================================================================== 列表态

function List() {
  const router = useRouter()
  const [form] = Form.useForm()

  const [meta, setMeta] = useState<PracticeMeta | null>(null)
  const [items, setItems] = useState<PracticeRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [query, setQuery] = useState<{ title: string; types: string[] }>({ title: "", types: [] })
  const [loading, setLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  /** 正在做发布二次确认的记录 id（null = 弹窗关闭） */
  const [pubId, setPubId] = useState<number | null>(null)

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => toast.error("字典加载失败"))
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const r = await loadRecords({ title: query.title, types: query.types, page, size })
      setItems(r.items || [])
      setTotal(r.total || 0)
    } catch (e) {
      toast.error(`加载失败：${(e as Error)?.message || e}`)
    } finally {
      setLoading(false)
    }
  }, [query, page, size])

  useEffect(() => { void fetchList() }, [fetchList])

  async function onDelete(id: number) {
    try {
      await deleteRecord(id)
      toast.success("已删除")
      // 删掉当前页最后一条时回退一页，否则会停在空页上（看着像"数据没了"）
      if (items.length <= 1 && page > 1) setPage(page - 1)
      else void fetchList()
    } catch (e) {
      toast.error(`删除失败：${(e as Error)?.message || e}`)
    }
  }

  /** 下线：撤掉发布态（博客上立刻 404）。记录与插图都留着，重新发布即回到同一地址。 */
  async function onUnpublish(r: PracticeRecord) {
    try {
      const res = await unpublishRecord(r.id)
      toast.success(`已下线：${res.slug}`)
      void fetchList()
    } catch (e) {
      toast.error(`下线失败：${(e as Error)?.message || e}`)
    }
  }

  const columns = useMemo(() => [
    { title: "ID", dataIndex: "id", key: "id", width: 70 },
    {
      title: "标题", dataIndex: "title", key: "title", ellipsis: true,
      render: (v: string) => <span className="font-medium">{v}</span>,
    },
    {
      title: "类型", dataIndex: "type", key: "type", width: 130,
      render: (v: string) => v
        ? <Tag color={typeColor(v)} className="!m-0">{labelOf(v, meta)}</Tag>
        : <span className="text-zinc-400">-</span>,
    },
    {
      title: "模块 / 题号", key: "module", width: 150,
      render: (_: unknown, r: PracticeRecord) => {
        const s = slugPreview(publishFieldsOf(r))
        return r.module
          ? <Tooltip title={s || ""}>
              <span className="text-zinc-600 dark:text-zinc-300">
                {r.module}{r.chapter ? ` · ${r.chapter}` : ""}{r.order_no ? ` · 第${r.order_no}题` : ""}
              </span>
            </Tooltip>
          : <span className="text-zinc-400">未填</span>
      },
    },
    { title: "发布", key: "pub", width: 100, render: (_: unknown, r: PracticeRecord) => <PubTag r={r} /> },
    {
      title: "更新时间", dataIndex: "updated_at", key: "updated_at", width: 165,
      render: (v: string) => <span className="text-zinc-500">{fmtTime(v)}</span>,
    },
    {
      title: "最新操作人", dataIndex: "updated_by_name", key: "updated_by_name", width: 120,
      render: (v: string) => v || "-",
    },
    actionColumn((_: unknown, r: PracticeRecord) => (
      <Space size={2}>
        <Button size="small" type="text" icon={<Eye size={13} />}
          onClick={() => router.push(`/practice?id=${r.id}&mode=view`)}>查看</Button>
        <Button size="small" type="text" icon={<Pencil size={13} />}
          onClick={() => router.push(`/practice?id=${r.id}&mode=edit`)}>修改</Button>
        <Button size="small" type="text" icon={<Send size={13} />}
          onClick={() => setPubId(r.id)}>发布</Button>
        {/* 下线只对「已发布」有意义；未发布时不给按钮，省得点了才被告知"无需下线" */}
        {r.published_slug && (
          <Popconfirm
            title="下线这篇文章？"
            description={`下线后博客上的 ${r.published_slug} 会立刻 404。记录与插图都会留着，重新发布即可恢复，地址不变。`}
            okText="下线" cancelText="取消"
            onConfirm={() => onUnpublish(r)}>
            <Button size="small" type="text" icon={<Undo2 size={13} />}>下线</Button>
          </Popconfirm>
        )}
        <Popconfirm title="删除这条记录？" description="删除后不可恢复（正文里引用的图片不会被回收）。"
          okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(r.id)}>
          <Button size="small" type="text" danger icon={<Trash2 size={13} />}>删除</Button>
        </Popconfirm>
      </Space>
    ), 340),
  ], [meta, items, page, router])

  return (
    <div className="flex flex-col gap-4">
      <AdminPage
        level={1}
        title="🏋️ 博客文章生成"
        description="一条记录 = 一道题：Markdown 正文 + 插图，配好发布信息后一键发到博客的解答页。发布后可随时改内容覆盖，或下线撤下来（记录与插图都保留）。"
        extra={
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            创建记录
          </Button>
        }
      />

      <FilterBar
        form={form}
        loading={loading}
        onSearch={(v) => {
          setPage(1)
          setQuery({
            title: String(v.title || ""),
            types: Array.isArray(v.types) ? (v.types as string[]) : [],
          })
        }}
      >
        <Form.Item name="title" label="标题">
          <Input allowClear placeholder="输入标题关键词" className="!w-56" />
        </Form.Item>
        <Form.Item name="types" label="类型">
          <Select
            mode="multiple"
            allowClear
            placeholder="全部类型"
            className="!min-w-64"
            maxTagCount="responsive"
            options={(meta?.types || []).map((t) => ({ value: t.value, label: t.label }))}
          />
        </Form.Item>
      </FilterBar>

      <DataTable
        size="middle"
        columns={columns as any}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
          onChange: (p: number, s: number) => { setPage(p); setSize(s) },
        }}
      />

      <ModalForm
        open={modalOpen}
        title="创建记录"
        entity="practice"
        width={760}
        confirmLoading={creating}
        initialValues={{ difficulty: "中等" }}
        onCancel={() => setModalOpen(false)}
        onSubmit={async (v) => {
          const fields: PracticeFields = {
            title: String(v.title || "").trim(),
            type: String(v.type || ""),
            module: String(v.module || ""),
            chapter: String(v.chapter || ""),
            order_no: Number(v.order_no || 0),
            slug_name: String(v.slug_name || ""),
            difficulty: String(v.difficulty || "中等"),
            tags: String(v.tags || ""),
            description: String(v.description || ""),
          }
          if (!fields.title) { toast.warning("标题不能为空"); return }
          if (!fields.type) { toast.warning("请选择类型"); return }
          setCreating(true)
          try {
            const id = await createRecord(fields)
            setModalOpen(false)
            // 建完直接进二级页面：正文在这里写（与「先建档、再填内容」的文档编辑习惯一致）
            router.push(`/practice?id=${id}&mode=edit`)
          } catch (e) {
            toast.error(`创建失败：${(e as Error)?.message || e}`)
          } finally {
            setCreating(false)
          }
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="如：两数之和 · 哈希表解法" maxLength={200} />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}
            tooltip="语言维度，用于筛选；与下面的「路线模块」不是一回事">
            <Select placeholder="选择语言类型"
              options={(meta?.types || []).map((t) => ({ value: t.value, label: t.label }))} />
          </Form.Item>
        </div>
        <div className="mt-1 mb-2 border-t border-dashed border-[rgba(128,128,128,.3)] pt-3 text-xs text-zinc-500">
          发布信息（决定博客上的文件名与归属，可稍后补）
        </div>
        <PublishFieldsForm modules={meta?.modules || []} difficulties={meta?.difficulties || ["简单", "中等", "困难"]} />
      </ModalForm>

      <PublishConfirm
        recordId={pubId}
        open={pubId != null}
        onClose={() => setPubId(null)}
        onPublished={() => void fetchList()}
      />
    </div>
  )
}

// ================================================================== 二级页（查看 / 编辑）

function Detail({ id, mode }: { id: number; mode: "view" | "edit" }) {
  const router = useRouter()
  const [meta, setMeta] = useState<PracticeMeta | null>(null)
  const [rec, setRec] = useState<PracticeRecordFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [draftTitle, setDraftTitle] = useState("")
  const [draftType, setDraftType] = useState("")
  const [pf, setPf] = useState<PublishFields>({
    module: "", chapter: "", order_no: 0, slug_name: "", difficulty: "中等", tags: "", description: "",
  })
  const [draftContent, setDraftContent] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    void loadMeta().then(setMeta).catch(() => { /* 字典失败不影响阅读 */ })
    let alive = true
    void loadRecord(id)
      .then((r) => {
        if (!alive) return
        setRec(r)
        setDraftTitle(r.title)
        setDraftType(r.type)
        setPf(publishFieldsOf(r))
        setDraftContent(r.content || "")
      })
      .catch((e) => {
        if (!alive) return
        setNotFound(true)
        toast.error(`加载失败：${(e as Error)?.message || e}`)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  // 脏判定：与「已落库的那份」比，而不是与输入框的上一次值比
  const pfDirty = !!rec && JSON.stringify(pf) !== JSON.stringify(publishFieldsOf(rec))
  const metaDirty = !!rec && (draftTitle !== rec.title || draftType !== rec.type || pfDirty)
  const contentDirty = !!rec && draftContent !== (rec.content || "")

  /** 顶部「保存信息」与服务端 kind=meta 对应；标题/类型/发布信息一次提交 */
  async function saveMeta() {
    if (!draftTitle.trim()) { toast.warning("标题不能为空"); return }
    if (!draftType) { toast.warning("类型不能为空"); return }
    setSavingMeta(true)
    try {
      const fields: PracticeFields = { title: draftTitle.trim(), type: draftType, ...pf }
      await updateRecordMeta(id, fields)
      setRec((r) => (r ? { ...r, ...fields } : r))
      toast.success("信息已保存")
    } catch (e) {
      toast.error(`保存失败：${(e as Error)?.message || e}`)
    } finally {
      setSavingMeta(false)
    }
  }

  async function saveContent() {
    setSavingContent(true)
    try {
      await updateRecordContent(id, draftContent)
      setRec((r) => (r ? { ...r, content: draftContent } : r))
      toast.success("内容已保存")
    } catch (e) {
      toast.error(`保存失败：${(e as Error)?.message || e}`)
    } finally {
      setSavingContent(false)
    }
  }

  /** 交给编辑器的上传钩子：先本地压（体验层），再传（服务端还会按体积 + mime 白名单再校验一遍） */
  async function handleUpload(file: File): Promise<string> {
    const reason = imageRejectReason(file)
    if (reason) throw new Error(reason)
    const blob = await compressImage(file)
    return uploadImage(blob)
  }

  if (loading) return <div className="p-6"><Spin /> <span className="ml-2 text-sm text-zinc-500">正在加载记录…</span></div>
  if (notFound || !rec) {
    return (
      <AdminPage title="博客文章生成">
        <Card size="small" className="shadow-sm">
          <Empty description="记录不存在或已被删除" />
          <div className="mt-3 text-center">
            <Button onClick={() => router.push("/practice")}>返回列表</Button>
          </div>
        </Card>
      </AdminPage>
    )
  }

  const dirty = metaDirty || contentDirty
  const slug = slugPreview(pf)

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部工具行：返回 / 记录号 / 未保存提示 / 右侧发布与查看-编辑切换 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button icon={<ArrowLeft size={14} />} onClick={() => router.push("/practice")}>返回列表</Button>
        <span className="text-xs text-zinc-400">#{rec.id}</span>
        <PubTag r={rec} />
        {mode === "edit" && dirty && <Tag color="orange">有未保存改动</Tag>}
        <Space className="ml-auto" size={8}>
          <Button icon={<Send size={14} />} onClick={() => setConfirmOpen(true)}>发布到博客</Button>
          {mode === "edit" ? (
            <Button onClick={() => router.replace(`/practice?id=${rec.id}&mode=view`)}>切换到查看</Button>
          ) : (
            <Button type="primary" icon={<Pencil size={14} />}
              onClick={() => router.replace(`/practice?id=${rec.id}&mode=edit`)}>修改</Button>
          )}
        </Space>
      </div>

      {/* 顶部一行：标题 + 类型 Tag，底部对齐（items-end）。
          查看态是 h2 + 彩色 Tag；编辑态换成输入控件 —— 它们是「非内容数据」的编辑区。 */}
      {mode === "view" ? (
        <div className="flex items-end gap-3 flex-wrap">
          <h2 className="m-0 text-xl font-semibold text-zinc-800 dark:text-zinc-100">{rec.title}</h2>
          <Tag color={typeColor(rec.type)} className="!m-0 !mb-0.5">{labelOf(rec.type, meta)}</Tag>
          {rec.module && (
            <Tag className="!m-0 !mb-0.5">{rec.module}{rec.chapter ? ` · ${rec.chapter}` : ""}{rec.order_no ? ` · 第${rec.order_no}题` : ""}</Tag>
          )}
          <span className="ml-auto text-xs text-zinc-400">
            创建 {fmtTime(rec.created_at)}
            {rec.created_by_name ? ` · ${rec.created_by_name}` : ""}
            {" ｜ "}
            最近更新 {fmtTime(rec.updated_at)}
            {rec.updated_by_name ? ` · ${rec.updated_by_name}` : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-end gap-3 flex-wrap">
          <Input
            size="large"
            value={draftTitle}
            maxLength={200}
            placeholder="标题"
            className="!max-w-xl"
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <Select
            size="large"
            value={draftType || undefined}
            placeholder="类型"
            className="!w-44"
            options={(meta?.types || []).map((t) => ({ value: t.value, label: t.label }))}
            onChange={(v) => { if (typeof v === "string") setDraftType(v) }}
          />
          <Button icon={<Pencil size={14} />} onClick={() => setInfoOpen(true)}>发布信息</Button>
          <Button type="primary" icon={<Save size={14} />} loading={savingMeta}
            disabled={!metaDirty} onClick={saveMeta}>保存信息</Button>
          <span className="text-xs text-zinc-400 pb-2">
            创建 {fmtTime(rec.created_at)}
            {rec.created_by_name ? ` · ${rec.created_by_name}` : ""}
          </span>
        </div>
      )}

      {/* 发布信息摘要（两种模式都显示：至少能一眼看到它对应的博客地址） */}
      <div className="text-xs text-zinc-500">
        {slug ? (
          <>
            地址标识 <code className="font-mono text-[12px]">{slug}</code>
            <span className="mx-1">·</span>
            <span className="font-mono">/blog/solutions/{slug}/</span>
            {rec.published_slug === slug && <Tag color="green" className="!m-0 !ml-2">与已发布一致</Tag>}
            {rec.published_slug && rec.published_slug !== slug && (
              <Tag color="orange" className="!m-0 !ml-2">改名后发布会让旧地址 {rec.published_slug} 失效</Tag>
            )}
          </>
        ) : (
          <>
            发布信息未填全（还差{[
              !pf.module && "路线模块", !pf.chapter && "篇章号", !pf.order_no && "题号", !pf.slug_name && "英文短名",
            ].filter(Boolean).join(" / ")}）
          </>
        )}
      </div>

      {/* 内容区。
          编辑态直接用 MdEditor —— 它在宽屏下本身就是「左源码 / 右实时预览」两栏（与 /docs 同款）。
          查看态换成 MdPreview 整宽铺满：需求要的正是「隐藏编辑器、预览占满整页」。 */}
      {mode === "view" ? (
        <Card size="small" className="shadow-sm">
          {rec.content?.trim()
            ? <MdPreview value={rec.content} />
            : <Empty description="这条记录还没有正文" />}
        </Card>
      ) : (
        <Card size="small" className="shadow-sm"
          title="正文（Markdown）"
          extra={
            <Space size={8}>
              {contentDirty && <Tag color="orange" className="!m-0">未保存</Tag>}
              <Button type="primary" size="small" icon={<Save size={13} />} loading={savingContent}
                disabled={!contentDirty} onClick={saveContent}>保存内容</Button>
            </Space>
          }>
          <MdEditor value={draftContent} onChange={setDraftContent} minHeight={560} onUploadImage={handleUpload} />
          <div className="mt-2 text-xs text-zinc-400">
            工具栏「🖼」插入图片：长边超过 1600px 会先本地压缩再上传，正文里只存一个短链接。
            发布后这些图会改由公开接口直出（匿名读者可见），正文本身不用改。
          </div>
        </Card>
      )}

      {/* 发布信息弹窗（与创建弹窗共用同一份字段组件） */}
      <ModalForm
        open={infoOpen}
        title="发布信息"
        entity="practice-publish"
        width={680}
        confirmLoading={savingMeta}
        initialValues={{ ...pf }}
        onCancel={() => setInfoOpen(false)}
        onSubmit={async (v) => {
          const next: PublishFields = {
            module: String(v.module || ""),
            chapter: String(v.chapter || ""),
            order_no: Number(v.order_no || 0),
            slug_name: String(v.slug_name || ""),
            difficulty: String(v.difficulty || "中等"),
            tags: String(v.tags || ""),
            description: String(v.description || ""),
          }
          if (!draftTitle.trim()) { toast.warning("标题不能为空"); return }
          if (!draftType) { toast.warning("类型不能为空"); return }
          setSavingMeta(true)
          try {
            const fields: PracticeFields = { title: draftTitle.trim(), type: draftType, ...next }
            await updateRecordMeta(id, fields)
            setPf(next)
            setRec((r) => (r ? { ...r, ...fields } : r))
            setInfoOpen(false)
            toast.success("发布信息已保存")
          } catch (e) {
            toast.error(`保存失败：${(e as Error)?.message || e}`)
          } finally {
            setSavingMeta(false)
          }
        }}
      >
        <PublishFieldsForm modules={meta?.modules || []} difficulties={meta?.difficulties || ["简单", "中等", "困难"]} />
      </ModalForm>

      <PublishConfirm
        recordId={confirmOpen ? id : null}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onPublished={() => {
          // 发布后刷新这条记录（发布态要立刻反映出来）
          void loadRecord(id).then((r) => setRec(r)).catch(() => { })
        }}
      />
    </div>
  )
}
