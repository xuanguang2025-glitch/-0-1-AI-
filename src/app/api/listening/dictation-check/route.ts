/**
 * POST /api/listening/dictation-check — 听写比对（L8，**纯本地 diff，不调 AI**）。
 *
 * 决策：听写批改是确定性问题（字符串 diff），零成本、零延迟、无降级问题。
 * 同一算法在 L4 提交时复用，保证「实时预览」与「正式提交」结果一致。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { checkDictation } from '@/services/listening.service'

import { dictationCheckBodySchema } from '@/features/listening/schemas'

export const POST = withAuth(
  async (ctx) => {
    const data = checkDictation(ctx.data.original, ctx.data.dictation)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: dictationCheckBodySchema },
)
