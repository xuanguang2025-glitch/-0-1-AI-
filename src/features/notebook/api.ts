/**
 * 错题本模块 API 客户端（错题本闭环）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

import type { WrongQuestionListResult, WrongQuestionReviewResult } from './types'

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

export const notebookApi = {
  /** 列表（source 筛选 + 掌握状态 + 分页） */
  list: (params: { source?: string; mastered?: boolean; page?: number; pageSize?: number } = {}) =>
    request<WrongQuestionListResult>(
      `/api/wrong-questions${qs({
        source: params.source,
        mastered: params.mastered === undefined ? undefined : params.mastered ? 'true' : 'false',
        page: params.page,
        pageSize: params.pageSize,
      })}`,
    ),

  /** 复习动作：master = 标记已掌握；reopen = 重新打开 */
  review: (id: string, action: 'master' | 'reopen') =>
    request<WrongQuestionReviewResult>(`/api/wrong-questions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
}
