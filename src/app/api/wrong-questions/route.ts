/**
 * GET /api/wrong-questions — 错题本列表（错题本闭环，team-lead 增补项）。
 * 支持 source 筛选 / 掌握状态筛选 / 分页；sourceCounts 供筛选 chips 计数。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listWrongQuestions } from '@/services/wrong-questions.service'
import { z } from 'zod'

const querySchema = z.object({
  source: z.string().trim().max(32).optional(),
  mastered: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

export const GET = withAuth(
  async (ctx) => {
    const data = await listWrongQuestions(ctx.auth!.userId, {
      source: ctx.queryData.source,
      mastered: ctx.queryData.mastered === undefined ? undefined : ctx.queryData.mastered === 'true',
      page: ctx.queryData.page,
      pageSize: ctx.queryData.pageSize,
    })
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema },
)
