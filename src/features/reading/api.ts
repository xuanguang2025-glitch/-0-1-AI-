/**
 * 阅读模块前端 API 客户端（T15，R1-R4 + 进度/划词）。
 * 复用 ApiClientError（401 处理由 auth 模块注入）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type {
  ReadingArticleDetail,
  ReadingExplainResult,
  ReadingHighlight,
  ReadingListResult,
  ReadingQuizResult,
  ReadingWordResult,
} from './types'

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

export interface ReadingListParams {
  category?: string
  difficulty?: string
  cefr?: string
  q?: string
  page?: number
  pageSize?: number
}

export const readingApi = {
  /** R1 文章列表 */
  list: (params: ReadingListParams = {}) =>
    request<ReadingListResult>(`/api/reading${qs(params as Record<string, string | number | undefined>)}`),

  /** R2 文章详情（含断点续读字段；题目不含答案） */
  detail: (id: string) => request<ReadingArticleDetail>(`/api/reading/${id}`),

  /** R3 提交 quiz（服务端判分 + 错题本） */
  submitQuiz: (
    id: string,
    body: { answers: Array<{ questionId: string; userAnswer: string }>; durationSec?: number },
  ) =>
    request<ReadingQuizResult>(`/api/reading/${id}/quiz/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** R4 AI 句子讲解（degraded=true 时前端隐藏区块） */
  explain: (id: string, body: { sentence: string; blockIndex?: number }) =>
    request<ReadingExplainResult>(`/api/reading/${id}/explain`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 断点续读 */
  saveProgress: (id: string, body: { progress: number; lastBlockIndex?: number; readSeconds?: number }) =>
    request<{ articleId: string; progress: number; lastBlockIndex: number }>(`/api/reading/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 划词收藏 */
  addHighlight: (id: string, body: { word: string; blockIndex: number }) =>
    request<{ highlights: ReadingHighlight[] }>(`/api/reading/${id}/highlight`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 划词直查（词典，不调 AI） */
  lookupWord: (word: string) => request<ReadingWordResult>(`/api/reading/word${qs({ word })}`),
}
