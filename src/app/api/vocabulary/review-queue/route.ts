/**
 * GET /api/vocabulary/review-queue — 到期复习队列（nextReviewAt 升序，50 词上限）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getReviewQueue } from '@/services/vocabulary.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await getReviewQueue(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)
