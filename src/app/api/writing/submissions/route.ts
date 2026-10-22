/**
 * GET  /api/writing/submissions — 我的作文列表（W2a）。
 * POST /api/writing/submissions — 新建作文（W2）：**同步返回规则检查结果**，
 * 0 AI 依赖、<200ms —— 编辑器边写边出规则提示的数据来源（T17 验收 3）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { createSubmission, listSubmissions } from '@/services/writing.service'

import { writingCreateSchema, writingSubmissionQuerySchema, type WritingCreateInput } from '@/features/writing/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await listSubmissions(ctx.auth!.userId, ctx.queryData)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: writingSubmissionQuerySchema },
)

export const POST = withAuth<unknown, WritingCreateInput>(
  async (ctx) => {
    const data = await createSubmission(ctx.auth!.userId, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: writingCreateSchema, rateLimit: userRateLimitRule('writing:create', 60, 60_000) },
)
