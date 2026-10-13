/**
 * POST /api/listening/progress — 保存播放进度（L7）。
 * 幂等：以 `@@unique([userId, materialId])` 为键 upsert。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { saveProgress } from '@/services/listening.service'

import { listeningProgressBodySchema } from '@/features/listening/schemas'

export const POST = withAuth(
  async (ctx) => {
    const data = await saveProgress(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: listeningProgressBodySchema, rateLimit: userRateLimitRule('listening:progress', 300, 60_000) },
)
