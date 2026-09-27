/**
 * GET /api/placement/[id]/report — 测评报告。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getReport } from '@/services/placement.service'

type Ctx = { params: { id: string } }

export const GET = withAuth(
  async (ctx) => {
    const report = await getReport(ctx.auth!.userId, ctx.params.id!)
    return ok(report, { traceId: ctx.traceId })
  },
) as unknown as (request: Request, context: Ctx) => Promise<Response>
