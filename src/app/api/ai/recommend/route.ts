/**
 * POST /api/ai/recommend — 个性化推荐（A16，结构化 + 降级返回 []）。
 */
import { z } from 'zod'
import { withAuth, ok } from '@/lib/api/handler'
import { aiService } from '@/services/ai/ai.service'
import type { AiRunContext } from '@/services/ai/types'

const recommendSchema = z.object({
  profile: z
    .object({
      level: z.string().nullish(),
      weakPoints: z.array(z.string()).nullish(),
      recentTasks: z.array(z.string()).nullish(),
      streakDays: z.number().int().min(0).nullish(),
    })
    .passthrough(),
})

export const POST = withAuth(
  async (ctx) => {
    const aiCtx: AiRunContext = { userId: ctx.auth!.userId, traceId: ctx.traceId, locale: 'zh-CN' }
    const result = await aiService.recommend({ profile: ctx.data.profile }, aiCtx)
    return ok(result.data, {
      traceId: ctx.traceId,
      ai: { degraded: result.degraded, provider: result.provider, model: result.model, latencyMs: result.latencyMs },
    })
  },
  { bodySchema: recommendSchema },
)
