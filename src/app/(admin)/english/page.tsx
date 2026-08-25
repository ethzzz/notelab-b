"use client"
import { useEffect, useRef, useState } from "react"
import { api, apiJson, postJson, BASE_PATH } from "@/lib/api"
import { toast } from "@/lib/toast"
import { X } from "lucide-react"
import { Button, Card, Input, Modal } from "antd"

type Scenario = { id: string; name: string; en: string; desc: string }
type Conv = { id: number; title: string; scenario: string; scenario_name: string; updated_at: string }
type Msg = { role: string; content: string; correction?: string | null; error_note?: string | null }
type SpeakState = "idle" | "loading" | "playing" | "paused"

// 播放按钮（模块级组件：若在页面组件内联定义，每次渲染组件类型都变，播放中进度条 60fps 重渲染
// 会持续重建按钮 DOM，导致 mousedown/mouseup 落在不同节点、click 被浏览器吞掉，暂停点击失效）
function SpeakBtn({ state, onToggle }: { state: SpeakState; onToggle: () => void }) {
  const title = state === "loading" ? "语音准备中…" : state === "playing" ? "暂停播放" : state === "paused" ? "从头播放" : "播放"
  return (
    <button onClick={onToggle} title={title} className={`speak-btn ${state === "playing" ? "speak-btn-playing" : ""}`}>
      {state === "loading" ? (
        <svg className="speak-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : state === "playing" ? (
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.3" /><rect x="13.5" y="5" width="4" height="14" rx="1.3" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.54-6.86a1.05 1.05 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14z" /></svg>
      )}
    </button>
  )
}

// TTS 进度条（同上升为模块级）：loading=灰色流光，播放/暂停=绿色已读进度（暂停时冻结）
function TtsBar({ phase, progress }: { phase: "loading" | "playing" | "paused"; progress: number }) {
  return (
    <div className="tts-track">
      {phase === "loading"
        ? <div className="tts-shimmer" />
        : <div className="tts-fill" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />}
    </div>
  )
}

export default function EnglishPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [convs, setConvs] = useState<Conv[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [scenarioName, setScenarioName] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [speakingIdx, setSpeakingIdx] = useState<string | null>(null)
  const [ttsPhase, setTtsPhase] = useState<"loading" | "playing" | "paused" | null>(null)
  const [progress, setProgress] = useState(0)
  const recRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fallbackTimerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const ttsTextRef = useRef("") // 当前播放文本：兜底路径暂停后从头重播用

  // requestAnimationFrame（60fps）驱动进度条：丝滑无卡顿，速率=真实播放速率（以音频实际时长为准，缓存秒回时同样完整展示）
  function startProgressLoop(audio: HTMLAudioElement) {
    cancelProgressLoop()
    const tick = () => {
      if (audio.duration && isFinite(audio.duration)) setProgress(Math.min(1, audio.currentTime / audio.duration))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }
  function cancelProgressLoop() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }
  const playSeqRef = useRef(0) // 播放序号：识别「当前播放」，旧音频残留事件一律忽略
  const listRef = useRef<HTMLDivElement | null>(null) // 消息列表容器，用于贴底滚动

  // 兜底：浏览器原生 speechSynthesis（在线 TTS 不可用时）；无进度事件，按语速估算进度
  function fallbackSpeak(text: string, playId: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { toast.warning("当前浏览器不支持语音播报"); stopSpeak(); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-US"
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"))
    if (voices.length) u.voice = voices[0]
    u.rate = 0.95
    setTtsPhase("playing")
    const estMs = Math.max(1500, text.split(/\s+/).length * 380)
    const t0 = Date.now()
    fallbackTimerRef.current = setInterval(() => setProgress(Math.min(0.97, (Date.now() - t0) / estMs)), 200)
    const done = () => {
      if (playSeqRef.current !== playId) return
      if (fallbackTimerRef.current) { clearInterval(fallbackTimerRef.current); fallbackTimerRef.current = null }
      setSpeakingIdx(null); setTtsPhase(null); setProgress(0)
    }
    u.onend = done
    u.onerror = done
    window.speechSynthesis.speak(u)
  }

  function stopSpeak() {
    cancelProgressLoop()
    abortRef.current?.abort()
    abortRef.current = null
    playSeqRef.current++ // 使旧播放的所有待触发事件失效
    if (audioRef.current) {
      const a = audioRef.current
      a.onended = null; a.onerror = null; a.onplay = null // 先摘事件：清理旧 audio 触发的 error 回调不能冲掉新状态
      a.pause()
      audioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    if (fallbackTimerRef.current) { clearInterval(fallbackTimerRef.current); fallbackTimerRef.current = null }
    setSpeakingIdx(null)
    setTtsPhase(null)
    setProgress(0)
  }

  /** 暂停：保留音频供下次「从头播放」，进度条冻结在当前位置 */
  function pauseSpeak() {
    if (audioRef.current) {
      audioRef.current.pause()
      cancelProgressLoop()
      setTtsPhase("paused")
      return
    }
    // 兜底 speechSynthesis：直接取消播报，文本已记录，下次点击从头重说
    playSeqRef.current++ // 使 onend/onerror 残留事件失效
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    if (fallbackTimerRef.current) { clearInterval(fallbackTimerRef.current); fallbackTimerRef.current = null }
    setTtsPhase("paused")
  }

  /** 从头播放：在线音频 currentTime 归零重放；兜底路径重新朗读 */
  function resumeSpeak() {
    if (audioRef.current) {
      const a = audioRef.current
      a.currentTime = 0
      setTtsPhase("playing")
      a.play().catch(() => stopSpeak())
      startProgressLoop(a)
      return
    }
    if (!ttsTextRef.current) { stopSpeak(); return }
    const playId = ++playSeqRef.current
    fallbackSpeak(ttsTextRef.current, playId)
  }

  async function speak(text: string, key: string) {
    if (!text.trim()) return
    if (speakingIdx === key) {
      if (ttsPhase === "playing") { pauseSpeak(); return }  // 播放中 → 暂停
      if (ttsPhase === "paused") { resumeSpeak(); return }  // 已暂停 → 从头播放
      stopSpeak(); return                                   // 加载中 → 取消
    }
    stopSpeak()
    ttsTextRef.current = text
    const playId = ++playSeqRef.current // 本次播放的唯一序号
    setSpeakingIdx(key)
    setTtsPhase("loading")
    setProgress(0)
    const ac = new AbortController()
    abortRef.current = ac
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; ac.abort() }, 12000) // 在线合成超 12s 放弃，回退浏览器 TTS

    try {
      const res = await fetch(`${BASE_PATH}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: ac.signal,
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error("tts " + res.status)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      const done = () => {
        if (playSeqRef.current !== playId) return // 旧播放的事件，忽略
        cancelProgressLoop(); setSpeakingIdx(null); setTtsPhase(null); setProgress(0); URL.revokeObjectURL(url)
      }
      audio.onended = done
      audio.onerror = done
      audio.onplay = () => { if (playSeqRef.current === playId) setTtsPhase("playing") }
      await audio.play()
      if (playSeqRef.current !== playId) return // 启动期间被停止/切换
      setTtsPhase("playing")
      startProgressLoop(audio)
    } catch (e: any) {
      clearTimeout(timer)
      if (e?.name === "AbortError") {
        if (timedOut) { fallbackSpeak(text, playId) }
        return
      }
      fallbackSpeak(text, playId)
    }
  }

  async function selectConv(id: number) {
    setCurrentId(id)
    try {
      const j = await apiJson(`/api/english/conversations/${id}/messages`)
      setMessages(j.messages || [])
      setScenarioName(j.conversation?.scenario_name || "")
    } catch { setMessages([]) }
  }
  async function loadConvs(selectFirst = false) {
    const j = await apiJson("/api/english/conversations")
    const list: Conv[] = j.conversations || []
    setConvs(list)
    if (selectFirst && list.length > 0) await selectConv(list[0].id)
  }
  async function createConv(scenarioId: string) {
    setShowPicker(false)
    const j = await postJson("/api/english/conversations", { scenario: scenarioId })
    await loadConvs(false)
    await selectConv(j.id)
  }
  function deleteConv(id: number) {
    Modal.confirm({
      title: "删除英语对话",
      content: "删除后该对话及其记录不可恢复，确定删除？",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        await api(`/api/english/conversations/${id}`, { method: "DELETE" }).catch(() => {})
        if (currentId === id) { setCurrentId(null); setMessages([]); setScenarioName("") }
        await loadConvs(false).catch(() => {})
      },
    })
  }

  useEffect(() => {
    apiJson("/api/english/scenarios").then((j) => setScenarios(j.scenarios || [])).catch(() => {})
    loadConvs(true).catch(() => {})
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices()
    if (typeof window !== "undefined") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR) {
        const rec = new SR()
        rec.lang = "en-US"
        rec.interimResults = false
        rec.onresult = (e: any) => {
          const t = e.results[0][0].transcript
          setInput((prev) => (prev ? prev.trim() + " " : "") + t)
        }
        rec.onend = () => setListening(false)
        rec.onerror = () => setListening(false)
        recRef.current = rec
      }
    }
    return () => { stopSpeak(); stopTyping() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 贴底滚动：用容器 scrollTop 瞬时到底实现。
  // 不用 scrollIntoView({smooth})：流式打字时 messages 每帧更新，平滑动画被高频重启会造成画面抖动。
  // 流式回复中（busy）内容不断增长：始终跟随到底；非流式变更（加载历史等）仅在已近底时贴底，
  // 用户上翻查看历史时不强行拉回。
  const prevGapRef = useRef(0)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    if (busy || prevGapRef.current < 160) el.scrollTop = el.scrollHeight
    prevGapRef.current = el.scrollHeight - el.scrollTop - el.clientHeight
  }, [messages, busy])

  function toggleMic() {
    const rec = recRef.current
    if (!rec) { toast.warning("当前浏览器不支持语音输入（请用 Chrome/Edge）"); return }
    if (listening) rec.stop()
    else { setListening(true); rec.start() }
  }

  /** 指定语句的播放按钮状态：非当前播放项一律 idle */
  const speakStateOf = (k: string): SpeakState => (speakingIdx === k && ttsPhase) ? ttsPhase : "idle"

  // ---- AI 回复打字机：SSE delta 先进缓冲区，rAF 匀速推进显示，网络分片再毛刺也能平滑打字 ----
  const typeBufRef = useRef("")      // 已从 SSE 收到的完整文本
  const typeShownRef = useRef(0)     // 已显示到缓冲区的字符数
  const typeDoneRef = useRef(false)  // SSE 流已结束（缓冲区追赶完即收尾）
  const typeRafRef = useRef<number | null>(null)
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null) // 正在打字的消息下标（光标/禁用播放用）

  function stopTyping() {
    if (typeRafRef.current) { cancelAnimationFrame(typeRafRef.current); typeRafRef.current = null }
  }
  /** 立即全量显示缓冲文本（出错/收尾时用），返回是否还有未显示内容 */
  function flushTyping(patch: (s: string) => void) {
    stopTyping()
    const pending = typeBufRef.current.length - typeShownRef.current
    if (pending > 0) { typeShownRef.current = typeBufRef.current.length; patch(typeBufRef.current) }
    setStreamingIdx(null)
  }
  /** 启动打字循环（幂等）：每帧按待显示积压自适应推进 1~4 字符 */
  function ensureTyping(patch: (s: string) => void) {
    if (typeRafRef.current != null) return
    let last = performance.now()
    const tick = (now: number) => {
      const total = typeBufRef.current.length
      if (typeShownRef.current < total) {
        const dt = now - last
        if (dt >= 16) {
          const pending = total - typeShownRef.current
          const step = pending > 80 ? 4 : pending > 24 ? 2 : 1
          typeShownRef.current = Math.min(total, typeShownRef.current + step * Math.max(1, Math.floor(dt / 16)))
          last = now
          patch(typeBufRef.current.slice(0, typeShownRef.current))
        }
        typeRafRef.current = requestAnimationFrame(tick)
      } else if (!typeDoneRef.current) {
        typeRafRef.current = requestAnimationFrame(tick) // 等新分片到达
      } else {
        typeRafRef.current = null
        setStreamingIdx(null)
      }
    }
    typeRafRef.current = requestAnimationFrame(tick)
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    if (!currentId) { toast.warning("请先点「新对话」选一个场景"); return }
    setInput(""); setBusy(true)
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }])
    setStreamingIdx(null)
    typeBufRef.current = ""; typeShownRef.current = 0; typeDoneRef.current = false
    const patchUser = (correction: string | null, errorNote: string | null) => {
      setMessages((prev) => { const c = [...prev]; c[c.length - 2] = { role: "user", content: text, correction, error_note: errorNote }; return c })
    }
    const patchAssistant = (content: string) => {
      setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content }; return c })
    }
    setStreamingIdx(-1) // 占位：发送后最后一条恒为待打字消息，渲染时按「最后一条 assistant」匹配
    try {
      const resp = await api("/api/english/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: currentId, message: text }),
      })
      if (!resp.ok || !resp.body) {
        let err = `HTTP ${resp.status}`
        try { const j = await resp.json(); if (j.error) err = j.error } catch { /* 非 JSON */ }
        stopTyping(); setStreamingIdx(null)
        patchAssistant("⚠️ " + err)
        setBusy(false)
        return
      }
      // SSE 流式读取：delta 事件持续增量输出回复（进打字机缓冲），correction 事件在流尾补上语法修正
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() || ""
        for (const p of parts) {
          const line = p.trim()
          if (!line.startsWith("data:")) continue
          try {
            const j = JSON.parse(line.slice(5).trim())
            if (j.correction) {
              patchUser(j.correction.corrected ?? text, j.correction.error_note ?? "")
            } else if (j.delta) {
              typeBufRef.current += j.delta
              ensureTyping(patchAssistant)
            } else if (j.error) {
              flushTyping(patchAssistant)
              patchAssistant((typeBufRef.current ? typeBufRef.current + "\n" : "") + "⚠️ " + j.error)
            }
          } catch { /* 忽略碎片 */ }
        }
      }
      typeDoneRef.current = true // 流结束：打字循环追完缓冲区后自行收尾
      if (!typeBufRef.current) { stopTyping(); setStreamingIdx(null); patchAssistant("⚠️ 模型未返回内容，请重试") }
    } catch (e: any) {
      flushTyping(patchAssistant)
      patchAssistant((typeBufRef.current ? typeBufRef.current + "\n" : "") + "⚠️ " + (e.message || "请求失败"))
    }
    setBusy(false)
    loadConvs(false).catch(() => {})
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-6.5rem)]">
      {/* 会话列表 */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <Button type="primary" block onClick={() => setShowPicker(true)}>＋ 新对话（选场景）</Button>
        <Card size="small" className="flex-1 overflow-y-auto" styles={{ body: { padding: 8 } }}>
          {convs.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-6">暂无对话</div>}
          <div className="flex flex-col gap-0.5">
            {convs.map((c) => (
              <div key={c.id} onClick={() => selectConv(c.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${c.id === currentId ? "bg-indigo-50 text-indigo-600 font-medium dark:bg-indigo-500/15 dark:text-indigo-300" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}>
                <span className="flex-1 truncate">{c.scenario_name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {scenarioName && <div className="mb-2"><span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 text-xs font-medium px-3 py-1 rounded-full">场景：{scenarioName}</span></div>}
        <div className="flex-1 min-h-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f1f] p-4">
          <div ref={listRef} className="h-full overflow-y-auto flex flex-col gap-4">
            {messages.length === 0 && <div className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-10">选一个场景，开始练口语吧</div>}
          {messages.map((m, i) => {
            const isTyping = streamingIdx !== null && i === messages.length - 1 && m.role === "assistant"
            const skeleton = isTyping && busy && !m.content // 等待首个分片：骨架流光气泡
            return (
            <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
              {/* 行占满宽（w-full）：气泡 max-w-[70%] 需要确定的参照宽度，否则收缩包裹行会导致短文本被压窄换行、长文本右侧留空白；用户消息行 justify-end 贴右 */}
              <div className={`w-full flex items-center gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "user" && <SpeakBtn state={speakStateOf(`u${i}`)} onToggle={() => speak(m.content, `u${i}`)} />}
                {/* 打字中 min-w-[200px]：防止气泡从骨架骤缩到几十字符宽再逐字撑大（宽度跳变＝视觉抖动），也避免首帧内容比气泡宽被裁切 */}
                <div className={`max-w-[70%] ${isTyping ? "min-w-[200px]" : "min-w-0"} overflow-hidden rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${m.role === "user" ? "bg-indigo-500 text-white" : "bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100"}`}>
                  {skeleton ? (
                    <div className="skeleton-bubble"><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line" /></div>
                  ) : (
                    <>{m.content}{isTyping && m.content && <span className="typing-cursor" />}</>
                  )}
                </div>
                {m.role === "assistant" && !isTyping && <SpeakBtn state={speakStateOf(`a${i}`)} onToggle={() => speak(m.content, `a${i}`)} />}
              </div>
              {(speakingIdx === `u${i}` || speakingIdx === `a${i}`) && ttsPhase && (
                <div className="w-52 mt-1"><TtsBar phase={ttsPhase} progress={progress} /></div>
              )}
              {m.role === "user" && m.correction && (m.correction !== m.content || m.error_note) && (
                <div className="max-w-[70%] bg-amber-50 border border-amber-200 dark:bg-amber-400/10 dark:border-amber-400/25 rounded-lg px-3 py-2 text-xs flex flex-col gap-1.5">
                  <div className="font-semibold text-amber-700 dark:text-amber-300">{m.correction !== m.content ? "✏️ 语法修正" : "✅ 语法检查"}</div>
                  {m.correction !== m.content && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <SpeakBtn state={speakStateOf(`c${i}`)} onToggle={() => speak(m.correction || "", `c${i}`)} />
                        <span className="text-zinc-700 dark:text-zinc-200 break-words [overflow-wrap:anywhere]">{m.correction}</span>
                      </div>
                      {speakingIdx === `c${i}` && ttsPhase && (
                        <div className="w-44 ml-7 mt-0.5"><TtsBar phase={ttsPhase} progress={progress} /></div>
                      )}
                    </div>
                  )}
                  {m.error_note && <div className="text-zinc-500 dark:text-zinc-400">📝 {m.error_note}</div>}
                </div>
              )}
            </div>
            )
          })}
          </div>
        </div>
        <div className="flex gap-2 mt-3 items-stretch">
          <Button onClick={toggleMic} title="语音输入"
            className="!w-12 !h-auto !text-lg"
            danger={listening} type={listening ? "primary" : "default"}>
            {listening ? "⏹" : "🎤"}
          </Button>
          <Input.TextArea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type your English here...（Enter 发送）"
            className="flex-1 resize-none" rows={2} />
          <Button type="primary" className="!h-auto" onClick={send} loading={busy} disabled={!input.trim()}>
            发送
          </Button>
        </div>
      </div>

      {/* 场景选择弹窗 */}
      <Modal open={showPicker} onCancel={() => setShowPicker(false)} title="选择对话场景" footer={null} width={520} destroyOnHidden>
        <div className="grid grid-cols-2 gap-3">
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => createConv(s.id)}
              className="border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg p-4 text-left transition-all">
              <div className="font-semibold text-sm">{s.en}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{s.name}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}