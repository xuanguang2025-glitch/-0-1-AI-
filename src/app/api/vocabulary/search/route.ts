/**
 * GET /api/vocabulary/search?q= — 词库搜索（前缀/包含，≤50）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { searchWords } from '@/services/vocabulary.service'
import { z } from 'zod'

const querySchema = z.object({
  q: z.string().trim().max(64).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const GET = withAuth(
  async (ctx) => {
    const words = await searchWords(ctx.queryData.q ?? '', ctx.queryData.limit)
    return ok(words, { traceId: ctx.traceId })
  },
  { querySchema },
)
