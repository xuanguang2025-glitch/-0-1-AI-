/**
 * POST /api/exams/:id/start — 开始作答（E2）。
 * 创建 attempt（服务端倒计时基准 deadlineAt），返回题目（**不含答案**）。
 */
import { withAuth, created } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { startAttempt } from '@/services/exam.service'

export const POST = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await startAttempt(ctx.auth!.userId, ctx.params.id)
    return created(data, { traceId: ctx.traceId })
  },
  { rateLimit: userRateLimitRule('exam:start', 30, 60_000) },
)
