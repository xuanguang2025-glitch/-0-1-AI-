/**
 * Dashboard 模块前端 API 客户端 + 类型（与 services/dashboard.service 对齐）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'

export interface DashboardTask {
  id: string
  taskType: string
  title: string
  targetValue: number
  completedValue: number
  status: string
  unit: string
  payload: unknown
}

export interface DashboardData {
  user: { nickname: string; avatarUrl: string | null; level: number; levelPct: number; xpToNext: number }
  streak: { days: number; todayDone: boolean; longest: number }
  today: { date: string; tasksTotal: number; tasksCompleted: number; minutesGoal: number; minutesDone: number }
  tasks: DashboardTask[]
  vocabulary: { dueReview: number; learnedTotal: number; masteredTotal: number }
  ability: Record<string, number> | null
  aiSuggestion: { text: string; degraded: boolean }
  continueLearning: { lastBookSlug: string | null; lastBookName: string | null }
  recentStats: Array<{ date: string; minutes: number; wordsLearned: number; wordsReviewed: number }>
}

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

export const dashboardApi = {
  get: () => request<DashboardData>('/api/dashboard'),
  /** 完成任务（幂等） */
  completeTask: (taskId: string) =>
    request<{ status: string; xpEarned: number }>(`/api/dashboard/tasks/${taskId}/complete`, { method: 'POST' }),
  /** 重新拉取 AI 建议（GET /api/dashboard/ai-suggestion，独立降级） */
  refreshSuggestion: () =>
    request<{ text: string; degraded: boolean }>('/api/dashboard/ai-suggestion'),
}
