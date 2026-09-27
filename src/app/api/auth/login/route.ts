/**
 * POST /api/auth/login — 登录（公开接口，限流 10/10min/IP，5 次失败锁 15min）。
 */
import { loginSchema } from '@/features/auth/schemas'
import { withApi, ok } from '@/lib/api/handler'
import { setAuthCookies } from '@/lib/auth/cookies'
import { authRateLimitRule } from '@/lib/auth/route-guards'
import { clientIp } from '@/lib/auth/rate-limit'
import * as authService from '@/services/auth.service'

export const POST = withApi(
  async (ctx) => {
    const result = await authService.login(ctx.data, {
      ip: clientIp(ctx.request),
      userAgent: ctx.request.headers.get('user-agent') ?? undefined,
    })
    // 只回 user，token 仅经 httpOnly Cookie 下发（前端 JS 不可读）
    const response = ok({ user: result.user }, { traceId: ctx.traceId })
    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken })
    return response
  },
  { bodySchema: loginSchema, rateLimit: authRateLimitRule('login') },
)
