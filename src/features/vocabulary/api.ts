/**
 * 词汇/统计模块前端 API 客户端：复用 ApiClientError（401 处理由 auth 模块注入）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type {
  MasteryOverview,
  NotebookItem,
  RecordItem,
  ReviewQueue,
  ReviewResult,
  TodayWords,
  VocabularyBookDto,
  WordDetail,
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

export const vocabularyApi = {
  /** 今日新词 */
  today: (book?: string) =>
    request<TodayWords>(`/api/vocabulary/today${book ? `?book=${encodeURIComponent(book)}` : ''}`),
  /** 到期复习队列 */
  reviewQueue: () => request<ReviewQueue>('/api/vocabulary/review-queue'),
  /** 学一个新词 */
  learn: (vocabularyId: string) =>
    request<{ userVocabId: string }>('/api/vocabulary/learn', {
      method: 'POST',
      body: JSON.stringify({ vocabularyId }),
    }),
  /** 复习提交（幂等键必传 uuid） */
  review: (body: { userVocabId: string; rating: number; responseMs: number; idempotencyKey: string }) =>
    request<ReviewResult>('/api/vocabulary/review', { method: 'POST', body: JSON.stringify(body) }),
  /** 词书列表 */
  books: () => request<VocabularyBookDto[]>('/api/vocabulary/books'),
  /** 搜索单词 */
  search: (q: string, limit = 10) =>
    request<Array<{ id: string; word: string; phoneticUk: string | null; definitions: unknown; difficulty: string }>>(
      `/api/vocabulary/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  /** 复习流水（分页） */
  records: (page = 1, pageSize = 20) =>
    request<RecordItem[]>(`/api/vocabulary/records?page=${page}&pageSize=${pageSize}`),
  /** 掌握度概览 */
  mastery: () => request<MasteryOverview>('/api/vocabulary/mastery'),
  /** 生词本列表 */
  notebook: () => request<NotebookItem[]>('/api/vocabulary/notebook'),
  /** 切换生词本收藏 */
  toggleNotebook: (userVocabId: string) =>
    request<{ inNotebook: boolean }>('/api/vocabulary/notebook', {
      method: 'POST',
      body: JSON.stringify({ userVocabId }),
    }),
  /** 单词详情 */
  wordDetail: (id: string) => request<WordDetail>(`/api/vocabulary/${id}`),
}

export interface TrendPointDto {
  date: string
  minutes: number
  wordsLearned: number
  wordsReviewed: number
  correctRate: number | null
}

export interface CalendarPointDto {
  date: string
  minutes: number
}

export interface AnalyticsOverviewDto {
  today: { minutes: number; wordsLearned: number; wordsReviewed: number; xp: number }
  total: { minutes: number; wordsLearned: number; wordsReviewed: number; xp: number; exams: number }
  streak: { days: number; longest: number }
}

export const analyticsApi = {
  overview: () => request<AnalyticsOverviewDto>('/api/analytics'),
  trend: (days = 30) => request<TrendPointDto[]>(`/api/analytics/trend?days=${days}`),
  history: (page = 1, pageSize = 20) =>
    request<RecordItem[]>(`/api/analytics/history?page=${page}&pageSize=${pageSize}`),
  calendar: (days = 140) => request<CalendarPointDto[]>(`/api/analytics/calendar?days=${days}`),
}
