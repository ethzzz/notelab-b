// 复制到剪贴板：Clipboard API 仅在安全上下文（HTTPS / localhost）可用；
// 生产经 http://IP 访问时 navigator.clipboard 为 undefined，故回退到 execCommand('copy')。
// 返回是否复制成功，调用方据此给出成功/失败提示。
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 落到回退方案 */ }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.top = "-9999px"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
