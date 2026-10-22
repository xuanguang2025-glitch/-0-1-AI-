/**
 * 写作模块前端 API 客户端（T17，W1-W5 + 自动保存）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type {
  WritingAnalyzeResult,
  WritingCreateResult,
  WritingReport,
  WritingRuleCheck,
  WritingSubmissionDetail,
  WritingSubmissionListResult,
  WritingTaskListResult,
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

export interface WritingTaskParams {
  taskType?: string
  difficulty?: string
  examType?: string
  page?: number
  pageSize?: number
}

export const writingApi = {
  /** W1 任务列表 */
  tasks: (params: WritingTaskParams = {}) =>
    request<WritingTaskListResult>(`/api/writing/tasks${qs(params as Record<string, string | number | undefined>)}`),

  /** W2 新建作文（同步返回规则检查） */
  create: (body: { taskId: string; content: string; title?: string }) =>
    request<WritingCreateResult>('/api/writing/submissions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 我的作文列表 */
  submissions: (params: { taskId?: string; page?: number; pageSize?: number } = {}) =>
    request<WritingSubmissionListResult>(
      `/api/writing/submissions${qs(params as Record<string, string | number | undefined>)}`,
    ),

  /** W3 详情 */
  detail: (id: string) => request<WritingSubmissionDetail>(`/api/writing/${id}`),

  /** 自动保存（内容变更即重算规则检查；响应携带完整 ruleCheck 供内联面板实时更新） */
  autosave: (id: string, body: { content?: string; title?: string }) =>
    request<{ id: string; wordCount: number; ruleCheckScore: number | null; ruleCheck: WritingRuleCheck; updatedAt: string }>(
      `/api/writing/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  /** W4 AI 批改（降级回落规则轨） */
  analyze: (id: string) =>
    request<WritingAnalyzeResult>(`/api/writing/${id}/analyze`, { method: 'POST', body: '{}' }),

  /** W5 报告 */
  report: (id: string) => request<WritingReport>(`/api/writing/${id}/report`),
}
