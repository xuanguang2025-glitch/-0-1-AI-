/**
 * GET /api/analytics/history — 学习历史（复习流水，分页，同 records）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { buildMeta } from '@/lib/api/pagination'
import { listRecords } from '@/services/vocabulary.service'

export const GET = withAuth(
  async (ctx) => {
    const { page, pageSize } = ctx.page
    const { total, items } = await listRecords(ctx.auth!.userId, page, pageSize)
    return ok(items, { traceId: ctx.traceId, meta: buildMeta(ctx.page, total) })
  },
)
