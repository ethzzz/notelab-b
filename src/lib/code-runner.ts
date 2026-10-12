/**
 * 「编程学习」的运行器 —— 在浏览器里真跑代码。
 *
 * <p>当前只接 `worker` 这一档（JS/TS）：用 **Blob URL 的 Web Worker** 执行，
 * 不下载任何外部资源、零首屏成本。设计上留了口子：{@link isRunnable} 是白名单，
 * 将来接 Pyodide / sql.js（同样是 wasm 跑在 worker 里）时在这里加 id 即可，
 * **不用改页面**。
 *
 * <p>⚠️ **Worker ≠ 安全沙箱**。它只是独立线程：能 `fetch` 同源资源、能消耗 CPU。
 * 所以配了超时强杀（{@link DEFAULT_TIMEOUT_MS}）+ 硬终止，但这防的是「死循环卡页面」，
 * 不是防恶意代码。本页只在 B 端后台、仅登录用户可用，风险面就是这个范围；
 * 真要跑不可信代码得放服务端容器（那是 `server` 档的事）。
 */

export type RunLog = { level: "log" | "info" | "warn" | "error"; text: string }

export type RunResult = {
  /** 没有异常、也没超时 */
  ok: boolean
  logs: RunLog[]
  /** 同步异常 / Worker 级错误的文本（含堆栈） */
  error?: string
  /** 实际耗时（ms） */
  ms: number
  timedOut: boolean
}

/** 默认 5 秒。教学片段都是瞬时的，这个值只在该「拦住死循环」时起作用 */
export const DEFAULT_TIMEOUT_MS = 5000

/** 哪些 runner 已经接了真运行（将来加 "pyodide" / "sqljs" 就在这里加） */
const RUNNABLE_RUNNERS = new Set(["worker"])

export function isRunnable(runnerId?: string): boolean {
  return !!runnerId && RUNNABLE_RUNNERS.has(runnerId)
}

/**
 * Worker 内的执行环境。
 *
 * <p>写成字符串而不是独立 `.js` 文件：Blob URL 不经过打包器，也就不会被
 * Next 的 chunk 切分规则影响（它必须是一个「自包含、能独立执行」的脚本）。
 *
 * <p>要点：① 劫持 console 收集输出，一次回传（避免每条日志一次 postMessage）；
 * ② 50ms 缓冲让微任务/短定时器跑完；③ 捕获**异步**错误（addEventListener 而不是
 * try/catch —— setTimeout 里抛的错 try 抓不到）。
 */
const WORKER_SRC = [
  "let flushed = false",
  "const logs = []",
  "function fmt(v) {",
  "  if (typeof v === 'string') return v",
  "  if (v === undefined) return 'undefined'",
  "  if (v === null) return 'null'",
  "  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']'",
  "  if (v instanceof Error) return v.stack || String(v)",
  "  try { return JSON.stringify(v, null, 2) } catch (e) { return String(v) }",
  "}",
  ";['log', 'info', 'warn', 'error'].forEach(function (lv) {",
  "  console[lv] = function () {",
  "    var args = Array.prototype.slice.call(arguments)",
  "    logs.push({ level: lv, text: args.map(fmt).join(' ') })",
  "  }",
  "})",
  "function flush(err) {",
  "  if (flushed) return",
  "  flushed = true",
  "  self.postMessage({ logs: logs, error: err || null })",
  "}",
  "self.addEventListener('error', function (e) {",
  "  logs.push({ level: 'error', text: String((e && e.message) || e) })",
  "  flush()",
  "})",
  "self.addEventListener('unhandledrejection', function (e) {",
  "  logs.push({ level: 'error', text: 'Unhandled rejection: ' + fmt(e && e.reason) })",
  "})",
  "self.onmessage = function (e) {",
  "  try {",
  "    ;(new Function(e.data))()",
  "    setTimeout(function () { flush() }, 50)",
  "  } catch (err) {",
  "    flush(err && err.stack ? err.stack : String(err))",
  "  }",
  "}",
].join("\n")

/** 是否需要在跑之前做类型擦除 */
function needsTranspile(lang: string): boolean {
  const l = String(lang || "").toLowerCase()
  return l === "typescript" || l === "ts" || l === "tsx"
}

/**
 * 把 TS 转成能直接执行的 JS。
 *
 * <p>用 `transpileModule` —— **只擦类型、不做类型检查**（本页的定位是「看懂概念」，
 * 不是 IDE；真做类型检查要上 language service，那个成本不适合放进单个页面）。
 * `typescript` 是 devDependency，但构建期存在即可被打进 chunk（服务器 npm install
 * 不带 --omit=dev）；9MB 的包只在**第一次点运行 TS** 时才按需下载，不影响首屏。
 */
async function transpileTs(source: string): Promise<string> {
  const mod = (await import("typescript")) as unknown as { default?: typeof import("typescript") }
  const ts = mod.default ?? (mod as unknown as typeof import("typescript"))
  const out = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      // 教学片段常写 `const n = 42;` 之类不带分号的风格，用不着语法降级
      removeComments: false,
    },
    reportDiagnostics: false,
  })
  return out.outputText
}

/**
 * 跑一段代码，返回输出与状态。
 *
 * <p>每次运行都新建 Worker：状态干净（不会把上一次的全局变量带过来），
 * 而且「超时强杀」只能靠 `terminate()`，复用一个 Worker 就没法干净地杀掉。
 */
export async function runCode(source: string, lang: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RunResult> {
  const t0 = performance.now()
  let code = source

  if (needsTranspile(lang)) {
    try {
      code = await transpileTs(source)
    } catch (e) {
      return {
        ok: false,
        logs: [],
        error: "TypeScript 转译失败：" + (e instanceof Error ? e.message : String(e)),
        ms: Math.round(performance.now() - t0),
        timedOut: false,
      }
    }
  }

  return new Promise<RunResult>((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }))
    let worker: Worker
    try {
      worker = new Worker(url)
    } catch (e) {
      URL.revokeObjectURL(url)
      resolve({
        ok: false,
        logs: [],
        error: "无法创建 Worker：" + (e instanceof Error ? e.message : String(e)),
        ms: Math.round(performance.now() - t0),
        timedOut: false,
      })
      return
    }

    let settled = false
    const finish = (r: Omit<RunResult, "ms">) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve({ ...r, ms: Math.round(performance.now() - t0) })
    }

    const timer = setTimeout(
      () => finish({ ok: false, logs: [], error: `执行超时（超过 ${timeoutMs} ms，已强制中断）`, timedOut: true }),
      timeoutMs,
    )

    worker.onmessage = (ev: MessageEvent) => {
      const d = (ev.data || {}) as { logs?: RunLog[]; error?: string | null }
      finish({ ok: !d.error, logs: d.logs || [], error: d.error || undefined, timedOut: false })
    }
    worker.onerror = (ev: ErrorEvent) => {
      // Worker 脚本本身加载失败 / 未捕获错误兜底
      finish({ ok: false, logs: [], error: String(ev.message || "Worker 执行出错"), timedOut: false })
    }

    worker.postMessage(code)
  })
}
