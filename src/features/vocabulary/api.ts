/**
 * 词汇/统计模块前端 API 客户端（统一 envelope 解包）。
 */
import type { ApiResponse } from '@/types/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const json = (await res.json()) as ApiResponse<T>
  if (!json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `请求失败（${res.status}）`)
  }
  return json.data
}

export const vocabularyApi = {
  today: (book?: string) =>
    request<{ book: { slug: string; name: string }; words: unknown[] }>(
      `/api/vocabulary/today${book ? `?book=${encodeURIComponent(book)}` : ''}`,
    ),
  reviewQueue: () => request<{ dueCount: number; items: unknown[] }>('/api/vocabulary/review-queue'),
  learn: (vocabularyId: string) =>
    request<{ userVocabId: string }>('/api/vocabulary/learn', {
      method: 'POST',
      body: JSON.stringify({ vocabularyId }),
    }),
  review: (body: { userVocabId: string; rating: number; responseMs: number; idempotencyKey?: string }) =>
    request<{
      newMastery: number
      newStage: string
      newIntervalDays: number
      nextReviewAt: string
      path: string
      intervalPredictions: number[]
      duplicate: boolean
    }>('/api/vocabulary/review', { method: 'POST', body: JSON.stringify(body) }),
  books: () => request<Array<{ id: string; slug: string; name: string; description: string | null; wordCount: number }>>('/api/vocabulary/books'),
  search: (q: string, limit = 10) => request<unknown[]>(`/api/vocabulary/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  records: (page = 1, pageSize = 20) => request<{ total: number; items: unknown[] }>(`/api/vocabulary/records?page=${page}&pageSize=${pageSize}`),
  mastery: () => request<{ total: number; byStage: Record<string, number> }>('/api/vocabulary/mastery'),
  notebook: () => request<unknown[]>('/api/vocabulary/notebook'),
  toggleNotebook: (userVocabId: string) =>
    request<{ inNotebook: boolean }>('/api/vocabulary/notebook', {
      method: 'POST',
      body: JSON.stringify({ userVocabId }),
    }),
  wordDetail: (id: string) => request<{ word: unknown; state: unknown }>(`/api/vocabulary/${id}`),
}

export const analyticsApi = {
  overview: () => request<Record<string, unknown>>('/api/analytics'),
  trend: (days = 30) => request<Array<{ date: string; minutes: number; wordsLearned: number; wordsReviewed: number; correctRate: number | null }>>(`/api/analytics/trend?days=${days}`),
  history: (page = 1, pageSize = 20) => request<{ total: number; items: unknown[] }>(`/api/analytics/history?page=${page}&pageSize=${pageSize}`),
  calendar: (days = 140) => request<Array<{ date: string; minutes: number }>>(`/api/analytics/calendar?days=${days}`),
}
