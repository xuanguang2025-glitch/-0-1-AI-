/**
 * POST /api/placement — 开始/恢复水平测试。
 */
import { withAuth, created } from '@/lib/api/handler'
import { startTest } from '@/services/placement.service'

export const POST = withAuth(
  async (ctx) => {
    const result = await startTest(ctx.auth!.userId)
    return created(result, { traceId: ctx.traceId })
  },
)
