/**
 * POST /api/speaking/session/:id/end — 结束并评分（S4，幂等）。
 * S6 规则评分恒定执行；AI（SPEAKING_SCORE）Mock/降级时 scoreSource 保持 'rule'。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { endSession } from '@/services/speaking.service'
import { z } from 'zod'

const bodySchema = z.object({
  durationSec: z.number().int().min(0).max(86_400).optional(),
  pauseCount: z.number().int().min(0).max(10_000).optional(),
})

export const POST = withAuth<unknown, { durationSec?: number; pauseCount?: number }, { id: string }>(
  async (ctx) => {
    const data = await endSession(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: userRateLimitRule('speaking:end', 60, 60_000) },
)
