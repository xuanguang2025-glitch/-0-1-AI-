/**
 * GET /api/vocabulary/today — 今日新词（按词书顺序，未学 30 词）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTodayWords } from '@/services/vocabulary.service'
import { z } from 'zod'

const querySchema = z.object({
  book: z.string().trim().min(1).max(64).optional(),
})

export const GET = withAuth(
  async (ctx) => {
    const data = await getTodayWords(ctx.auth!.userId, ctx.queryData.book)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema },
)
