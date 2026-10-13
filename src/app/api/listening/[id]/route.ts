/**
 * GET /api/listening/:id — 精听页数据（L2）。
 * 返回三档语速音频、时间轴字幕、生词考点、当前用户播放进度。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getMaterialDetail } from '@/services/listening.service'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getMaterialDetail(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)
