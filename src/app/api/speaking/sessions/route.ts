/**
 * GET /api/speaking/sessions — 历史会话（S7，分页 + sceneKey 筛选）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listSessions } from '@/services/speaking.service'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  sceneKey: z.string().trim().max(32).optional(),
})

export const GET = withAuth(
  async (ctx) => {
    const data = await listSessions(ctx.auth!.userId, ctx.queryData)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema },
)
