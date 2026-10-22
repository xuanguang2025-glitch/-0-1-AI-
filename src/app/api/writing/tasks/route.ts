/**
 * GET /api/writing/tasks — 写作任务列表（W1，架构 §3.1）。
 * 支持 taskType / difficulty / examType 筛选与分页；附带当前用户的提交数。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { listWritingTasks } from '@/services/writing.service'

import { writingTaskQuerySchema } from '@/features/writing/schemas'

export const GET = withAuth(
  async (ctx) => {
    const data = await listWritingTasks(ctx.auth!.userId, ctx.queryData)
    return ok(data, { traceId: ctx.traceId })
  },
  { querySchema: writingTaskQuerySchema },
)
