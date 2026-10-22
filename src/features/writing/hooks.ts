'use client'

/**
 * 写作模块数据 hooks（T17）。
 *
 * 自动保存：`useWritingAutosave` 防抖 **2.5s**（验收 6 要求 ≤3s），
 * 内容变更即整篇 PATCH（服务端重算规则检查），刷新前必已落库。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'
import { useDebouncedCallback } from '@/hooks/use-debounce'

import { writingApi, type WritingTaskParams } from './api'
import type {
  WritingAnalyzeResult,
  WritingReport,
  WritingSubmissionDetail,
  WritingSubmissionListResult,
  WritingRuleCheck,
  WritingTaskListResult,
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

/** W1 任务列表 */
export function useWritingTasks(params: WritingTaskParams = {}) {
  const key = JSON.stringify(params)
  return useLoad<WritingTaskListResult>(() => writingApi.tasks(params), [key])
}

/** W2 我的作文列表 */
export function useWritingSubmissions(taskId?: string) {
  return useLoad<WritingSubmissionListResult>(() => writingApi.submissions(taskId ? { taskId } : {}), [taskId ?? ''])
}

/** W3 详情 */
export function useWritingDetail(id: string | null) {
  return useLoad<WritingSubmissionDetail>(() => writingApi.detail(id as string), [id], id !== null)
}

/** 新建作文 */
export function useCreateWriting() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (body: { taskId: string; content: string; title?: string }): Promise<{ id: string } | null> => {
      setSubmitting(true)
      setError(null)
      try {
        return await writingApi.create(body)
      } catch (e) {
        setError(message(e, '保存失败'))
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  return { create, submitting, error }
}

/**
 * 自动保存（验收 6）：防抖 2.5s + 失败静默重试由下次输入触发。
 * `saving` 用于 AutosaveIndicator 展示；`ruleCheck` 是**最新一次保存**的
 * 规则检查结果（QA 第八轮 P2：编辑器内联面板由此实时更新——
 * 详情只加载一次，若不回填，面板永远显示创建时快照）。
 */
export function useWritingAutosave(id: string | null) {
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ruleCheck, setRuleCheck] = useState<WritingRuleCheck | null>(null)
  const pendingRef = useRef<{ content?: string; title?: string } | null>(null)
  const inflightRef = useRef(false)

  const flush = useCallback(
    async (): Promise<void> => {
      if (!id || inflightRef.current) return
      const payload = pendingRef.current
      if (payload === null) return
      pendingRef.current = null
      inflightRef.current = true
      setSaving(true)
      try {
        const r = await writingApi.autosave(id, payload)
        setSavedAt(r.updatedAt)
        setRuleCheck(r.ruleCheck)
        setSaveError(null)
      } catch (e) {
        setSaveError(message(e, '自动保存失败'))
      } finally {
        inflightRef.current = false
        setSaving(false)
        // 若保存期间又有新输入，立即续排下一次
        if (pendingRef.current !== null) void flush()
      }
    },
    [id],
  )

  const schedule = useDebouncedCallback((payload: { content?: string; title?: string }) => {
    if (!id) return
    pendingRef.current = payload
    void flush()
  }, 2500)

  return { schedule, flush, saving, savedAt, saveError, ruleCheck }
}

/** W4 AI 批改 */
export function useWritingAnalyze() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (id: string): Promise<WritingAnalyzeResult | null> => {
    setLoading(true)
    setError(null)
    try {
      return await writingApi.analyze(id)
    } catch (e) {
      setError(message(e, '批改失败'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { analyze, loading, error }
}

/** W5 报告 */
export function useWritingReport(id: string | null) {
  return useLoad<WritingReport>(() => writingApi.report(id as string), [id], id !== null)
}
