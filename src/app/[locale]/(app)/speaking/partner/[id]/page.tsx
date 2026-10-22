'use client'

/**
 * /speaking/partner/[id] — 口语对话页（T19 验收 4/5/7）。
 *
 * **语音降级策略**：浏览器不支持 SpeechRecognition → 自动切文本输入模式
 * （发送时 `wasTextInput=true`），评分链路不变。
 * AI 回复经 SSE 逐帧渲染 + speechSynthesis 朗读（不支持时静默跳过）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Send } from 'lucide-react'

import { AppShell } from '@/components/layout/app-shell'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { SkeletonCard } from '@/components/common/skeleton-kit'
import { ChatBubble } from '@/features/speaking/components/chat-bubble'
import { StartSpeakingButton, Waveform } from '@/features/speaking/components/speaking-controls'
import { useMediaRecorder } from '@/features/speaking/hooks/use-media-recorder'
import { useSpeechRecognition } from '@/features/speaking/hooks/use-speech-recognition'
import { useSpeechSynthesis } from '@/features/speaking/hooks/use-speech-synthesis'
import { speakingApi } from '@/features/speaking/api'
import type { SpeakingMessageItem } from '@/features/speaking/types'
import { ROUTES } from '@/lib/constants/routes'

export default function SpeakingPartnerPage(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const sessionId = params.id
  const router = useRouter()

  const [messages, setMessages] = useState<SpeakingMessageItem[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ending, setEnding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef(Date.now())

  const { unsupported: sttUnsupported, listening, transcript, start: startListening, stop: stopListening, reset: resetTranscript } = useSpeechRecognition()
  const { speak } = useSpeechSynthesis()
  const recorder = useMediaRecorder()

  // 加载历史消息（含欢迎语）
  useEffect(() => {
    let cancelled = false
    void speakingApi
      .messages(sessionId)
      .then((rows) => {
        if (!cancelled) setMessages(rows)
      })
      .catch(() => {
        if (!cancelled) setError('会话加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // 语音转写结果自动填入输入框（支持语音时）
  useEffect(() => {
    if (transcript !== '') setInput(transcript)
  }, [transcript])

  // 新消息滚动到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, sending])

  const send = useCallback(async () => {
    const text = input.trim()
    if (text.length === 0 || sending) return
    setSending(true)
    setInput('')
    resetTranscript()
    // 本地先渲染用户消息（服务端同步落库）
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, speaker: 'USER', textContent: text, createdAt: new Date().toISOString() }])
    try {
      const r = await speakingApi.sendMessage(
        sessionId,
        {
          text,
          // 验收 5：浏览器不支持语音（或用户主动用文本）→ wasTextInput=true
          wasTextInput: sttUnsupported || true,
          durationMs: recorder.durationMs(),
          sttProvider: sttUnsupported ? 'manual' : 'web_speech',
        },
        // 流式增量：追加/更新 AI 气泡
        (delta) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last !== undefined && last.id === 'streaming') {
              return [...prev.slice(0, -1), { ...last, textContent: (last.textContent ?? '') + delta }]
            }
            return [...prev, { id: 'streaming', speaker: 'AI', textContent: delta, createdAt: new Date().toISOString() }]
          })
        },
      )
      const finalText = r.text.trim().length > 0 ? r.text : '(AI tutor offline — try again shortly)'
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last !== undefined && last.id === 'streaming') {
          return [...prev.slice(0, -1), { id: `ai-${Date.now()}`, speaker: 'AI', textContent: finalText, createdAt: new Date().toISOString() }]
        }
        return [...prev, { id: `ai-${Date.now()}`, speaker: 'AI', textContent: finalText, createdAt: new Date().toISOString() }]
      })
      speak(finalText) // 验收 7：朗读回复（不支持时静默跳过）
    } catch {
      setError('发送失败，请重试')
    } finally {
      setSending(false)
    }
  }, [input, sending, sessionId, sttUnsupported, recorder, resetTranscript, speak])

  const onEnd = useCallback(async () => {
    setEnding(true)
    if (listening) stopListening()
    try {
      await speakingApi.endSession(sessionId, { durationSec: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)) })
      router.push(`${ROUTES.speaking}/report/${sessionId}`)
    } catch {
      setEnding(false)
    }
  }, [listening, stopListening, sessionId, router])

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="口语对话"
          description={sttUnsupported ? '当前浏览器不支持语音识别，已切换为文本输入模式（评分不受影响）' : '语音或文本皆可，结束后获得评分报告'}
          actions={
            <Button type="button" variant="destructive" onClick={() => void onEnd()} disabled={ending} data-testid="end-session">
              {ending ? '生成报告中…' : '结束对话'}
            </Button>
          }
        />

        <div className="space-y-3">
          {loading ? (
            <SkeletonCard className="h-64" />
          ) : error !== null && messages.length === 0 ? (
            <ErrorState title="会话加载失败" message={error} onRetry={() => window.location.reload()} />
          ) : (
            <div ref={scrollRef} className="max-h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface p-3" data-testid="chat-thread">
              {messages.map((m) => (
                <ChatBubble key={m.id} speaker={m.speaker === 'USER' ? 'USER' : 'AI'} text={m.textContent ?? ''} />
              ))}
              {sending && messages[messages.length - 1]?.id !== 'streaming' ? (
                <ChatBubble speaker="AI" text="…" />
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-2">
            {!sttUnsupported ? (
              <>
                <StartSpeakingButton listening={listening} onToggle={() => (listening ? stopListening() : startListening())} disabled={sending} />
                <Waveform active={listening} />
              </>
            ) : null}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) void send()
              }}
              placeholder="用英语输入，回车发送…"
              className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
              data-testid="chat-input"
            />
            <Button type="button" onClick={() => void send()} disabled={sending || input.trim().length === 0} data-testid="chat-send">
              <Send className="h-4 w-4" />
              发送
            </Button>
          </div>
          {error !== null ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href={ROUTES.speaking} className="text-primary underline-offset-4 hover:underline">
            ← 返回口语目录
          </Link>
        </p>
      </PageContainer>
    </AppShell>
  )
}
