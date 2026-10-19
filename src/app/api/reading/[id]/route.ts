/**
 * GET /api/reading/:id — 文章详情（R2，断点续读）。
 * 返回分段正文 / 重点词 / 长难句 / 题目（**不含答案**）+ 该用户的阅读进度。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getArticleDetail } from '@/services/reading.service'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getArticleDetail(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
