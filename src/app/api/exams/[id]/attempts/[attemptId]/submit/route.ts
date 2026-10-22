/**
 * POST /api/exams/:id/attempts/:attemptId/submit — 交卷（E3，**幂等**）。
 * 确定性判分（客观题字母比对，0 AI）；错题入库；**不写 cetEstimate**（验收 4）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { submitAttempt } from '@/services/exam.service'
import { z } from 'zod'

const bodySchema = z.object({
  answers: z
    .array(
      z.object({
        examQuestionId: z.string().min(1).max(64),
        userAnswer: z.string().max(2000),
      }),
    )
    .min(0)
    .max(200),
  timeUsedSec: z.number().int().min(0).max(86_400).optional(),
})

export const POST = withAuth<
  unknown,
  { answers: Array<{ examQuestionId: string; userAnswer: string }>; timeUsedSec?: number },
  { id: string; attemptId: string }
>(
  async (ctx) => {
    const data = await submitAttempt(ctx.auth!.userId, ctx.params.attemptId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: userRateLimitRule('exam:submit', 30, 60_000) },
)
