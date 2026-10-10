"use client"
// 低代码平台 · 流程编排（深化版）：条件节点带「是 / 否」两条分支，分支内可继续串节点
import { useRef, useState, type DragEvent } from "react"
import { Button, Card, Input, Modal } from "antd"
import { DeleteOutlined } from "@ant-design/icons"
import { FLOW_DEFS, KIND_LABEL, type FlowNode, type FlowPlan } from "../_lib/core"
import { ExportModal, SectionTitle } from "./ui"

/** 分支再嵌套分支没有实际意义，到第 3 层就不再展开分支列 */
const MAX_BRANCH_DEPTH = 3

const KIND_COLOR: Record<string, string> = {
  trigger: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
  condition: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  action: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  delay: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
}

function newFlowNode(type: string): FlowNode {
  return {
    id: "n" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    type,
    params: {},
    ...(type === "if" ? { branches: { yes: [], no: [] } } : {}),
  }
}

/** 一条线性链（可位于主干，也可位于某个分支内） */
function ChainEditor({ nodes, onChange, depth, dragging, setDragging, selectedId, setSelectedId }: {
  nodes: FlowNode[]
  onChange: (next: FlowNode[]) => void
  depth: number
  dragging: boolean
  setDragging: (v: boolean) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [addingAt, setAddingAt] = useState<number | null>(null)

  function insert(at: number, type: string) {
    const n = newFlowNode(type)
    const c = [...nodes]; c.splice(at, 0, n)
    onChange(c); setSelectedId(n.id); setAddingAt(null)
  }
  function remove(id: string) {
    onChange(nodes.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    onChange(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }
  function dragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const cards = Array.from(ref.current?.querySelectorAll("[data-node-id]") || []) as HTMLElement[]
    let idx = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { idx = i; break }
    }
    if (idx !== dropIndex) setDropIndex(idx)
  }
  function drop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const t = e.dataTransfer.getData("text/x-flow-type")
    setDropIndex(null); setDragging(false)
    if (t) insert(dropIndex ?? nodes.length, t)
  }

  const AddMenu = ({ at }: { at: number }) => (
    <Card size="small" className="w-52 shadow-md" styles={{ body: { padding: 6 } }}>
      <div className="flex flex-col gap-0.5">
        {FLOW_DEFS.map((d) => (
          <button key={d.type} onClick={() => insert(at, d.type)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 text-left">
            <span>{d.icon}</span>{d.name}
            <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{KIND_LABEL[d.kind]}</span>
          </button>
        ))}
      </div>
    </Card>
  )

  return (
    <div ref={ref} onDragOver={dragOver} onDrop={drop} className="flex flex-col items-center w-full">
      {nodes.map((n, i) => {
        const def = FLOW_DEFS.find((d) => d.type === n.type)!
        const active = selectedId === n.id
        const isIf = n.type === "if"
        return (
          <div key={n.id} data-node-id={n.id} className="flex flex-col items-center w-full">
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
            {dropIndex === i && dragging && <div className="w-full h-0.5 rounded bg-indigo-400 my-0.5" />}
            <div onClick={() => setSelectedId(n.id)}
              className={`group w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-all bg-white dark:bg-[#1f1f1f] ${active ? "border-indigo-400" : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-md text-sm ${KIND_COLOR[def.kind]}`}>{def.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{def.name}</div>
                  {def.params.length > 0 && (
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[220px]">
                      {def.params.map((p) => n.params[p]).filter(Boolean).join(" · ") || "未配置"}
                    </div>
                  )}
                </div>
                {isIf && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">双分支</span>
                )}
                <Button size="small" danger className="ml-auto opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); remove(n.id) }}>✕</Button>
              </div>
            </div>

            {/* 条件节点的真假两条分支 */}
            {isIf && depth < MAX_BRANCH_DEPTH && (
              <div className="grid grid-cols-2 gap-3 w-full mt-1">
                {(["yes", "no"] as const).map((side) => (
                  <div key={side} className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 p-2">
                    <div className={`text-[11px] font-medium mb-1 ${side === "yes" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                      {side === "yes" ? "✔ 条件成立" : "✘ 条件不成立"}
                    </div>
                    <ChainEditor
                      nodes={n.branches?.[side] || []}
                      onChange={(next) => patchNode(n.id, { branches: { yes: side === "yes" ? next : (n.branches?.yes || []), no: side === "no" ? next : (n.branches?.no || []) } })}
                      depth={depth + 1} dragging={dragging} setDragging={setDragging}
                      selectedId={selectedId} setSelectedId={setSelectedId} />
                    <div className="flex justify-center">
                      <button onClick={() => setAddingAt(addingAt === i * 2 + (side === "yes" ? 0 : 1) ? null : i * 2 + (side === "yes" ? 0 : 1))}
                        className="grid h-5 w-5 place-items-center rounded-full bg-white dark:bg-[#1f1f1f] border border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 text-xs hover:border-indigo-400 hover:text-indigo-500">＋</button>
                    </div>
                    {addingAt === i * 2 + (side === "yes" ? 0 : 1) && (
                      <div className="flex justify-center mt-1">
                        <BranchAddMenu onPick={(t) => {
                          const nn = newFlowNode(t)
                          const arr = side === "yes" ? (n.branches?.yes || []) : (n.branches?.no || [])
                          patchNode(n.id, {
                            branches: {
                              yes: side === "yes" ? [...arr, nn] : (n.branches?.yes || []),
                              no: side === "no" ? [...arr, nn] : (n.branches?.no || []),
                            },
                          })
                          setSelectedId(nn.id); setAddingAt(null)
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isIf && depth >= MAX_BRANCH_DEPTH && (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 py-1">分支层级已达上限，不再展开</div>
            )}

            <div className="relative flex flex-col items-center">
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
              <button onClick={() => setAddingAt(addingAt === -i - 100 ? null : -i - 100)}
                className="grid h-5 w-5 place-items-center rounded-full bg-white dark:bg-[#1f1f1f] border border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 text-xs hover:border-indigo-400 hover:text-indigo-500">＋</button>
              {addingAt === -i - 100 && <div className="absolute top-6 z-20"><AddMenu at={i + 1} /></div>}
            </div>
          </div>
        )
      })}
      {dropIndex === nodes.length && dragging && nodes.length > 0 && <div className="w-full h-0.5 rounded bg-indigo-400 my-0.5" />}
    </div>
  )
}

function BranchAddMenu({ onPick }: { onPick: (type: string) => void }) {
  return (
    <Card size="small" className="w-48 shadow-md" styles={{ body: { padding: 6 } }}>
      <div className="flex flex-col gap-0.5">
        {FLOW_DEFS.map((d) => (
          <button key={d.type} onClick={() => onPick(d.type)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 text-left">
            <span>{d.icon}</span>{d.name}
          </button>
        ))}
      </div>
    </Card>
  )
}

export default function FlowDesigner({ plan, onPatch }: {
  plan: FlowPlan | null
  onPatch: (patch: Partial<FlowPlan>) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [rootAdding, setRootAdding] = useState(false)

  const nodes: FlowNode[] = plan?.nodes || []
  const setNodes = (next: FlowNode[]) => onPatch({ nodes: next })

  /** 在所有节点（含分支）里找选中项：分支里的节点也要能在右侧配置 */
  function findNode(list: FlowNode[], id: string): FlowNode | null {
    for (const n of list) {
      if (n.id === id) return n
      if (n.branches) {
        const a = findNode(n.branches.yes || [], id); if (a) return a
        const b = findNode(n.branches.no || [], id); if (b) return b
      }
    }
    return null
  }
  const selected = selectedId ? findNode(nodes, selectedId) : null
  const selectedDef = selected ? FLOW_DEFS.find((d) => d.type === selected.type) : null

  function patchParams(id: string, key: string, value: string) {
    setNodes(mapTree(nodes, (n) => (n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n)))
  }
  function removeNode(id: string) {
    setNodes(removeFromTree(nodes, id))
    if (selectedId === id) setSelectedId(null)
  }

  if (!plan) {
    return <Card size="small"><div className="text-sm text-zinc-400 dark:text-zinc-500 py-10 text-center">请先在上方新建或选择一个流程方案</div></Card>
  }

  return (
    <div className="flex gap-4 items-start">
      {/* 节点库 */}
      <Card size="small" className="w-44 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>节点库</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {FLOW_DEFS.map((d) => (
            <div key={d.type} draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/x-flow-type", d.type); e.dataTransfer.effectAllowed = "copy"; setDragging(true) }}
              onDragEnd={() => setDragging(false)}
              onClick={() => {
                const n = newFlowNode(d.type)
                setNodes([...nodes, n]); setSelectedId(n.id)
              }}
              className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f1f] px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 cursor-grab select-none hover:border-indigo-300">
              <span>{d.icon}</span>{d.name}
              <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{KIND_LABEL[d.kind]}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 mb-0 leading-relaxed">拖到画布；条件节点下方会出现「成立 / 不成立」两条分支。</p>
      </Card>

      {/* 画布 */}
      <Card size="small" className="flex-1 min-w-0" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center mb-3">
          <SectionTitle>流程画布（{countTree(nodes)} 个节点）</SectionTitle>
          <div className="ml-auto flex gap-2">
            <Button size="small" onClick={() => setShowExport(true)} disabled={nodes.length === 0}>📤 导出 JSON</Button>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={nodes.length === 0}
              onClick={() => Modal.confirm({ title: "清空流程？", okText: "清空", okButtonProps: { danger: true }, onOk: () => { setNodes([]); setSelectedId(null) } })}>清空</Button>
          </div>
        </div>
        <div className="flex flex-col items-center max-w-2xl mx-auto py-2">
          <div className="px-4 py-1.5 rounded-full bg-zinc-700 text-white text-xs font-medium">▶ 开始</div>
          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
          <ChainEditor nodes={nodes} onChange={setNodes} depth={0}
            dragging={dragging} setDragging={setDragging}
            selectedId={selectedId} setSelectedId={setSelectedId} />
          {nodes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-3">
              <button onClick={() => setRootAdding(!rootAdding)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white dark:bg-[#1f1f1f] border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-indigo-400 hover:text-indigo-500">＋</button>
              {rootAdding && <RootAddMenu onPick={(t) => { const n = newFlowNode(t); setNodes([n]); setSelectedId(n.id); setRootAdding(false) }} />}
              <span className="text-zinc-400 dark:text-zinc-500 text-sm">从左侧拖拽节点到这里（建议先加触发器）</span>
            </div>
          )}
          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
          <div className="px-4 py-1.5 rounded-full bg-zinc-700 text-white text-xs font-medium">■ 结束</div>
        </div>
      </Card>

      {/* 节点配置 */}
      <Card size="small" className="w-72 shrink-0" styles={{ body: { padding: 12 } }}>
        <SectionTitle>节点配置</SectionTitle>
        {!selected && <div className="text-zinc-400 dark:text-zinc-500 text-sm py-6 text-center">点击流程中的节点进行配置</div>}
        {selected && selectedDef && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`grid h-8 w-8 place-items-center rounded-md text-base ${KIND_COLOR[selectedDef.kind]}`}>{selectedDef.icon}</span>
              <div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{selectedDef.name}</div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{KIND_LABEL[selectedDef.kind]}节点</div>
              </div>
            </div>
            {selectedDef.params.map((p) => (
              <div key={p}>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{p}</label>
                <Input className="mt-1" size="small" value={selected.params[p] || ""} onChange={(e) => patchParams(selected.id, p, e.target.value)} />
              </div>
            ))}
            {selectedDef.params.length === 0 && <div className="text-xs text-zinc-400 dark:text-zinc-500">该节点无需配置</div>}
            {selected.type === "if" && (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                分支节点：下方「✔ 成立 / ✘ 不成立」两列各自串节点，两列都可以用 ＋ 追加。
              </div>
            )}
            <Button size="small" danger className="self-start" onClick={() => removeNode(selected.id)}>🗑 删除节点</Button>
          </div>
        )}
      </Card>

      <ExportModal open={showExport} onClose={() => setShowExport(false)} title="导出流程 JSON"
        text={JSON.stringify({ nodes }, null, 2)} />
    </div>
  )
}

function RootAddMenu({ onPick }: { onPick: (t: string) => void }) {
  return (
    <Card size="small" className="w-52 shadow-md" styles={{ body: { padding: 6 } }}>
      <div className="flex flex-col gap-0.5">
        {FLOW_DEFS.map((d) => (
          <button key={d.type} onClick={() => onPick(d.type)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 text-left">
            <span>{d.icon}</span>{d.name}
          </button>
        ))}
      </div>
    </Card>
  )
}

// ================= 树操作 =================

function mapTree(list: FlowNode[], fn: (n: FlowNode) => FlowNode): FlowNode[] {
  return list.map((n) => {
    const x = fn(n)
    if (!x.branches) return x
    return { ...x, branches: { yes: mapTree(x.branches.yes || [], fn), no: mapTree(x.branches.no || [], fn) } }
  })
}

function removeFromTree(list: FlowNode[], id: string): FlowNode[] {
  return list.filter((n) => n.id !== id).map((n) => (
    n.branches ? { ...n, branches: { yes: removeFromTree(n.branches.yes || [], id), no: removeFromTree(n.branches.no || [], id) } } : n
  ))
}

function countTree(list: FlowNode[]): number {
  return list.reduce((acc, n) => acc + 1 + (n.branches ? countTree(n.branches.yes || []) + countTree(n.branches.no || []) : 0), 0)
}
