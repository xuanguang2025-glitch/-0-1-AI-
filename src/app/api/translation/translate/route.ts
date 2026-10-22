/**
 * POST /api/translation/translate — 翻译（T1）。
 * ≤500 字符；返回 5 档译文（Mock 下可能仅 literal 可用）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { aiRateLimitRule } from '@/lib/auth/route-guards'
import { translateText } from '@/services/translation.service'

import { translateSchema, type TranslateInput } from '@/features/translation/schemas'

export const POST = withAuth<unknown, TranslateInput>(
  async (ctx) => {
    const data = await translateText(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: translateSchema, rateLimit: aiRateLimitRule('TRANSLATE') },
)
