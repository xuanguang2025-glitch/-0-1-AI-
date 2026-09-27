/**
 * GET /api/placement/[id]/questions — 测试题目（去答案）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTestQuestions } from '@/services/placement.service'

type Ctx = { params: { id: string } }

export const GET = withAuth(
  async (ctx) => {
    const questions = await getTestQuestions(ctx.auth!.userId, ctx.params.id!)
    return ok({ questions }, { traceId: ctx.traceId })
  },
) as unknown as (request: Request, context: Ctx) => Promise<Response>
