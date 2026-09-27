/**
 * POST /api/vocabulary/learn — 学一个新词（建 UserVocabulary + xp/统计）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { learnWord } from '@/services/vocabulary.service'
import { learnBodySchema } from '@/features/vocabulary/schemas'

export const POST = withAuth(
  async (ctx) => {
    const data = await learnWord(ctx.auth!.userId, ctx.data.vocabularyId)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: learnBodySchema, rateLimit: { key: 'vocab-learn', limit: 60, windowMs: 60_000 } },
)
