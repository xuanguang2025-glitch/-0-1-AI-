/**
 * POST /api/auth/logout — 登出（公开亦可调用：幂等）。
 * 撤销当前 refresh 会话并清除 Cookie。
 */
import { withApi, ok } from '@/lib/api/handler'
import { clearAuthCookies, REFRESH_COOKIE } from '@/lib/auth/cookies'
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
    await authService.logout(readCookie(ctx.request, REFRESH_COOKIE))
    const response = ok(null, { traceId: ctx.traceId })
    clearAuthCookies(response)
    return response
  },
)
