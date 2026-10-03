/**
 * POST /api/dashboard/tasks/[id]/complete — 完成今日任务（幂等）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { completeTask } from '@/services/dashboard.service'


export const POST = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const result = await completeTask(ctx.auth!.userId, ctx.params.id)
    return ok(result, { traceId: ctx.traceId })
  },
)
