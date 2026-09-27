/**
 * GET /api/health — 存活探针（Docker HEALTHCHECK / docker-compose 使用）。
 * 检查 DB 连通性；不要求登录。 PUBLIC 路由（middleware 白名单）。
 */
import { withApi, ok, fail } from '@/lib/api/handler'
import { pingDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (ctx) => {
  const dbOk = await pingDatabase()
  if (!dbOk) {
    return fail('SYS_DEPENDENCY_DOWN', { traceId: ctx.traceId })
  }
  return ok(
    {
      status: 'ok',
      service: 'englishai',
      db: 'up',
      time: new Date().toISOString(),
    },
    { traceId: ctx.traceId },
  )
})
