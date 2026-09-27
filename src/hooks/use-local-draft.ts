'use client'

/**
 * use-local-draft：localStorage 草稿持久化通用 hook（防丢，SSR 安全）。
 * 与 onboarding hooks 同构，供词汇等模块复用。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useLocalDraft<T>(key: string, initial: T): {
  draft: T
  ready: boolean
  update: (patch: Partial<T>) => void
  reset: () => void
} {
  const [draft, setDraft] = useState<T>(initial)
  const [ready, setReady] = useState(false)
  const keyRef = useRef(key)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(keyRef.current)
      if (raw) setDraft({ ...initial, ...(JSON.parse(raw) as T) })
    } catch {
      // 损坏的草稿直接丢弃
      window.localStorage.removeItem(keyRef.current)
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback((patch: Partial<T>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...patch }
      try {
        window.localStorage.setItem(keyRef.current, JSON.stringify(merged))
      } catch {
        // 存储满/隐私模式：忽略，仅会话内生效
      }
      return merged
    })
  }, [])

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(keyRef.current)
    } catch {
      // ignore
    }
    setDraft(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyRef.current])

  return { draft, ready, update, reset }
}
