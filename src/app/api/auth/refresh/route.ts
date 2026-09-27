/**
 * POST /api/auth/refresh — 静默刷新（公开接口；Cookie 路径限定本路由）。
 * 轮换 refresh token；重放检测：旧 token 复用 → 整族撤销（401 AUTH_SESSION_REVOKED）。
 */
import { withApi, ok } from '@/lib/api/handler'
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '@/lib/auth/cookies'
import { clientIp } from '@/lib/auth/rate-limit'
import * as authService from '@/services/auth.service'

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export const POST = withApi(
  async (ctx) => {
    const token = readCookie(ctx.request, REFRESH_COOKIE)
    if (!token) {
      // 无 refresh token：清 Cookie 并要求重新登录
      const response = ok(null, { traceId: ctx.traceId })
      clearAuthCookies(response)
      return response
    }
    const result = await authService.refresh(token, {
      ip: clientIp(ctx.request),
      userAgent: ctx.request.headers.get('user-agent') ?? undefined,
    })
    const response = ok({ user: result.user }, { traceId: ctx.traceId })
    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken })
    return response
  },
)
