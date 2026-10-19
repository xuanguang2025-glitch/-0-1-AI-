/**
 * POST /api/grammar/:id/exercise/submit — 提交练习（G4）。
 *
 * 判分**全部在服务端**完成（选择题字母比对），0 个依赖 AI —— Mock 阶段完整闭环。
 * 错题自动写入 `wrong_questions`（source='grammar'）；掌握度（累计正确率）落在
 * `user_grammar_progress`；同时写入当日语法统计。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { submitExercises } from '@/services/grammar.service'

import { grammarExerciseSubmitSchema, type GrammarExerciseSubmit } from '@/features/grammar/schemas'

export const POST = withAuth<unknown, GrammarExerciseSubmit, { id: string }>(
  async (ctx) => {
    const data = await submitExercises(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: grammarExerciseSubmitSchema, rateLimit: userRateLimitRule('grammar:exercise', 120, 60_000) },
)
