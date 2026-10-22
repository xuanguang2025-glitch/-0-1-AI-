/**
 * PATCH /api/exams/:id/attempts/:attemptId/answers — 单题自动保存（验收 2）。
 * upsert 答案 + attempt.saveVersion 自增（乱序到达保护）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { saveAnswer } from '@/services/exam.service'
import { z } from 'zod'

const bodySchema = z.object({
  examQuestionId: z.string().min(1).max(64),
  userAnswer: z.string().max(2000),
  saveVersion: z.number().int().min(0).optional(),
})

export const PATCH = withAuth<unknown, { examQuestionId: string; userAnswer: string; saveVersion?: number }, { id: string; attemptId: string }>(
  async (ctx) => {
    const data = await saveAnswer(ctx.auth!.userId, ctx.params.attemptId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema },
)
