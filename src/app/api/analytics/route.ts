/**
 * GET /api/analytics — 指标卡总览（今日 + 累计 + 连续天数）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getOverview } from '@/services/analytics.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await getOverview(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)
