'use client'

/**
 * use-onboarding-draft：8 步答案的本地暂存（localStorage 防丢）+ 服务端草稿恢复。
 * 优先级：localStorage（本次填写）> 服务端 draft（上次未完成）> 空草稿。
 */
import { useCallback, useEffect, useState } from 'react'

import { onboardingApi } from './api'
import type { OnboardingDraft } from './schemas'

const STORAGE_KEY = 'englishai.onboarding.draft.v1'

const EMPTY_DRAFT: OnboardingDraft = {
  goal: 'exam',
  level: 'elementary',
  dailyTime: 30,
  weeklyDays: 5,
  targetExam: null,
  targetDate: null,
  weakest: [],
  style: 'scenario',
}

function readLocal(): Partial<OnboardingDraft> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<OnboardingDraft>) : null
  } catch {
    return null
  }
}

function writeLocal(draft: OnboardingDraft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* 隐私模式静默 */
  }
}

export function clearLocalDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 静默 */
  }
}

export function useOnboardingDraft() {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT)
  const [ready, setReady] = useState(false)
  const [completed, setCompleted] = useState(false)

  // 初始化：localStorage → 服务端草稿
  useEffect(() => {
    let cancelled = false
    const init = async (): Promise<void> => {
      const local = readLocal()
      try {
        const server = await onboardingApi.getDraft()
        if (cancelled) return
        setCompleted(server.completed)
        if (server.steps) {
          setDraft({ ...EMPTY_DRAFT, ...server.steps, ...(local ?? {}) })
        } else if (local) {
          setDraft({ ...EMPTY_DRAFT, ...local })
        }
      } catch {
        if (!cancelled && local) setDraft({ ...EMPTY_DRAFT, ...local })
      }
      if (!cancelled) setReady(true)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value }
      writeLocal(next)
      return next
    })
  }, [])

  const reset = useCallback((): void => {
    clearLocalDraft()
    setDraft(EMPTY_DRAFT)
  }, [])

  return { draft, update, reset, ready, completed }
}
