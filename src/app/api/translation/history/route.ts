/**
 * GET /api/translation/history — 翻译历史（T3，验收 4）。
 * 服务端在创建时裁剪到最近 50 条；本路由支持分页与「只看收藏」。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listHistory } from '@/services/translation.service'

import { translationHistoryQuerySchema } from '@/features/translation/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await listHistory(ctx.auth!.userId, {
      page: ctx.queryData.page,
      pageSize: ctx.queryData.pageSize,
      favoriteOnly: ctx.queryData.favoriteOnly === 'true',
    })
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: translationHistoryQuerySchema },
)
