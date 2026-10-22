/**
 * GET /api/writing/:id/report — 写作报告（W5）。
 * 永远返回可渲染的报告：AI 轨有效 → 六维/改写；否则 → 规则分 + 规则问题清单。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getWritingReport } from '@/services/writing.service'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getWritingReport(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
