/**
 * GET  /api/vocabulary/notebook — 生词本列表。
 * POST /api/vocabulary/notebook — 加入/移出生词本（toggle）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getNotebook, toggleNotebook } from '@/services/vocabulary.service'
import { z } from 'zod'

export const GET = withAuth(
  async (ctx) => {
    const items = await getNotebook(ctx.auth!.userId)
    return ok(items, { traceId: ctx.traceId })
  },
)

const toggleSchema = z.object({
  userVocabId: z.string().min(1),
})

export const POST = withAuth(
  async (ctx) => {
    const result = await toggleNotebook(ctx.auth!.userId, ctx.data.userVocabId)
    return ok(result, { traceId: ctx.traceId })
  },
  { bodySchema: toggleSchema },
)
