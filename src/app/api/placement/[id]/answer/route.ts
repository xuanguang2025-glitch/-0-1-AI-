/**
 * POST /api/placement/[id]/answer — 记录单题答案。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import { saveAnswer } from '@/services/placement.service'

const answerSchema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.string().min(1, '请选择答案').max(200),
  responseMs: z.number().int().min(0).max(600_000),
})

type AnswerBody = z.infer<typeof answerSchema>

export const POST = withAuth<unknown, AnswerBody, { id: string }>(
  async (ctx) => {
    await saveAnswer(ctx.auth!.userId, ctx.params.id, ctx.data.questionId, ctx.data.userAnswer, ctx.data.responseMs)
    return ok(null, { traceId: ctx.traceId })
  },
  { bodySchema: answerSchema },
)
