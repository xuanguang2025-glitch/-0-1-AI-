/**
 * POST /api/listening/:recordId/analyze — AI 听力分析（L6，能力 A12）。
 *
 * 降级兜底：AI 不可用时返回**规则推导**的分析（依据本次正确率 / 听写 diff / 生词），
 * 并在 `source` 字段标明来源，用户看到的永远是真实可用内容而不是一句「AI 不可用」。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { analyzeRecord } from '@/services/listening.service'

export const POST = withAuth<unknown, unknown, { recordId: string }>(
  async (ctx) => {
    const data = await analyzeRecord(ctx.auth!.userId, ctx.params.recordId)
    return ok(data, { traceId: ctx.traceId })
  },
  { rateLimit: aiRateLimitRule('LISTENING_ANALYZE') },
)
