/**
 * 个人中心前端 API 客户端（profile / settings / goals / stats）。
 */
import { ApiClientError } from '@/features/auth/api'
import type { ApiResponse } from '@/types/api'
import type { LearningGoalDto, UserProfileDto, UserSettingsDto, UserStatsDto } from '@/types/dto/user.dto'

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

export interface ProfileUpdateInput {
  nickname?: string
  bio?: string
  realName?: string
  gender?: 'male' | 'female' | 'other' | 'undisclosed'
  targetScore?: number
}

export interface SettingsUpdateInput {
  theme?: 'light' | 'dark' | 'system'
  locale?: 'zh-CN' | 'en'
  timezone?: string
  dailyGoalMinutes?: number
  notificationPrefs?: Record<string, boolean>
}

export interface GoalCreateInput {
  type: 'CET4' | 'CET6' | 'KAOYAN' | 'IELTS' | 'TOEFL' | 'DAILY' | 'BUSINESS' | 'INTEREST' | 'ABROAD'
  targetExam?: string | null
  targetScore?: number
  targetDate?: string | null
  dailyMinutes?: number
}

export const userApi = {
  getProfile: () => request<UserProfileDto>('/api/user/profile'),
  updateProfile: (input: ProfileUpdateInput) =>
    request<UserProfileDto>('/api/user/profile', { method: 'PATCH', body: JSON.stringify(input) }),

  getSettings: () => request<UserSettingsDto>('/api/user/settings'),
  updateSettings: (input: SettingsUpdateInput) =>
    request<UserSettingsDto>('/api/user/settings', { method: 'PATCH', body: JSON.stringify(input) }),

  getStats: () => request<UserStatsDto>('/api/user/stats').catch(() => null),

  listGoals: () => request<{ goals: LearningGoalDto[] }>('/api/user/goals'),
  createGoal: (input: GoalCreateInput) =>
    request<LearningGoalDto>('/api/user/goals', { method: 'POST', body: JSON.stringify(input) }),
  closeGoal: (goalId: string, status: 'ACHIEVED' | 'ABANDONED') =>
    request<null>(`/api/user/goals?goalId=${encodeURIComponent(goalId)}&status=${status}`, { method: 'PATCH' }),
}
