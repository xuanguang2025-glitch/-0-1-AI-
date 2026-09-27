/**
 * GET /api/auth/me — 当前用户信息（需登录）。
 */
import { withApi, ok } from '@/lib/api/handler'
import * as authService from '@/services/auth.service'

export const GET = withApi(
  async (ctx) => {
    const user = await authService.me(ctx.auth!.userId)
    return ok(user, { traceId: ctx.traceId })
  },
  { auth: true },
)
