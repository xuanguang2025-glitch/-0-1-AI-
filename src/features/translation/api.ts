/**
 * 翻译模块前端 API 客户端（T18）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type { ExtractedWord, TranslationHistoryResult, TranslationResult } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new ApiClientError('SYS_INTERNAL', '响应解析失败', response.status)
  if (body.success && body.data !== null) return body.data
  const err = body.error
  throw new ApiClientError(err?.code ?? 'SYS_INTERNAL', err?.message ?? '请求失败', response.status, err?.details)
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const s = search.toString()
  return s === '' ? '' : `?${s}`
}

export const translationApi = {
  /** T1 翻译 */
  translate: (body: { text: string; direction: 'zh2en' | 'en2zh' }) =>
    request<TranslationResult>('/api/translation/translate', { method: 'POST', body: JSON.stringify(body) }),

  /** T2 一键收藏（原句入收藏 + 生词入本） */
  save: (body: { recordId?: string; addWords?: boolean }) =>
    request<{ favorited: boolean; addedWords: string[] }>('/api/translation/save', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** T3 历史 */
  history: (params: { page?: number; pageSize?: number; favoriteOnly?: boolean } = {}) =>
    request<TranslationHistoryResult>(
      `/api/translation/history${qs({ ...params, favoriteOnly: params.favoriteOnly === true ? 'true' : undefined })}`,
    ),

  /** 生词抽取（词典直查） */
  extractWords: (text: string) => request<ExtractedWord[]>(`/api/translation/words${qs({ text })}`),

  /** 生词入本 */
  addWord: (vocabularyId: string) =>
    request<{ inNotebook: boolean }>('/api/translation/words', {
      method: 'POST',
      body: JSON.stringify({ vocabularyId }),
    }),
}
