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
  /**
   * 请求序号守卫：只允许**最后一次**发起的请求写 state。
   * 真实竞态（E2E 实测）：标记已掌握后 `reload` 发起请求 A，用户随即点
   * 「已掌握」筛选发起请求 B——若 A 晚于 B 返回，会把过期的待复习数据覆盖回去。
   * 序号守卫让先完成的过期响应被丢弃。
   */
  const seqRef = useRef(0)
  /** reload 永远读最新参数（旧闭包参数会导致「标记后刷新回旧筛选」的竞态） */
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    const seq = ++seqRef.current
    setState((s) => ({ ...s, loading: true, error: null }))
    let cancelled = false
    notebookApi
      .list(params)
      .then((data) => {
        if (!cancelled && aliveRef.current && seq === seqRef.current) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled && aliveRef.current && seq === seqRef.current) setState({ data: null, loading: false, error: message(e, '加载失败') })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => {
    const seq = ++seqRef.current
    void notebookApi.list(paramsRef.current).then((data) => {
      if (aliveRef.current && seq === seqRef.current) setState({ data, loading: false, error: null })
    })
  }, [])

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
