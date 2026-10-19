/**
 * POST /api/reading/:id/quiz/submit — 提交阅读理解（R3）。
 *
 * 判分**全部在服务端**完成（选择题字母/多选集合比对），0 个依赖 AI —— Mock 阶段
 * 也可完整闭环。错题自动写入 `wrong_questions`（source='reading'），
 * 同时写入 `reading_records.quizResult` 与当日统计。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { submitQuiz } from '@/services/reading.service'

import { readingQuizSubmitSchema, type ReadingQuizSubmit } from '@/features/reading/schemas'

export const POST = withAuth<unknown, ReadingQuizSubmit, { id: string }>(
  async (ctx) => {
    const data = await submitQuiz(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: readingQuizSubmitSchema, rateLimit: userRateLimitRule('reading:quiz', 120, 60_000) },
)
