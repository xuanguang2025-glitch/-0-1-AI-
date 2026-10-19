/**
 * POST /api/reading/:id/progress — 断点续读（T15 验收 1）。
 * 以 `@@unique([userId, articleId])` 为键 upsert；同时把阅读秒数计入当日统计。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { saveReadingProgress } from '@/services/reading.service'

import { readingProgressSchema, type ReadingProgress } from '@/features/reading/schemas'

export const POST = withAuth<unknown, ReadingProgress, { id: string }>(
  async (ctx) => {
    const data = await saveReadingProgress(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: readingProgressSchema, rateLimit: userRateLimitRule('reading:progress', 600, 60_000) },
)
