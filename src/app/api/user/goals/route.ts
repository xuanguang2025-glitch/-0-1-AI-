/**
 * GET /api/user/goals — 学习目标列表。
 * POST /api/user/goals — 创建学习目标。
 * PATCH /api/user/goals?goalId=xx&status=ACHIEVED|ABANDONED — 关闭目标。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import * as userService from '@/services/user.service'

const createGoalSchema = z.object({
  type: z.enum(['CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL', 'DAILY', 'BUSINESS', 'INTEREST', 'ABROAD']),
  targetExam: z.enum(['CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL', 'MOCK', 'CUSTOM', 'PLACEMENT']).nullish(),
  targetScore: z.number().int().min(0).max(710).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD').nullish(),
  dailyMinutes: z.number().int().min(5).max(480).optional(),
})

const closeGoalSchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(['ACHIEVED', 'ABANDONED']),
})

export const GET = withAuth(
  async (ctx) => ok({ goals: await userService.listGoals(ctx.auth!.userId) }, { traceId: ctx.traceId }),
)

export const POST = withAuth(
  async (ctx) => ok(await userService.createGoal(ctx.auth!.userId, ctx.data), { status: 201, traceId: ctx.traceId }),
  { bodySchema: createGoalSchema },
)

export const PATCH = withAuth(
  async (ctx) => {
    const input = ctx.data
    await userService.closeGoal(ctx.auth!.userId, input.goalId, input.status)
    return ok(null, { traceId: ctx.traceId })
  },
  { bodySchema: closeGoalSchema },
)
