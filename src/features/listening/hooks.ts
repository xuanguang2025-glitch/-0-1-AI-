'use client'

/**
 * 听力模块数据 hooks（T14）。
 *
 * 与词汇模块一致：不用 react-query，用 `useState + useEffect + cancelled` 手写
 * （保持轻量、避免为单模块引入全局依赖）。统一暴露 `{ data, loading, error, reload }`
 * 四态，页面据此渲染 Skeleton / Empty / Error+Retry。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'
import { useDebouncedCallback } from '@/hooks/use-debounce'

import { listeningApi, type ListeningListParams } from './api'
import type {
  DictationToken,
  ListeningAnalyzeResult,
  ListeningAttemptResult,
  ListeningDetail,
  ListeningListResult,
  ListeningModeKey,
  ListeningQuestionsResult,
  ListeningReport,
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

/** L1 材料列表 */
export function useListeningList(params: ListeningListParams = {}) {
  const key = JSON.stringify(params)
  return useLoad<ListeningListResult>(() => listeningApi.list(params), [key])
}

/** L2 材料详情 */
export function useListeningDetail(id: string | null) {
  return useLoad<ListeningDetail>(() => listeningApi.detail(id as string), [id], id !== null)
}

/** L3 按模式取题 */
export function useListeningQuestions(id: string | null, mode: ListeningModeKey) {
  return useLoad<ListeningQuestionsResult>(
    () => listeningApi.questions(id as string, mode),
    [id, mode],
    id !== null,
  )
}

/** L5 训练报告 */
export function useListeningReport(recordId: string | null) {
  return useLoad<ListeningReport>(() => listeningApi.report(recordId as string), [recordId], recordId !== null)
}

/** L8 听写实时比对（防抖 500ms；输入过短则不请求） */
export function useDictationCheck(original: string, dictation: string, minLen = 3) {
  const [result, setResult] = useState<{ diff: DictationToken[]; accuracy: number } | null>(null)
  const [checking, setChecking] = useState(false)

  const run = useDebouncedCallback(async (orig: string, text: string) => {
    if (orig.trim().length === 0 || text.trim().length < minLen) {
      setResult(null)
      return
    }
    setChecking(true)
    try {
      const r = await listeningApi.dictationCheck(orig, text)
      setResult({ diff: r.diff, accuracy: r.accuracy })
    } catch {
      setResult(null)
    } finally {
      setChecking(false)
    }
  }, 500)

  useEffect(() => {
    void run(original, dictation)
  }, [original, dictation, run])

  return { result, checking }
}

/** L4 提交训练结果 */
export function useSubmitAttempt() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (
      materialId: string,
      body: Parameters<typeof listeningApi.submitAttempt>[1],
    ): Promise<ListeningAttemptResult | null> => {
      setSubmitting(true)
      setError(null)
      try {
        return await listeningApi.submitAttempt(materialId, body)
      } catch (e) {
        setError(message(e, '提交失败'))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  return { submit, submitting, error }
}

/** L6 AI 分析 */
export function useAnalyzeRecord() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (recordId: string): Promise<ListeningAnalyzeResult | null> => {
    setLoading(true)
    setError(null)
    try {
      return await listeningApi.analyze(recordId)
    } catch (e) {
      setError(message(e, '分析失败'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { analyze, loading, error }
}

/** L7 播放进度保存（防抖 2s，避免拖动进度条时打爆接口） */
export function useSaveProgress(materialId: string | null) {
  const save = useDebouncedCallback((positionSec: number, playbackRate: number, completed: boolean) => {
    if (!materialId) return
    void listeningApi.saveProgress({ materialId, positionSec, playbackRate, completed }).catch(() => undefined)
  }, 2000)
  return { save }
}
