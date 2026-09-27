/**
 * GET /api/analytics/trend?days=30 — 近 N 天学习趋势（补零日期轴）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTrend } from '@/services/analytics.service'
import { trendQuerySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await getTrend(ctx.auth!.userId, ctx.queryData.days ?? 30)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: trendQuerySchema },
)
