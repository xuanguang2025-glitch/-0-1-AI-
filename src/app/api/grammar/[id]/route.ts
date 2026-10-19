/**
 * GET /api/grammar/:id — 语法主题详情（G2）。
 * 返回知识点讲解 / 例句 / 错误示例对照 + 当前用户掌握度。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getTopicDetail } from '@/services/grammar.service'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getTopicDetail(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
