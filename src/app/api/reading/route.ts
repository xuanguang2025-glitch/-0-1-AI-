/**
 * GET /api/reading — 阅读文章列表（R1，架构 §3.1）。
 * 支持 category / difficulty / cefr / 标题搜索与分页；facets 反映全量分布。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listArticles } from '@/services/reading.service'

import { readingListQuerySchema } from '@/features/reading/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await listArticles(ctx.auth!.userId, ctx.queryData)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: readingListQuerySchema },
)
