/**
 * GET /api/dashboard — 9 Block 聚合（AI 建议区块独立降级）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getDashboard } from '@/services/dashboard.service'
import type { AiRunContext } from '@/services/ai/types'

export const GET = withAuth(
  async (ctx) => {
    const aiCtx: AiRunContext = { userId: ctx.auth!.userId, traceId: ctx.traceId, locale: 'zh-CN' }
    const data = await getDashboard(ctx.auth!.userId, aiCtx)
    return ok(data, { traceId: ctx.traceId })
  },
)
