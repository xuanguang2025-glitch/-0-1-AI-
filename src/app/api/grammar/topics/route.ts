/**
 * GET /api/grammar/topics — 语法主题树（G1，架构 §3.1）。
 * `grammar_topics` 以 parent/children 组装成树；掌握度来自 `user_grammar_progress`。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listTopics } from '@/services/grammar.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await listTopics(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)
