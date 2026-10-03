/**
 * GET /api/placement/[id]/report — 测评报告。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getReport } from '@/services/placement.service'


export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const report = await getReport(ctx.auth!.userId, ctx.params.id)
    return ok(report, { traceId: ctx.traceId })
  },
)
