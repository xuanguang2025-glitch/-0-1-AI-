/**
 * GET /api/grammar/:id/exercise — 取练习题（G3）。
 * **不含答案**（判分在服务端 G4 完成，防止前端自评）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getExercises } from '@/services/grammar.service'

import { grammarExerciseQuerySchema, type GrammarExerciseQuery } from '@/features/grammar/schemas'

export const GET = withAuth<GrammarExerciseQuery, unknown, { id: string }>(
  async (ctx) => {
    const data = await getExercises(ctx.auth!.userId, ctx.params.id, ctx.queryData.count ?? 5)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: grammarExerciseQuerySchema },
)
