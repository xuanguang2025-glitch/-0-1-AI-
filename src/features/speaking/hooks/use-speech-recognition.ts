'use client'

/**
 * SpeechRecognition 降级 hook（T19 验收 5）。
 *
 * **核心行为**：浏览器不支持 SpeechRecognition 时 `unsupported=true` →
 * 页面自动切文本输入模式（`wasTextInput=true`），评分链路不变。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionResultLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionResultLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UseSpeechRecognition {
  /** 浏览器不支持 → UI 自动切文本输入（wasTextInput=true） */
  unsupported: boolean
  listening: boolean
  transcript: string
  start: () => void
  stop: () => void
  reset: () => void
}

export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognition {
  const [unsupported, setUnsupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    setUnsupported(getRecognitionCtor() === null)
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (Ctor === null || listening) return
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const alt = event.results[i]?.[0]
        if (alt !== undefined) text += `${alt.transcript} `
      }
      setTranscript(text.trim())
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [lang, listening])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => setTranscript(''), [])

  return { unsupported, listening, transcript, start, stop, reset }
}
