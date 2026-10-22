'use client'

/**
 * 翻译模块数据 hooks（T18）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/features/auth/api'
import { useDebouncedCallback } from '@/hooks/use-debounce'

import { translationApi } from './api'
import type { ExtractedWord, TranslationHistoryResult, TranslationResult } from './types'

function message(e: unknown, fallback: string): string {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : fallback
}

/** T1 翻译 */
export function useTranslate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translate = useCallback(
    async (text: string, direction: 'zh2en' | 'en2zh'): Promise<TranslationResult | null> => {
      setLoading(true)
      setError(null)
      try {
        return await translationApi.translate({ text, direction })
      } catch (e) {
        setError(message(e, '翻译失败'))
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { translate, loading, error }
}

/** T2 收藏（原句 + 生词入本） */
export function useTranslationSave() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    async (recordId?: string): Promise<{ favorited: boolean; addedWords: string[] } | null> => {
      setSaving(true)
      setError(null)
      try {
        return await translationApi.save({ recordId, addWords: true })
      } catch (e) {
        setError(message(e, '收藏失败'))
        return null
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { save, saving, error }
}

/** T3 历史 */
export function useTranslationHistory(favoriteOnly = false) {
  const [state, setState] = useState<AsyncState<TranslationHistoryResult>>({ data: null, loading: true, error: null })
  const aliveRef = useRef(true)
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    let cancelled = false
    translationApi
      .history({ page, pageSize, favoriteOnly })
      .then((data) => {
        if (!cancelled && aliveRef.current) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled && aliveRef.current) setState({ data: null, loading: false, error: message(e, '加载失败') })
      })
    return () => {
      cancelled = true
    }
  }, [page, favoriteOnly])

  const reload = useCallback(() => setPage(1), [])
  return { ...state, page, setPage, reload }
}

/** 生词抽取（防抖 500ms；文本过短不请求） */
export function useWordExtract() {
  const [words, setWords] = useState<ExtractedWord[]>([])
  const [loading, setLoading] = useState(false)

  const run = useDebouncedCallback(async (text: string) => {
    if (text.trim().length < 12) {
      setWords([])
      return
    }
    setLoading(true)
    try {
      setWords(await translationApi.extractWords(text))
    } catch {
      setWords([])
    } finally {
      setLoading(false)
    }
  }, 500)

  const extract = useCallback((text: string) => void run(text), [run])

  /** 生词入本后本地更新状态 */
  const markAdded = useCallback((vocabularyId: string) => {
    setWords((prev) => prev.map((w) => (w.vocabularyId === vocabularyId ? { ...w, inNotebook: true } : w)))
  }, [])

  return { words, loading, extract, markAdded }
}

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** 生词入本 */
export function useAddWord() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = useCallback(async (vocabularyId: string): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await translationApi.addWord(vocabularyId)
      return true
    } catch (e) {
      setError(message(e, '加入生词本失败'))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { add, saving, error }
}
