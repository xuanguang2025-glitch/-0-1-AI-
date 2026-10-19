'use client'

/**
 * 语法模块数据 hooks（T16）。
 * 与阅读/听力模块一致：`useState + useEffect + cancelled` 手写，统一四态。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'

import { grammarApi } from './api'
import type {
  GrammarExerciseResult,
  GrammarExplainResult,
  GrammarSubmitResult,
  GrammarTopicDetail,
  GrammarTopicListResult,
} from './types'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function message(e: unknown, fallback: string): string {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : fallback
}

function useLoad<T>(loader: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: enabled, error: null })
  const aliveRef = useRef(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    let cancelled = false
    loader()
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
  }, [...deps, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}

/** G1 主题树 */
export function useGrammarTopics() {
  return useLoad<GrammarTopicListResult>(() => grammarApi.topics(), [])
}

/** G2 主题详情 */
export function useGrammarTopic(id: string | null) {
  return useLoad<GrammarTopicDetail>(() => grammarApi.detail(id as string), [id], id !== null)
}

/** G3 练习题 */
export function useGrammarExercises(id: string | null, count = 5) {
  return useLoad<GrammarExerciseResult>(() => grammarApi.exercises(id as string, count), [id, count], id !== null)
}

/** G4 提交练习 */
export function useSubmitGrammar(topicId: string | null) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (
      answers: Array<{ questionId: string; userAnswer: string }>,
      durationSec?: number,
    ): Promise<GrammarSubmitResult | null> => {
      if (!topicId) return null
      setSubmitting(true)
      setError(null)
      try {
        return await grammarApi.submit(topicId, { answers, durationSec })
      } catch (e) {
        setError(message(e, '提交失败'))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [topicId],
  )

  return { submit, submitting, error }
}

/** G5 AI 讲解（降级时静态兜底） */
export function useGrammarExplain(topicId: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const explain = useCallback(
    async (pointTitle?: string): Promise<GrammarExplainResult | null> => {
      if (!topicId) return null
      setLoading(true)
      setError(null)
      try {
        return await grammarApi.explain(topicId, { pointTitle })
      } catch (e) {
        setError(message(e, '讲解失败'))
        return null
      } finally {
        setLoading(false)
      }
    },
    [topicId],
  )

  return { explain, loading, error }
}
