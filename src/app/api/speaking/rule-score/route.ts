/**
 * POST /api/speaking/rule-score — 纯规则评分（S6，验收 3）。
 * **无需 AI**：transcript + durationSec → wpm/fillerCount/avgSentenceLen/coverage/score。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { computeRuleScoreEndpoint } from '@/services/speaking.service'
import { z } from 'zod'

const bodySchema = z.object({
  transcript: z.string().min(1).max(20_000),
  durationSec: z.number().int().min(0).max(86_400),
  pauseCount: z.number().int().min(0).max(10_000).optional(),
  targetWords: z.array(z.string().min(1).max(200)).max(20).optional(),
})

export const POST = withAuth<unknown, { transcript: string; durationSec: number; pauseCount?: number; targetWords?: string[] }>(
  async (ctx) => {
    const data = await computeRuleScoreEndpoint(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: userRateLimitRule('speaking:rule-score', 300, 60_000) },
)
