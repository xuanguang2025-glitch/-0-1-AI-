'use client'

/**
 * 录音时长 hook（T19）：MediaRecorder 计时；浏览器不支持时返回 0
 * （文本降级模式无需录音，评分链路 durationSec 由会话时长兜底）。
 */
import { useCallback, useRef, useState } from 'react'

export interface UseMediaRecorder {
  supported: boolean
  recording: boolean
  durationMs: () => number
  start: () => void
  stop: () => void
}

export function useMediaRecorder(): UseMediaRecorder {
  const [recording, setRecording] = useState(false)
  const startedAtRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const start = useCallback(() => {
    if (typeof window === 'undefined' || !('MediaRecorder' in window)) return
    try {
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const rec = new MediaRecorder(stream)
          recorderRef.current = rec
          startedAtRef.current = Date.now()
          rec.start()
          setRecording(true)
        })
        .catch(() => setRecording(false))
    } catch {
      setRecording(false)
    }
  }, [])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    setRecording(false)
  }, [])

  return {
    supported: typeof window !== 'undefined' && 'MediaRecorder' in window,
    recording,
    durationMs: () => (startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0),
    start,
    stop,
  }
}
