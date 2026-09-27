/**
 * POST /api/vocabulary/review — 复习提交（服务端 SRS 推进 + 幂等 + 乐观锁）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { submitReview } from '@/services/vocabulary.service'
import { reviewBodySchema } from '@/features/vocabulary/schemas'

export const POST = withAuth(
  async (ctx) => {
    const data = await submitReview(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: reviewBodySchema, rateLimit: { key: 'vocab-review', limit: 120, windowMs: 60_000 } },
)
