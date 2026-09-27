/**
 * POST /api/auth/forgot-password — 找回密码申请（公开接口，限流 10/10min/IP）。
 * Phase 1 不发真实邮件：dev 环境在 devHint 返回重置链接；生产恒为 null（防枚举）。
 */
import { forgotPasswordSchema } from '@/features/auth/schemas'
import { withApi, ok } from '@/lib/api/handler'
import { authRateLimitRule } from '@/lib/auth/route-guards'
import * as authService from '@/services/auth.service'

export const POST = withApi(
  async (ctx) => {
    const result = await authService.forgotPassword(ctx.data.email)
    return ok(result, { traceId: ctx.traceId })
  },
  { bodySchema: forgotPasswordSchema, rateLimit: authRateLimitRule('forgot') },
)
