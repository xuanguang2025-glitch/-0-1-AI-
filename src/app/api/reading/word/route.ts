/**
 * GET /api/reading/word?word=xxx — 划词直查（T15 验收 2）。
 *
 * **词典直查、不调 AI**：查 `vocabulary` 表（ECDICT 语料），响应快、离线可用、
 * 成本为零；查不到时返回 `found: false`，前端提示「词典未收录」，不阻塞阅读。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { lookupWord } from '@/services/reading.service'

import { readingWordQuerySchema } from '@/features/reading/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await lookupWord(ctx.queryData.word)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: readingWordQuerySchema, rateLimit: userRateLimitRule('reading:word', 600, 60_000) },
)
