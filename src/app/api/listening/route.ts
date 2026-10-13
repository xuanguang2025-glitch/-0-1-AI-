/**
 * GET /api/listening — 听力材料列表（L1，架构 §3.1）。
 * 支持 category / difficulty / cefr / intensity 筛选与分页；facets 反映全量分布。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listMaterials } from '@/services/listening.service'

import { listeningListQuerySchema } from '@/features/listening/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await listMaterials(ctx.auth!.userId, ctx.queryData)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: listeningListQuerySchema },
)
