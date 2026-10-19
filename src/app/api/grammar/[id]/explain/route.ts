/**
 * POST /api/grammar/:id/explain — AI 知识点讲解（G5）。
 *
 * Mock/降级时**回落静态知识点**（`source='static'`，设计文档验收 3）——
 * 与阅读的「隐藏区块」策略不同：语法讲解是学习主体，不能整个消失，
 * 因此给静态兜底并在 `source` 字段标明来源。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { explainTopic } from '@/services/grammar.service'

import { grammarExplainSchema, type GrammarExplain } from '@/features/grammar/schemas'

export const POST = withAuth<unknown, GrammarExplain, { id: string }>(
  async (ctx) => {
    const data = await explainTopic(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: grammarExplainSchema, rateLimit: aiRateLimitRule('GRAMMAR_EXPLAIN') },
)
