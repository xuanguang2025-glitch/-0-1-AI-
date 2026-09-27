/**
 * Onboarding Zod schemas：前后端共用（与 /api/onboarding 同构）。
 */
import { z } from 'zod'

export const onboardingStepsSchema = z.object({
  goal: z.enum(['exam', 'abroad', 'work', 'interest', 'daily']),
  level: z.enum(['beginner', 'elementary', 'intermediate', 'upper', 'advanced']),
  dailyTime: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
  weeklyDays: z.number().int().min(1).max(7),
  targetExam: z.enum(['CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL']).nullish(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  weakest: z.array(z.enum(['vocabulary', 'listening', 'speaking', 'reading', 'writing', 'grammar'])).max(6),
  style: z.enum(['scenario', 'reading', 'video', 'audio']),
})

/** 单步校验：按 stepKey 抽取对应字段校验（单屏单步前进时用） */
export function validateStep<K extends keyof OnboardingDraft>(stepKey: K, value: unknown): OnboardingDraft[K] | null {
  const partial = onboardingStepsSchema.pick({ [stepKey]: true } as never).safeParse({ [stepKey]: value })
  return partial.success ? (partial.data as never)[stepKey] : null
}

export type OnboardingDraft = z.infer<typeof onboardingStepsSchema>
export type OnboardingStepKey = keyof OnboardingDraft

/** 步骤顺序（8 步） */
export const ONBOARDING_STEP_KEYS = [
  'goal', 'level', 'dailyTime', 'weeklyDays', 'targetExam', 'targetDate', 'weakest', 'style',
] as const
