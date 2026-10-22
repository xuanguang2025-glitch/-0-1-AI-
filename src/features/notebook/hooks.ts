'use client'

/**
 * 错题本模块 hooks（错题本闭环）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'

import { notebookApi } from './api'
import type { WrongQuestionItem, WrongQuestionListResult } from './types'

function message(e: unknown, fallback: string): string {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : fallback
}

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** 列表（source / mastered / 分页变化自动重载） */
export function useWrongQuestions(params: { source?: string; mastered?: boolean; page: number }) {
  const key = JSON.stringify(params)
  const [state, setState] = useState<AsyncState<WrongQuestionListResult>>({ data: null, loading: true, error: null })
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    let cancelled = false
    notebookApi
      .list(params)
      .then((data) => {
        if (!cancelled && aliveRef.current) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled && aliveRef.current) setState({ data: null, loading: false, error: message(e, '加载失败') })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => {
    void notebookApi.list(params).then((data) => {
      if (aliveRef.current) setState({ data, loading: false, error: null })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { ...state, reload }
}

/** 复习动作（master/reopen） */
export function useWrongQuestionReview(onDone: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const review = useCallback(
    async (item: WrongQuestionItem, action: 'master' | 'reopen'): Promise<boolean> => {
      setBusyId(item.id)
      setError(null)
      try {
        await notebookApi.review(item.id, action)
        onDone()
        return true
      } catch (e) {
        setError(message(e, '操作失败'))
        return false
      } finally {
        setBusyId(null)
      }
    },
    [onDone],
  )

  return { review, busyId, error }
}
