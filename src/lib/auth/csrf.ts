/**
 * CSRF（架构 §1.4.8）：SameSite Cookie 之上的 Origin/Referer 白名单校验。
 * 仅对"写方法"校验；GET/HEAD/OPTIONS 豁免。
 */
import { appConfig } from '@/lib/constants/config'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** 允许的 Origin 集合：NEXT_PUBLIC_APP_ORIGIN + localhost 常见端口（开发环境） */
function allowedOrigins(): Set<string> {
  const set = new Set<string>([appConfig.app.origin])
  if (!appConfig.app.isProd) {
    set.add('http://localhost:3000')
    set.add('http://127.0.0.1:3000')
  }
  return set
}

/** 请求是否需要 CSRF 校验 */
export function requiresCsrfCheck(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}

/**
 * 校验 Origin/Referer 是否同源；失败返回 false（调用方转 403 PERM_FORBIDDEN）。
 * 无 Origin 且无 Referer 的写请求视为非法（浏览器跨站一定会带其一）。
 */
export function verifyCsrf(request: Request): boolean {
  if (!requiresCsrfCheck(request.method)) return true
  const allowed = allowedOrigins()
  const origin = request.headers.get('origin')
  if (origin) return allowed.has(origin)
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin)
    } catch {
      return false
    }
  }
  return false
}
