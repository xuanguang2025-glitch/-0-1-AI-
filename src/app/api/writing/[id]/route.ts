/**
 * GET   /api/writing/:id — 作文详情（W3）：双轨分数 + 字数达标状态。
 * PATCH /api/writing/:id — 自动保存（T17 验收 6）：内容变更即重算规则检查，
 *                          0 AI 依赖；前端防抖 ≤3s 调用，刷新不丢稿。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { userRateLimitRule } from '@/lib/auth/route-guards'
import { getSubmissionDetail, updateSubmission } from '@/services/writing.service'

import { writingUpdateSchema, type WritingUpdateInput } from '@/features/writing/schemas'

export const GET = withAuth<unknown, unknown, { id: string }>(
  async (ctx) => {
    const data = await getSubmissionDetail(ctx.auth!.userId, ctx.params.id)
    return ok(data, { traceId: ctx.traceId })
  },
)

export const PATCH = withAuth<unknown, WritingUpdateInput, { id: string }>(
  async (ctx) => {
    const data = await updateSubmission(ctx.auth!.userId, ctx.params.id, ctx.data)
    return ok(data, { traceId: ctx.traceId })
  },
  { bodySchema: writingUpdateSchema, rateLimit: userRateLimitRule('writing:save', 600, 60_000) },
)
