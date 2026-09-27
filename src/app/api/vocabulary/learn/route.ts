/**
 * POST /api/vocabulary/learn — 学一个新词（建 UserVocabulary，幂等：已学直接返回）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { learnWord } from '@/services/vocabulary.service'
import { z } from 'zod'

const bodySchema = z.object({
  vocabularyId: z.string().min(1),
})

export const POST = withAuth(
  async (ctx) => {
    const result = await learnWord(ctx.auth!.userId, ctx.data.vocabularyId)
    return ok(result, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: { key: 'vocab-learn', limit: 120, windowMs: 60_000 } },
)
