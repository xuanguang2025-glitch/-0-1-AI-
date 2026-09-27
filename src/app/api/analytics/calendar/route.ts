/**
 * GET /api/analytics/calendar?days=140 — 热力日历数据。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getCalendar } from '@/services/analytics.service'
import { calendarQuerySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await getCalendar(ctx.auth!.userId, ctx.queryData.days ?? 140)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: calendarQuerySchema },
)
