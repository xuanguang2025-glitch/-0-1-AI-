/**
 * Placement API 客户端。
 */
import type { ApiResponse } from '@/types/api'
import type { PlacementScoresDto } from './schemas'

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new Error('响应解析失败')
  if (body.success && body.data !== null) return body.data
  throw new Error(body.error?.message ?? '请求失败')
}

export interface PlacementQuestion {
  id: string
  type: string
  category: string
  stem: string
  options: Array<{ key: string; text: string }> | Record<string, string> | null
}

export interface PlacementReport {
  testId: string
  scores: PlacementScoresDto | null
  cefr: string | null
  cet: { cet4: number; cet6: number } | null
  aiReport: { strengths?: string[]; problems?: string[]; suggestions?: string[]; etaWeeks?: number } | null
  aiDegraded: boolean
  completedAt: string | null
  problems: Array<{ stem: string; userAnswer: string; correctAnswer: string; explanation: string; dimension: string }>
}

export const placementApi = {
  /** 开始/恢复测试 */
  start: async (): Promise<{ testId: string; questionCount: number }> =>
    unwrap(await fetch('/api/placement', { method: 'POST', credentials: 'same-origin' })),

  /** 拉取题目 */
  questions: async (testId: string): Promise<PlacementQuestion[]> => {
    const data = await unwrap<{ questions: PlacementQuestion[] }>(
      await fetch(`/api/placement/${testId}/questions`, { credentials: 'same-origin' }),
    )
    return data.questions ?? []
  },

  /** 记录单题答案 */
  answer: async (testId: string, input: { questionId: string; userAnswer: string; responseMs: number }): Promise<null> =>
    unwrap(
      await fetch(`/api/placement/${testId}/answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),

  /** 交卷评分 */
  submit: async (testId: string): Promise<{ scores: PlacementScoresDto; cefr: string; cet: { cet4: number; cet6: number }; testId: string }> =>
    unwrap(await fetch(`/api/placement/${testId}/submit`, { method: 'POST', credentials: 'same-origin' })),

  /** 报告 */
  report: async (testId: string): Promise<PlacementReport> =>
    unwrap(await fetch(`/api/placement/${testId}/report`, { credentials: 'same-origin' })),
}
