/**
 * GET /api/vocabulary/search?q= — 单词搜索。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { searchWords } from '@/services/vocabulary.service'
import { searchQuerySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await searchWords(ctx.queryData.q, ctx.queryData.limit ?? 10)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: searchQuerySchema },
)
