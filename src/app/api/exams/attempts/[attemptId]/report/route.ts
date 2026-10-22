/**
 * GET /api/exams/attempts/:attemptId/report — 专项卷报告（正确率 + 分项 + 逐题解析）。
 * 独立于 paper 路由（报告挂在 attempt 维度）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getExamReport } from '@/services/exam.service'

export const GET = withAuth<unknown, unknown, { attemptId: string }>(
  async (ctx) => {
    const data = await getExamReport(ctx.auth!.userId, ctx.params.attemptId)
    return ok(data, { traceId: ctx.traceId })
  },
)
