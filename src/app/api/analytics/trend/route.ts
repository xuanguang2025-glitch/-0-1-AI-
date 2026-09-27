/**
 * GET /api/analytics/trend?days=30 — 近 N 天趋势（补零对齐）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTrend } from '@/services/analytics.service'
import { z } from 'zod'

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
})

export const GET = withAuth(
  async (ctx) => {
    const points = await getTrend(ctx.auth!.userId, ctx.queryData.days)
    return ok(points, { traceId: ctx.traceId })
  },
  { querySchema },
)
