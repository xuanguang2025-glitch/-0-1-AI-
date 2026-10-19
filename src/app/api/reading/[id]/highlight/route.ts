/**
 * POST /api/reading/:id/highlight — 划词收藏（T15 验收 2 的持久化侧）。
 * 收藏列表存在 `reading_records.highlights`，详情页随文章一起返回。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { addHighlight } from '@/services/reading.service'

import { readingHighlightSchema, type ReadingHighlight } from '@/features/reading/schemas'

export const POST = withAuth<unknown, ReadingHighlight, { id: string }>(
  async (ctx) => {
    const data = await addHighlight(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: readingHighlightSchema, rateLimit: userRateLimitRule('reading:highlight', 120, 60_000) },
)
