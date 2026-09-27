/**
 * POST /api/auth/register — 注册（公开接口，限流 10/10min/IP）。
 * 成功即建立会话：Set-Cookie access_token + refresh_token（httpOnly）。
 */
import { registerSchema } from '@/features/auth/schemas'
import { withApi, created } from '@/lib/api/handler'
import { setAuthCookies } from '@/lib/auth/cookies'
import { authRateLimitRule } from '@/lib/auth/route-guards'
import { clientIp } from '@/lib/auth/rate-limit'
import * as authService from '@/services/auth.service'

export const POST = withApi(
  async (ctx) => {
    const result = await authService.register(ctx.data, {
      ip: clientIp(ctx.request),
      userAgent: ctx.request.headers.get('user-agent') ?? undefined,
    })
    const response = created({ user: result.user }, { traceId: ctx.traceId })
    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken })
    return response
  },
  { bodySchema: registerSchema, rateLimit: authRateLimitRule('register') },
)
