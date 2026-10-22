/**
 * POST /api/wrong-questions/:id/review — 错题复习动作（闭环写侧）。
 * body.action = 'master'（标记已掌握）| 'reopen'（重新打开）。
 * 错题的**写入**仍归各业务 service（阅读/语法/听力求职单一写入口），本路由只做复习状态翻转。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { markMastered, reopenQuestion } from '@/services/wrong-questions.service'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['master', 'reopen']),
})

export const POST = withAuth<unknown, { action: 'master' | 'reopen' }, { id: string }>(
  async (ctx) => {
    const data =
      ctx.data.action === 'master'
        ? await markMastered(ctx.auth!.userId, ctx.params.id)
        : await reopenQuestion(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema, rateLimit: userRateLimitRule('wrong-questions:review', 300, 60_000) },
)
