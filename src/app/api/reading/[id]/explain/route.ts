/**
 * POST /api/reading/:id/explain — AI 句子讲解（R4）。
 *
 * Mock/降级时返回 `{degraded: true, explanation: null}`，前端据此**隐藏整个 AI 区块**
 * （设计文档验收 5）——绝不给一句「AI 不可用」占位，也不让页面白屏。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { explainSentence } from '@/services/reading.service'

import { readingExplainSchema, type ReadingExplain } from '@/features/reading/schemas'

export const POST = withAuth<unknown, ReadingExplain, { id: string }>(
  async (ctx) => {
    const data = await explainSentence(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: readingExplainSchema, rateLimit: aiRateLimitRule('READING_EXPLAIN') },
)
