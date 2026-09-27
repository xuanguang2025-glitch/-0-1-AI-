'use client'

/**
 * review.store：复习会话状态（队列、指针、会话统计）。
 * 持久化不做（队列来自服务端），仅会话内状态。
 */
import { create } from 'zustand'

import type { ReviewQueueItem, ReviewResult } from '@/features/vocabulary/types'

export interface SessionStat {
  total: number
  correct: number
  wrong: number
  /** 最近一次结果（用于动画/提示） */
  lastPath: string | null
}

interface ReviewState {
  queue: ReviewQueueItem[]
  index: number
  /** 当前题展示开始时间（计算 responseMs） */
  shownAt: number
  session: SessionStat
  /** 提交中/结果展示锁 */
  busy: boolean
  lastResult: ReviewResult | null
  setQueue: (items: ReviewQueueItem[]) => void
  next: () => void
  markShown: () => void
  recordResult: (result: ReviewResult, isCorrect: boolean) => void
  setBusy: (busy: boolean) => void
  reset: () => void
}

const initialSession: SessionStat = { total: 0, correct: 0, wrong: 0, lastPath: null }

export const useReviewStore = create<ReviewState>((set) => ({
  queue: [],
  index: 0,
  shownAt: Date.now(),
  session: initialSession,
  busy: false,
  lastResult: null,
  setQueue: (items) => set({ queue: items, index: 0, shownAt: Date.now(), session: initialSession, lastResult: null }),
  next: () =>
    set((s) => ({
      index: s.index + 1,
      shownAt: Date.now(),
      lastResult: null,
      busy: false,
    })),
  markShown: () => set({ shownAt: Date.now() }),
  recordResult: (result, isCorrect) =>
    set((s) => ({
      session: {
        total: s.session.total + 1,
        correct: s.session.correct + (isCorrect ? 1 : 0),
        wrong: s.session.wrong + (isCorrect ? 0 : 1),
        lastPath: result.path,
      },
      lastResult: result,
    })),
  setBusy: (busy) => set({ busy }),
  reset: () => set({ queue: [], index: 0, session: initialSession, busy: false, lastResult: null }),
}))

/** 生成幂等键（复习提交必带） */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}
