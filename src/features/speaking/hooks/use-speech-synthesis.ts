'use client'

/**
 * TTS hook（T19 验收 7）：speechSynthesis 朗读 AI 回复；不支持时静默跳过。
 */
import { useCallback, useState } from 'react'

export interface UseSpeechSynthesis {
  supported: boolean
  speaking: boolean
  speak: (text: string) => void
}

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return // 静默跳过
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-US'
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
    } catch {
      setSpeaking(false)
    }
  }, [])

  return { supported: typeof window !== 'undefined' && 'speechSynthesis' in window, speaking, speak }
}
