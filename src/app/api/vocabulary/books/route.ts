/**
 * GET /api/vocabulary/books — 词书列表。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listBooks } from '@/services/vocabulary.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await listBooks()
    return ok(data, { traceId: ctx.traceId })
  },
)
