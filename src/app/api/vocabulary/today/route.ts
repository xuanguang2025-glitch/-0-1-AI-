/**
 * GET /api/vocabulary/today — 今日新词列表（按词书顺序，30 词上限）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTodayWords } from '@/services/vocabulary.service'
import { todayQuerySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await getTodayWords(ctx.auth!.userId, ctx.queryData.book)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: todayQuerySchema },
)
