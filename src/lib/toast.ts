// antd message 的轻量门面：页面沿用 sonner 风格的 toast.success/error/warning/info 调用，
// 底层由 antd <App> 上下文提供的 message 实例渲染（见 components/ToastHost.tsx）。
type MsgApi = {
  success: (content: string) => void
  error: (content: string) => void
  warning: (content: string) => void
  info: (content: string) => void
}

let inst: MsgApi | null = null

export function registerToast(api: MsgApi) {
  inst = api
}

function fallback(): MsgApi {
  // ToastHost 尚未挂载时（极早期错误）退化为 console，避免异常被吞
  return {
    success: (s) => console.info("[toast]", s),
    error: (s) => console.error("[toast]", s),
    warning: (s) => console.warn("[toast]", s),
    info: (s) => console.info("[toast]", s),
  }
}

export const toast = {
  success: (s: string) => (inst || fallback()).success(s),
  error: (s: string) => (inst || fallback()).error(s),
  warning: (s: string) => (inst || fallback()).warning(s),
  info: (s: string) => (inst || fallback()).info(s),
}
