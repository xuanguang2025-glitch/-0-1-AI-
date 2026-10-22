/**
 * POST /api/writing/:id/analyze — AI 批改（W4）。
 *
 * 双轨语义：AI 成功 → `scoreSource='ai'` + 六维/改写落库；
 * Mock/降级/异常 → **保持规则轨**（`scoreSource='rule'`），规则分不受影响，
 * 前端据此显示「规则评分」徽章（T17 验收 4：页面不空白）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { analyzeSubmission } from '@/services/writing.service'

export const POST = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await analyzeSubmission(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
  { rateLimit: aiRateLimitRule('WRITING_REVIEW') },
)
