/**
 * GET /api/analytics/calendar?days=140 — 热力日历数据（连续日期数组）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getCalendar } from '@/services/analytics.service'
import { z } from 'zod'

const querySchema = z.object({
  days: z.coerce.number().int().min(30).max(366).default(140),
})

export const GET = withAuth(
  async (ctx) => {
    const data = await getCalendar(ctx.auth!.userId, ctx.queryData.days)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema },
)
