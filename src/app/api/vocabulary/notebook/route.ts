/**
 * GET  /api/vocabulary/notebook — 生词本列表。
 * POST /api/vocabulary/notebook — 切换生词本收藏状态。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getNotebook, toggleNotebook } from '@/services/vocabulary.service'
import { notebookBodySchema } from '@/features/vocabulary/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await getNotebook(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)

export const POST = withAuth(
  async (ctx) => {
    const data = await toggleNotebook(ctx.auth!.userId, ctx.data.userVocabId)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: notebookBodySchema },
)
