/**
 * POST /api/listening/:id/attempts — 提交训练结果（L4）。
 *
 * 判分**全部在服务端**完成（客观题精确匹配 / 关键词模糊匹配 / 听写本地 diff），
 * 0 个依赖 AI —— Mock 阶段也可完整闭环。同时写入当日听力统计。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { submitAttempt } from '@/services/listening.service'

import { listeningAttemptBodySchema, type ListeningAttemptBody } from '@/features/listening/schemas'

export const POST = withAuth<unknown, ListeningAttemptBody, { id: string }>(
  async (ctx) => {
    const data = await submitAttempt(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: listeningAttemptBodySchema, rateLimit: userRateLimitRule('listening:attempt', 120, 60_000) },
)
