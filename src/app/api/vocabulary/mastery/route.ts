/**
 * GET /api/vocabulary/mastery — 掌握度概览（按 stage 分组计数）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getMasteryOverview } from '@/services/vocabulary.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await getMasteryOverview(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)
