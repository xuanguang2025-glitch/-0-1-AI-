/**
 * 听力模块前端 API 客户端（L1-L8）。
 * 复用 ApiClientError（401 处理由 auth 模块注入）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type {
  DictationToken,
  ListeningAnalyzeResult,
  ListeningAttemptResult,
  ListeningDetail,
  ListeningListResult,
  ListeningModeKey,
  ListeningProgress,
  ListeningQuestionsResult,
  ListeningReport,
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

export interface ListeningListParams {
  category?: string
  difficulty?: string
  cefr?: string
  intensity?: number
  page?: number
  pageSize?: number
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const s = search.toString()
  return s === '' ? '' : `?${s}`
}

export const listeningApi = {
  /** L1 材料列表 */
  list: (params: ListeningListParams = {}) =>
    request<ListeningListResult>(`/api/listening${qs(params as Record<string, string | number | undefined>)}`),

  /** L2 精听页数据 */
  detail: (id: string) => request<ListeningDetail>(`/api/listening/${id}`),

  /** L3 按模式取题（**不含答案**，判分在服务端） */
  questions: (id: string, mode: ListeningModeKey) =>
    request<ListeningQuestionsResult>(`/api/listening/${id}/questions${qs({ mode })}`),

  /** L4 提交训练结果 */
  submitAttempt: (
    id: string,
    body: {
      mode: ListeningModeKey
      answers?: Array<{ questionId: string; userAnswer: string }>
      durationSec?: number
      unknownWords?: Array<{ word: string; meaning?: string }>
      dictationText?: string
      playbackRate?: number
    },
  ) =>
    request<ListeningAttemptResult>(`/api/listening/${id}/attempts`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** L5 训练报告 */
  report: (recordId: string) => request<ListeningReport>(`/api/listening/report/${recordId}`),

  /** L6 AI 听力分析（带规则兜底） */
  analyze: (recordId: string) =>
    request<ListeningAnalyzeResult>(`/api/listening/${recordId}/analyze`, { method: 'POST', body: '{}' }),

  /** L7 保存播放进度 */
  saveProgress: (body: { materialId: string; positionSec: number; playbackRate?: number; completed?: boolean }) =>
    request<ListeningProgress>('/api/listening/progress', { method: 'POST', body: JSON.stringify(body) }),

  /** L8 听写比对（纯本地 diff，实时预览用） */
  dictationCheck: (original: string, dictation: string) =>
    request<{ diff: DictationToken[]; accuracy: number; correctCount: number; totalCount: number }>(
      '/api/listening/dictation-check',
      { method: 'POST', body: JSON.stringify({ original, dictation }) },
    ),
}
