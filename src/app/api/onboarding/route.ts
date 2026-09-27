/**
 * GET  /api/onboarding — 读取已填内容（续填）。
 * POST /api/onboarding — 提交 8 步并触发计划生成（Phase 1：建 LearningGoal，计划 T07+）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import * as onboardingService from '@/services/onboarding.service'

const stepsSchema = z.object({
  goal: z.enum(['exam', 'abroad', 'work', 'interest', 'daily']),
  level: z.enum(['beginner', 'elementary', 'intermediate', 'upper', 'advanced']),
  dailyTime: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
  weeklyDays: z.number().int().min(1).max(7),
  targetExam: z.enum(['CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL']).nullish(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  weakest: z.array(z.enum(['vocabulary', 'listening', 'speaking', 'reading', 'writing', 'grammar'])).max(6),
  style: z.enum(['scenario', 'reading', 'video', 'audio']),
})

const submitSchema = z.object({
  steps: stepsSchema,
  /** 跳过模式：仅回写已填部分并标记完成 */
  skipped: z.boolean().default(false),
})

export const GET = withAuth(
  async (ctx) => ok(await onboardingService.getDraft(ctx.auth!.userId), { traceId: ctx.traceId }),
  { auth: true },
)

export const POST = withAuth(
  async (ctx) => {
    const result = await onboardingService.submit(ctx.auth!.userId, ctx.data.steps, ctx.data.skipped)
    return ok(result, { traceId: ctx.traceId })
  },
  { auth: true, bodySchema: submitSchema },
)
