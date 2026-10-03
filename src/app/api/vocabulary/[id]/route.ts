/**
 * GET /api/vocabulary/[id] — 单词详情（词库数据 + 当前用户学习状态）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getWordDetail } from '@/services/vocabulary.service'


export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getWordDetail(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
