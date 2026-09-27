/**
 * Onboarding API 客户端。
 */
import type { ApiResponse } from '@/types/api'
import { onboardingStepsSchema, type OnboardingDraft } from './schemas'

export interface OnboardingDraftResponse {
  completed: boolean
  steps: OnboardingDraft | null
  completedAt: string | null
}

export interface OnboardingSubmitResponse {
  profile: Record<string, unknown>
  planId: string | null
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new Error('响应解析失败')
  if (body.success && body.data !== null) return body.data
  throw new Error(body.error?.message ?? '请求失败')
}

export const onboardingApi = {
  getDraft: (): Promise<OnboardingDraftResponse> => unwrap(fetch('/api/onboarding', { credentials: 'same-origin' })),

  /** submit：服务端二次 Zod 校验；失败抛出 message（表单顶部展示） */
  submit: (draft: OnboardingDraft, skipped: boolean): Promise<OnboardingSubmitResponse> =>
    unwrap(
      fetch('/api/onboarding', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: onboardingStepsSchema.parse(draft), skipped }),
      }),
    ),
}
