/**
 * GET /api/analytics/history — 历史学习记录（复习流水，分页）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listRecords } from '@/services/vocabulary.service'
import { recordsQuerySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const page = ctx.queryData.page ?? ctx.page.page
    const pageSize = ctx.queryData.pageSize ?? ctx.page.pageSize
    const data = await listRecords(ctx.auth!.userId, page, pageSize)
    return ok(data.items, {
      traceId: ctx.traceId,
      meta: { page, pageSize, total: data.total, totalPages: Math.ceil(data.total / pageSize) },
    })
  },
  { querySchema: recordsQuerySchema },
)
