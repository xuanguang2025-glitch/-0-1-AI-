/**
 * POST /api/auth/reset-password — 重置密码（公开接口，凭一次性 token）。
 * 成功后撤销该用户全部会话。
 */
import { resetPasswordSchema } from '@/features/auth/schemas'
import { withApi, ok } from '@/lib/api/handler'
import { authRateLimitRule } from '@/lib/auth/route-guards'
import * as authService from '@/services/auth.service'

export const POST = withApi(
  async (ctx) => {
    const result = await authService.resetPassword(ctx.data)
    return ok(result, { traceId: ctx.traceId })
  },
  { bodySchema: resetPasswordSchema, rateLimit: authRateLimitRule('forgot') },
)
