'use client'

/**
 * 阅读模块数据 hooks（T15）。
 *
 * 与听力/词汇模块一致：不用 react-query，用 `useState + useEffect + cancelled` 手写。
 * 统一暴露 `{ data, loading, error, reload }` 四态，页面据此渲染
 * Skeleton / Empty / Error+Retry。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'
import { useDebouncedCallback } from '@/hooks/use-debounce'

import { readingApi, type ReadingListParams } from './api'
import type {
  ReadingArticleDetail,
  ReadingExplainResult,
  ReadingListResult,
  ReadingQuizResult,
  ReadingWordResult,
} from './types'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function message(e: unknown, fallback: string): string {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : fallback
}

/** 通用「加载一次」hook：reload 引用稳定，可用于重试按钮 */
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

/** R1 文章列表 */
export function useReadingList(params: ReadingListParams = {}) {
  const key = JSON.stringify(params)
  return useLoad<ReadingListResult>(() => readingApi.list(params), [key])
}

/** R2 文章详情 */
export function useArticleDetail(id: string | null) {
  return useLoad<ReadingArticleDetail>(() => readingApi.detail(id as string), [id], id !== null)
}

/** 断点续读保存（防抖 2s，避免滚动时打爆接口） */
export function useSaveReadingProgress(articleId: string | null) {
  const save = useDebouncedCallback((progress: number, lastBlockIndex: number, readSeconds: number) => {
    if (!articleId) return
    void readingApi.saveProgress(articleId, { progress, lastBlockIndex, readSeconds }).catch(() => undefined)
  }, 2000)
  return { save }
}

/** R3 提交 quiz */
export function useSubmitQuiz(articleId: string | null) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (answers: Array<{ questionId: string; userAnswer: string }>, durationSec?: number): Promise<ReadingQuizResult | null> => {
      if (!articleId) return null
      setSubmitting(true)
      setError(null)
      try {
        return await readingApi.submitQuiz(articleId, { answers, durationSec })
      } catch (e) {
        setError(message(e, '提交失败'))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [articleId],
  )

  return { submit, submitting, error }
}

/** R4 AI 讲解（degraded → 前端隐藏区块） */
export function useExplain(articleId: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const explain = useCallback(
    async (sentence: string, blockIndex?: number): Promise<ReadingExplainResult | null> => {
      if (!articleId) return null
      setLoading(true)
      setError(null)
      try {
        return await readingApi.explain(articleId, { sentence, blockIndex })
      } catch (e) {
        setError(message(e, '讲解失败'))
        return null
      } finally {
        setLoading(false)
      }
    },
    [articleId],
  )

  return { explain, loading, error }
}

/** 划词直查（防抖 300ms；空选择不请求） */
export function useWordLookup() {
  const [result, setResult] = useState<ReadingWordResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useDebouncedCallback(async (word: string) => {
    const w = word.trim()
    if (w.length === 0) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      setResult(await readingApi.lookupWord(w))
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, 300)

  const lookup = useCallback(
    (word: string) => {
      void run(word)
    },
    [run],
  )

  const clear = useCallback(() => setResult(null), [])

  return { result, loading, lookup, clear }
}
