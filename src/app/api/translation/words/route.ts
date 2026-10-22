/**
 * GET  /api/translation/words?text=... — 生词抽取（词典直查，0 AI）。
 * POST /api/translation/words — 把指定词加入生词本（inNotebook=true）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { addWordToNotebook, extractWords } from '@/services/translation.service'

import { translationAddWordSchema, translationWordsQuerySchema, type TranslationAddWordInput } from '@/features/translation/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await extractWords(ctx.auth!.userId, ctx.queryData.text)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: translationWordsQuerySchema, rateLimit: userRateLimitRule('translation:words', 300, 60_000) },
)

export const POST = withAuth<unknown, TranslationAddWordInput>(
  async (ctx) => {
    const data = await addWordToNotebook(ctx.auth!.userId, ctx.data.vocabularyId)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: translationAddWordSchema, rateLimit: userRateLimitRule('translation:words', 300, 60_000) },
)
