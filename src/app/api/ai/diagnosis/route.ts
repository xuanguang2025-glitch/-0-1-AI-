/**
 * POST /api/ai/diagnosis — 每日诊断（A9，结构化 + 降级）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import { aiService } from '@/services/ai/ai.service'
import type { AiRunContext } from '@/services/ai/types'

const diagnosisSchema = z.object({
  stats: z
    .object({
      minutesStudied: z.number().int().min(0).default(0),
      wordsLearned: z.number().int().min(0).default(0),
      wordsReviewed: z.number().int().min(0).default(0),
      accuracy: z.number().min(0).max(1).nullish(),
      tasksCompleted: z.number().int().min(0).default(0),
      tasksTotal: z.number().int().min(0).default(0),
    })
    .passthrough(),
  streakDays: z.number().int().min(0).default(0),
})

export const POST = withAuth(
  async (ctx) => {
    const aiCtx: AiRunContext = { userId: ctx.auth!.userId, traceId: ctx.traceId, locale: 'zh-CN' }
    const result = await aiService.diagnoseDaily(
      { statsJson: ctx.data.stats, streakDays: ctx.data.streakDays },
      aiCtx,
    )
    return ok(result.data, {
      traceId: ctx.traceId,
      ai: {
        degraded: result.degraded,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
      },
    })
  },
  { bodySchema: diagnosisSchema },
)
