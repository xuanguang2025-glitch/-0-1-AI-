/**
 * POST /api/ai/cet-advice — 备考建议（A18，结构化 + 降级）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { aiService } from '@/services/ai/ai.service'
import type { AiRunContext } from '@/services/ai/types'

const cetAdviceSchema = z.object({
  scores: z.record(z.number().nullish()).nullish(),
  examDate: z.string().nullish(),
  targetExam: z.string().nullish(),
})

export const POST = withAuth(
  async (ctx) => {
    const aiCtx: AiRunContext = { userId: ctx.auth!.userId, traceId: ctx.traceId, locale: 'zh-CN' }
    const result = await aiService.cetAdvice(
      { scoresJson: ctx.data.scores ?? {}, examDate: ctx.data.examDate, targetExam: ctx.data.targetExam },
      aiCtx,
    )
    return ok(result.data, {
      traceId: ctx.traceId,
      ai: {
        degraded: result.degraded,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
      },
    })
  },
  { bodySchema: cetAdviceSchema, rateLimit: aiRateLimitRule('cet-advice') },
)
