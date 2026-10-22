/**
 * 专项训练卷前端 API 客户端（T20，E1-E3 + 自动保存 + 报告）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type { ExamPaperListResult, ExamReportResult, ExamStartResult } from './types'

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

export const examApi = {
  /** E1 试卷列表 */
  papers: () => request<ExamPaperListResult>('/api/exams'),

  /** E2 开始作答 */
  start: (paperId: string) =>
    request<ExamStartResult>(`/api/exams/${paperId}/start`, { method: 'POST', body: '{}' }),

  /** 自动保存单题（1 次/5s，服务端按 userId 限流） */
  saveAnswer: (paperId: string, attemptId: string, body: { examQuestionId: string; userAnswer: string }) =>
    request<{ savedVersion: number }>(`/api/exams/${paperId}/attempts/${attemptId}/answers`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** E3 交卷（幂等） */
  submit: (paperId: string, attemptId: string, body: { answers: Array<{ examQuestionId: string; userAnswer: string }>; timeUsedSec?: number }) =>
    request<ExamReportResult>(`/api/exams/${paperId}/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 报告 */
  report: (attemptId: string) => request<ExamReportResult>(`/api/exams/attempts/${attemptId}/report`),
}
