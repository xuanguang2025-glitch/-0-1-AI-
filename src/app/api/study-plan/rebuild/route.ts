/**
 * POST /api/study-plan/rebuild — Placement 交卷后重算未完成任务（架构 §5.2.2 / M1）。
 *
 * 由前端在 Placement 交卷成功后调用；重算今日起 7 天内的**未完成**任务，
 * 已完成任务保持不变（M3 完成率口径稳定）。幂等：可安全重复调用。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { rebuildTasks } from '@/services/plan/rebuild'

export const POST = withAuth(
  async (ctx) => {
    const result = await rebuildTasks(ctx.auth!.userId, { kind: 'PLACEMENT_COMPLETED' })
    return ok(
      {
        ...result,
        planRegenerateHint: '已按测评结果重算未完成任务',
      },
      { traceId: ctx.traceId },
    )
  },
  { rateLimit: userRateLimitRule('study-plan:rebuild', 10, 60_000) },
)
