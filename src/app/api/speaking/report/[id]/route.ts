/**
 * GET /api/speaking/report/:id — 口语评分报告（S5）。
 * Mock 阶段 scoreSource='rule'，4 维文本级评分（**无"发音"维度**——宁缺毋假）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getReport } from '@/services/speaking.service'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getReport(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
