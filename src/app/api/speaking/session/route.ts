/**
 * POST /api/speaking/session — 创建口语会话（S2）。
 * 返回 sessionId + 欢迎语（首条 AI 消息已落库）。
 */
import { withAuth, created } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { createSession } from '@/services/speaking.service'
import { z } from 'zod'

const bodySchema = z.object({
  roleKey: z.string().min(1).max(32),
  sceneKey: z.string().min(1).max(32),
  mode: z.enum(['partner', 'pronunciation']).optional(),
})

export const POST = withAuth<unknown, { roleKey: string; sceneKey: string; mode?: 'partner' | 'pronunciation' }>(
  async (ctx) => {
    const data = await createSession(ctx.auth!.userId, ctx.data)
    return created(data, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: userRateLimitRule('speaking:create', 60, 60_000) },
)
