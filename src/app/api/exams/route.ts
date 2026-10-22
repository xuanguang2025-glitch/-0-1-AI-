/**
 * GET /api/exams — 专项训练卷列表（E1）。
 * 仅列出 PUBLISHED 专项卷；附当前用户作答次数。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listPapers } from '@/services/exam.service'

export const GET = withAuth(
  async (ctx) => {
    const data = await listPapers(ctx.auth!.userId)
    return ok(data, { traceId: ctx.traceId })
  },
)
