// 前端 HTML → docx 导出（浏览器端，docx 库）：
// 支持 h1-h3 / 段落 / 加粗 / 斜体 / 下划线 / 文字颜色 / 无序有序列表 / 表格；
// 图片降级为 [图片] 占位文本。调用方传入编辑器容器元素，解析其内部 HTML。
import {
  BorderStyle, Document, HeadingLevel, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx"

type RunOpts = { bold?: boolean; italics?: boolean; underline?: {}; color?: string; size?: number }

/** HTML 颜色（hex / rgb()）→ docx 6 位 hex */
function normColor(c: string): string | undefined {
  if (!c) return undefined
  const m = c.match(/^#([0-9a-f]{6})$/i)
  if (m) return m[1].toUpperCase()
  const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("").toUpperCase()
  return undefined
}

/** 递归收集行内内容为 TextRun 序列（相邻同样式合并由 docx 自行处理） */
function inlineRuns(node: Node, opts: RunOpts, out: TextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ""
    if (text) out.push(new TextRun({ text, ...opts }))
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as HTMLElement
  const tag = el.tagName
  if (tag === "IMG") { out.push(new TextRun({ text: "[图片]", italics: true, ...opts })); return }
  if (tag === "BR") return
  const next: RunOpts = { ...opts }
  if (tag === "STRONG" || tag === "B") next.bold = true
  if (tag === "EM" || tag === "I") next.italics = true
  if (tag === "U") next.underline = {}
  const color = el.style?.color
  if (color) { const c = normColor(color); if (c) next.color = c }
  el.childNodes.forEach((c) => inlineRuns(c, next, out))
}

function headingPara(el: HTMLElement, level: number): Paragraph {
  const sizes = { 1: 40, 2: 32, 3: 28 } as Record<number, number>
  type HeadingVal = (typeof HeadingLevel)[keyof typeof HeadingLevel]
  const headings: Record<number, HeadingVal> = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }
  const runs: TextRun[] = []
  el.childNodes.forEach((c) => inlineRuns(c, { size: sizes[level] }, runs))
  return new Paragraph({ heading: headings[level], children: runs.length ? runs : [new TextRun("")] })
}

function bodyPara(el: HTMLElement, bullet: boolean, orderNo?: number): Paragraph {
  const runs: TextRun[] = []
  el.childNodes.forEach((c) => inlineRuns(c, {}, runs))
  if (orderNo != null) runs.unshift(new TextRun({ text: `${orderNo}. ` }))
  return new Paragraph({
    children: runs.length ? runs : [new TextRun("")],
    ...(bullet ? { bullet: { level: 0 } } : {}),
  })
}

function listParas(listEl: HTMLElement, ordered: boolean, out: Paragraph[]) {
  let i = 0
  Array.from(listEl.children).forEach((li) => {
    if (li.tagName !== "LI") return
    i++
    const runs: TextRun[] = []
    li.childNodes.forEach((c) => {
      // 嵌套子列表交由外层递归处理，这里只取行内内容
      if (c.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((c as HTMLElement).tagName)) return
      inlineRuns(c, {}, runs)
    })
    if (ordered) runs.unshift(new TextRun({ text: `${i}. ` }))
    out.push(new Paragraph({ children: runs.length ? runs : [new TextRun("")], ...(ordered ? {} : { bullet: { level: 0 } }) }))
    Array.from(li.children).forEach((sub) => {
      if (sub.tagName === "UL") listParas(sub as HTMLElement, false, out)
      else if (sub.tagName === "OL") listParas(sub as HTMLElement, true, out)
    })
  })
}

function tableDoc(el: HTMLElement): Table {
  const rows: TableRow[] = []
  el.querySelectorAll("tr").forEach((tr) => {
    const cells: TableCell[] = []
    tr.querySelectorAll("td,th").forEach((td) => {
      const runs: TextRun[] = []
      td.childNodes.forEach((c) => inlineRuns(c, {}, runs))
      cells.push(new TableCell({
        children: [new Paragraph({ children: runs.length ? runs : [new TextRun("")] })],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
        },
      }))
    })
    if (cells.length) rows.push(new TableRow({ children: cells }))
  })
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

/** 把编辑器容器内的 HTML 打包为 docx Blob */
export async function htmlToDocxBlob(container: HTMLElement): Promise<Blob> {
  const children: (Paragraph | Table)[] = []
  Array.from(container.children).forEach((node) => {
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === "H1") children.push(headingPara(el, 1))
    else if (tag === "H2") children.push(headingPara(el, 2))
    else if (tag === "H3") children.push(headingPara(el, 3))
    else if (tag === "UL") listParas(el, false, children as Paragraph[])
    else if (tag === "OL") listParas(el, true, children as Paragraph[])
    else if (tag === "TABLE") children.push(tableDoc(el))
    else if (tag === "P" || tag === "DIV") {
      // Quill 列表项为 <p class="ql-indent-..." style="list-style-type:...">
      const lst = el.style?.listStyleType
      if (lst === "disc" || lst === "circle" || lst === "square") children.push(bodyPara(el, true))
      else if (lst === "decimal") {
        const prev = el.previousElementSibling as HTMLElement | null
        let n = 1
        if (prev?.style?.listStyleType === "decimal") {
          const m = (prev.textContent || "").match(/^(\d+)\./)
          if (m) n = Number(m[1]) + 1
        }
        children.push(bodyPara(el, false, n))
      } else children.push(bodyPara(el, false))
    }
  })
  const doc = new Document({ sections: [{ children: children.length ? children : [new Paragraph("")] }] })
  return Packer.toBlob(doc)
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** 文件名清洗（避免非法字符） */
export function safeFileName(name?: string | null): string {
  const t = (name || "未命名文档").trim().replace(/[\\/:*?"<>|]/g, "_")
  return t || "未命名文档"
}
