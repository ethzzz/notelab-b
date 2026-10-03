// B 端埋点 SDK（PRD-P0 · 与 notelab-c/lib/track.ts 同契约，app 固定 "b"）
//
// 为什么不复用 C 端那份：notelab-b 与 notelab-c 是两个独立仓库、不能互相 import。
// 契约（队列键 / 字段名 / 白名单 / 批大小 / 端点）必须两边一致 —— 服务端 CTrackController
// 会按同一份白名单再校验一次，改一边记得改另一边。
//
// 三条硬规矩同 C 端：props 白名单过滤 / 失败静默不阻塞交互 / 单批 ≤20 条。
// ⚠️ LLM 依赖：无。

const LS_QUEUE = "notelab.track.queue.b.v1"
const LS_ANON = "notelab.track.anon.v1"
const SS_SESSION = "notelab.track.session.v1"

const MAX_BATCH = 20
const MAX_QUEUE = 600
const MAX_PROPS_CHARS = 2000
const MAX_STR = 32
const FLUSH_AT = 5
const FLUSH_MS = 5000

/** 与 C 端共用同一个上报口（匿名可写，绕开 B 端 PermGuard） */
const DEFAULT_ENDPOINT = "/api/c/track"

function endpoint(): string | null {
  try {
    if (typeof window !== "undefined") {
      const o = (window as unknown as { __NOTELAB_TRACK__?: unknown }).__NOTELAB_TRACK__
      if (o !== undefined) return typeof o === "string" && o ? o : null
    }
  } catch { /* ignore */ }
  return DEFAULT_ENDPOINT
}

export interface TrackEvent {
  ts: number
  day: string
  app: "b"
  event: string
  session_id: string
  anon_id: string
  user_id: number | null
  path: string
  props: Record<string, unknown>
}

/** 已登记事件的 props 白名单（服务端 CTrackController.EVENT_PROPS 有同一份） */
const EVENT_PROPS: Record<string, string[]> = {
  page_view: ["referrer"],
  content_save: ["entity", "ok"],
  admin_crud: ["entity", "ok"],
  spire_publish: ["slices", "chars"],
  login_success: [],
}

const SAFE_KEY = /^[a-z][a-z0-9_]{0,23}$/
const SAFE_STR = /^[a-z0-9_-]{1,32}$/i

const hasLS = () => typeof window !== "undefined" && !!window.localStorage

function readLS(key: string): string | null {
  try { return hasLS() ? window.localStorage.getItem(key) : null } catch { return null }
}
function writeLS(key: string, v: string): void {
  try { if (hasLS()) window.localStorage.setItem(key, v) } catch { /* 静默 */ }
}

function rand16(): string {
  try {
    const a = new Uint8Array(8)
    crypto.getRandomValues(a)
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("")
  } catch {
    return ("0000000000000000" + Math.floor(Math.random() * 0xffffffffffff).toString(16)).slice(-16)
  }
}

let anonId = ""
let sessionId = ""
let userId: number | null = null

export function setTrackUser(id: number | null): void { userId = id }

export function initTrack(): { anonId: string; sessionId: string } {
  if (!anonId) {
    let a = readLS(LS_ANON)
    if (!a || !/^[0-9a-f]{16}$/.test(a)) { a = rand16(); writeLS(LS_ANON, a) }
    anonId = a
  }
  if (!sessionId) {
    let s = ""
    try { s = (typeof window !== "undefined" && window.sessionStorage.getItem(SS_SESSION)) || "" } catch { /* ignore */ }
    if (!/^[0-9a-f]{16}$/.test(s)) {
      s = rand16()
      try { if (typeof window !== "undefined") window.sessionStorage.setItem(SS_SESSION, s) } catch { /* ignore */ }
    }
    sessionId = s
  }
  wireFlush()
  return { anonId, sessionId }
}

function sanitizeProps(event: string, props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {}
  const allow = EVENT_PROPS[event]
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (allow) { if (!allow.includes(k)) continue }
    else if (!SAFE_KEY.test(k)) continue
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v
    else if (typeof v === "boolean") out[k] = v
    else if (typeof v === "string") {
      const s = v.trim()
      if (!s) continue
      if (allow ? s.length <= MAX_STR * 2 : SAFE_STR.test(s)) out[k] = s.slice(0, MAX_STR * 2)
    }
  }
  return out
}

function today(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function readQueue(): TrackEvent[] {
  const raw = readLS(LS_QUEUE)
  if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
}
function writeQueue(q: TrackEvent[]): void {
  writeLS(LS_QUEUE, JSON.stringify(q.length > MAX_QUEUE ? q.slice(-MAX_QUEUE) : q))
}

/** 记一条。永不抛异常。 */
export function track(event: string, props?: Record<string, unknown>): TrackEvent | null {
  try {
    const { anonId: a, sessionId: s } = initTrack()
    const now = new Date()
    let p = sanitizeProps(event, props)
    if (JSON.stringify(p).length > MAX_PROPS_CHARS) p = {}
    const ev: TrackEvent = {
      ts: now.getTime(), day: today(now), app: "b", event,
      session_id: s, anon_id: a, user_id: userId,
      path: typeof window !== "undefined" ? window.location.pathname : "",
      props: p,
    }
    const q = readQueue()
    q.push(ev)
    writeQueue(q)
    if (q.length >= FLUSH_AT) flush()
    return ev
  } catch { return null }
}

/** 会话内同 path 只报一次（dev StrictMode 会双调用） */
const seenPaths = new Set<string>()
export function autoPageView(): void {
  if (typeof window === "undefined") return
  const p = window.location.pathname
  if (seenPaths.has(p)) return
  seenPaths.add(p)
  track("page_view", { referrer: document.referrer ? "external" : "direct" })
}

export function flush(): { sent: number; mode: "offline" | "posted" } {
  try {
    const q = readQueue()
    if (!q.length) return { sent: 0, mode: "offline" }
    const ep = endpoint()
    if (!ep) return { sent: 0, mode: "offline" }
    const batch = q.slice(0, MAX_BATCH)
    const body = JSON.stringify({ events: batch })
    let ok = false
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        ok = navigator.sendBeacon(ep, new Blob([body], { type: "text/plain;charset=UTF-8" }))
      } else {
        void fetch(ep, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain;charset=UTF-8" }, body })
          .then(() => undefined).catch(() => undefined)
        ok = true
      }
    } catch { ok = false }
    if (ok) writeQueue(q.slice(batch.length))
    return { sent: ok ? batch.length : 0, mode: ok ? "posted" : "offline" }
  } catch { return { sent: 0, mode: "offline" } }
}

let wired = false
export function wireFlush(): void {
  if (wired || typeof window === "undefined") return
  wired = true
  try {
    window.setInterval(() => { flush() }, FLUSH_MS)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") { for (let i = 0; i < 5; i++) { const r = flush(); if (r.mode === "offline" || r.sent === 0) break } }
    })
    window.addEventListener("pagehide", () => { for (let i = 0; i < 5; i++) { const r = flush(); if (r.mode === "offline" || r.sent === 0) break } })
  } catch { /* 静默 */ }
}
