/**
 * 语法模块前端 API 客户端（T16，G1-G5）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type {
  GrammarExerciseResult,
  GrammarExplainResult,
  GrammarSubmitResult,
  GrammarTopicDetail,
  GrammarTopicListResult,
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

export const grammarApi = {
  /** G1 主题树 */
  topics: () => request<GrammarTopicListResult>('/api/grammar/topics'),

  /** G2 主题详情 */
  detail: (id: string) => request<GrammarTopicDetail>(`/api/grammar/${id}`),

  /** G3 取练习题（不含答案） */
  exercises: (id: string, count = 5) =>
    request<GrammarExerciseResult>(`/api/grammar/${id}/exercise${qs({ count })}`),

  /** G4 提交练习（服务端判分 + 错题本 + 掌握度） */
  submit: (id: string, body: { answers: Array<{ questionId: string; userAnswer: string }>; durationSec?: number }) =>
    request<GrammarSubmitResult>(`/api/grammar/${id}/exercise/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** G5 AI 讲解（降级时静态兜底，source='static'） */
  explain: (id: string, body: { pointTitle?: string } = {}) =>
    request<GrammarExplainResult>(`/api/grammar/${id}/explain`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
