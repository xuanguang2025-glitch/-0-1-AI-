/**
 * GET /api/listening/:id/questions — 按训练模式取题（L3）。
 *
 * 模式 → 题目来源（§5.2）：
 *   EXTENSIVE / CHOICE / CLOZE → listening_questions（客观题，服务端判分）
 *   KEYWORD                    → focusPoints 生成的填空题（脚本模糊判分）
 *   INTENSIVE / DICTATION      → 无客观题，返回逐句原文
 *   RETELL                     → Phase 3，available=false
 *
 * 注意：**不返回答案**，判分在 L4 服务端完成，防止客户端自评作弊。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { getModeQuestions } from '@/services/listening.service'

import { listeningQuestionsQuerySchema, type ListeningQuestionsQuery } from '@/features/listening/schemas'

export const GET = withAuth<ListeningQuestionsQuery, unknown, { id: string }>(
  async (ctx) => {
    const data = await getModeQuestions(ctx.auth!.userId, ctx.params.id, ctx.queryData.mode)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: listeningQuestionsQuerySchema },
)
