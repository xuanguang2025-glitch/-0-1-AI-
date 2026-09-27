/**
 * POST /api/placement/[id]/submit — 交卷评分（幂等：GRADED 后返回已有成绩）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { submitTest } from '@/services/placement.service'

type Ctx = { params: { id: string } }

export const POST = withAuth(
  async (ctx) => {
    const result = await submitTest(ctx.auth!.userId, ctx.params.id!)
    return ok(result, { traceId: ctx.traceId })
  },
) as unknown as (request: Request, context: Ctx) => Promise<Response>
