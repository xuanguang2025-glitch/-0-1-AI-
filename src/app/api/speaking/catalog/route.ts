/**
 * GET /api/speaking/catalog — 11 角色 × 9 场景目录（S1）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getCatalog } from '@/services/speaking.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await getCatalog()
    return ok(data, { traceId: ctx.traceId })
  },
)
