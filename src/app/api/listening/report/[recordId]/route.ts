/**
 * GET /api/listening/report/:recordId — 训练报告（L5）。
 * 规则统计为确定性数字（AI 不可用也保证报告有内容）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getRecordReport } from '@/services/listening.service'

export const GET = withAuth<unknown, unknown, { recordId: string }>(
  async (ctx) => {
    const data = await getRecordReport(ctx.auth!.userId, ctx.params.recordId)
    return ok(data, { traceId: ctx.traceId })
  },
)
