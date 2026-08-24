// TTS 语音合成：本地 Kokoro-82M（Docker :8880）优先，微软 Edge 在线 TTS（node-edge-tts）兜底
// Kokoro 本地推理无跨境网络依赖、延迟低；Kokoro 不可用时自动回退 edge-tts（3 次重试）
// POST /api/tts  body: { text: string, voice?: string, rate?: "default" | "slow" }  -> audio/mpeg
import { NextResponse } from "next/server"
import { EdgeTTS } from "node-edge-tts"
import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readFile, unlink } from "node:fs/promises"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 只允许白名单内的英语音色，防止任意注入
const VOICES = new Set([
  "en-US-AriaNeural",
  "en-US-JennyNeural",
  "en-US-GuyNeural",
  "en-GB-SoniaNeural",
])

// ---- Kokoro 本地 TTS（OpenAI 兼容接口 /v1/audio/speech）----
const KOKORO_URL = process.env.KOKORO_TTS_URL || "http://127.0.0.1:8880"
const KOKORO_KEY = process.env.KOKORO_API_KEY || ""
const KOKORO_TIMEOUT_MS = 25000

// Edge 音色 -> Kokoro 音色映射（风格尽量对齐）
const KOKORO_VOICE_MAP: Record<string, string> = {
  "en-US-AriaNeural": "af_heart",   // 温暖自然
  "en-US-JennyNeural": "af_nova",   // 清晰
  "en-US-GuyNeural": "am_michael",  // 清晰男声
  "en-GB-SoniaNeural": "bf_emma",   // 英式清晰专业
}

async function kokoroSynthesize(text: string, voice: string, speed: number): Promise<Buffer | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), KOKORO_TIMEOUT_MS)
  const started = Date.now()
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (KOKORO_KEY) headers["Authorization"] = `Bearer ${KOKORO_KEY}`
    const res = await fetch(`${KOKORO_URL}/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "tts-1", input: text, voice, response_format: "mp3", speed }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn(`[tts] Kokoro HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`)
      return null
    }
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("audio")) {
      console.warn(`[tts] Kokoro 返回非音频: ${ct}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    console.log(`[tts] Kokoro 合成 ${buf.length}B 耗时 ${Date.now() - started}ms`)
    return buf
  } catch (e: any) {
    console.warn("[tts] Kokoro 不可用，回退 edge-tts:", e?.message || e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---- 简单 LRU 内存缓存（英语学习场景重复播放率高，命中即秒回）----
const CACHE_MAX = 200
const cache = new Map<string, Buffer>()
function cacheGet(k: string): Buffer | undefined {
  const v = cache.get(k)
  if (v) { cache.delete(k); cache.set(k, v) } // 刷新热度
  return v
}
function cacheSet(k: string, v: Buffer) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  cache.set(k, v)
}

function audioResponse(buf: Buffer) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  })
}

async function edgeSynthesizeOnce(voice: string, lang: string, rate: string, text: string, file: string) {
  const tts = new EdgeTTS({
    voice,
    lang,
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    rate,
    timeout: 10000,
  })
  await tts.ttsPromise(text, file)
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 })
  }
  const text = String(body?.text ?? "").trim()
  if (!text) return NextResponse.json({ error: "合成文本不能为空" }, { status: 400 })
  if (text.length > 2000) return NextResponse.json({ error: "文本过长（最大 2000 字符）" }, { status: 400 })
  const voice = VOICES.has(body?.voice) ? body.voice : "en-US-AriaNeural"
  const rateKey = body?.rate === "slow" ? "slow" : "default"

  // 缓存命中直接返回（缓存键区分引擎，避免引擎切换后拿到错音频）
  for (const eng of ["kokoro", "edge"]) {
    const hit = cacheGet(`${eng}|${voice}|${rateKey}|${text}`)
    if (hit) return audioResponse(hit)
  }

  // 1) Kokoro 本地合成（主）
  const kbuf = await kokoroSynthesize(text, KOKORO_VOICE_MAP[voice] || "af_heart", rateKey === "slow" ? 0.85 : 1.0)
  if (kbuf) {
    cacheSet(`kokoro|${voice}|${rateKey}|${text}`, kbuf)
    return audioResponse(kbuf)
  }

  // 2) edge-tts 兜底（3 次重试，微软端点偶发抖动时重试通常成功）
  const lang = voice.startsWith("en-GB") ? "en-GB" : "en-US"
  const rate = rateKey === "slow" ? "-15%" : "default"
  const file = join(tmpdir(), `tts-${randomUUID()}.mp3`)
  let lastErr: any = null
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await edgeSynthesizeOnce(voice, lang, rate, text, file)
        const buf = await readFile(file)
        if (buf.length > 0) {
          cacheSet(`edge|${voice}|${rateKey}|${text}`, buf)
          return audioResponse(buf)
        }
        lastErr = new Error("empty audio")
      } catch (e: any) {
        lastErr = e
      }
    }
    console.error("[tts] edge 3 次合成均失败:", lastErr?.message || lastErr)
    return NextResponse.json({ error: "语音合成失败，请稍后重试" }, { status: 502 })
  } finally {
    unlink(file).catch(() => {})
  }
}