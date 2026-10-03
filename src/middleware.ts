/**
 * middleware（架构 §1.4.2 + §7.6）：
 * ① traceId 生成透传；② Origin 校验（写方法）；③ PUBLIC/USER/ADMIN 粗筛；
 * ④ next-intl locale 路由（[locale] 段，as-needed 前缀）。
 * 真正的认证与 RBAC 在 withApi/withAuth 内二次校验。
 */
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { jwtVerify } from 'jose'

import { locales, routing } from '@/lib/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/placement',
  '/vocab',
  '/vocabulary',
  '/grammar',
  '/listening',
  '/reading',
  '/speaking',
  '/writing',
  '/about',
  '/dev',
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]

const ADMIN_PREFIXES = ['/admin', '/api/admin']

const encoder = new TextEncoder()

/**
 * JWT 粗筛密钥（QA P2 #15）。
 * 生产环境缺 `AUTH_JWT_SECRET` 时直接抛错阻断启动，避免回退到弱默认密钥；
 * 开发/测试环境保留 fallback。与 `src/lib/auth/jwt.ts` 的 resolveSecret 同口径。
 * 注意：middleware 里不能用 appConfig（会拖入 node-only 依赖），故直接读 env。
 */
const secret = (): Uint8Array => {
  const raw = process.env.AUTH_JWT_SECRET
  if (raw && raw.length >= 16) return encoder.encode(raw)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[middleware] AUTH_JWT_SECRET 未配置或长度不足 16 位，生产环境拒绝使用默认弱密钥。' +
        '请设置 `AUTH_JWT_SECRET=$(openssl rand -base64 48)` 后重启。',
    )
  }
  return encoder.encode('englishai-dev-secret-change-in-production')
}

/** 剥离 locale 前缀（/en/foo → /foo），供守卫匹配 */
function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return '/'
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
  }
  return pathname
}

function isPublic(stripped: string): boolean {
  if (stripped === '/' || stripped === '') return true // 落地页公开（T06 验收）
  return PUBLIC_PATHS.some((p) => p !== '' && (stripped === p || stripped.startsWith(`${p}/`)))
}

function isAdmin(stripped: string): boolean {
  return ADMIN_PREFIXES.some((p) => stripped === p || stripped.startsWith(`${p}/`))
}

function readCookie(request: NextRequest, name: string): string | undefined {
  return request.cookies.get(name)?.value
}

function jsonError(code: string, message: string, traceId: string, status: number): NextResponse {
  return NextResponse.json({ success: false, data: null, error: { code, message }, traceId }, { status })
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const traceId = crypto.randomUUID().replace(/-/g, '')

  // ---- 写方法 Origin 校验（CSRF 第一道）----
  const method = request.method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const origin = request.headers.get('origin')
    if (origin) {
      const allowed = new Set(
        [
          process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000',
          ...(process.env.NODE_ENV !== 'production'
            ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3100', 'http://localhost:3101', 'http://localhost:3102']
            : []),
        ],
      )
      if (!allowed.has(origin)) {
        if (pathname.startsWith('/api/')) return jsonError('PERM_FORBIDDEN', '跨站请求被拒绝', traceId, 403)
        return NextResponse.redirect(new URL('/403', request.url))
      }
    }
  }

  // ---- JWT 粗筛（API 路由 + intl 已处理的页面）----
  const stripped = stripLocale(pathname)
  const accessToken = readCookie(request, 'access_token')
  let authedRole: string | null = null
  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, secret(), {
        issuer: process.env.AUTH_JWT_ISSUER ?? 'englishai',
      })
      authedRole = typeof payload.role === 'string' ? payload.role : null
    } catch {
      authedRole = null // 过期/无效交给 withAuth 细判
    }
  }

  const isApi = pathname.startsWith('/api/')
  if (!isPublic(stripped) && !authedRole) {
    if (isApi) return jsonError('AUTH_TOKEN_MISSING', '请先登录', traceId, 401)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdmin(stripped) && authedRole !== 'ADMIN') {
    if (isApi) return jsonError('PERM_FORBIDDEN', '没有权限', traceId, 403)
    return NextResponse.redirect(new URL('/403', request.url))
  }

  // ---- API 路由：透传 traceId 直达 ----
  if (isApi) {
    const headers = new Headers(request.headers)
    headers.set('x-trace-id', traceId)
    const response = NextResponse.next({ request: { headers } })
    response.headers.set('x-trace-id', traceId)
    return response
  }

  // ---- 页面路由：交由 next-intl 处理 locale 协商 ----
  const response = intlMiddleware(request)
  response.headers.set('x-trace-id', traceId)
  return response
}

export const config = {
  matcher: [
    // 排除静态资源与 _next 内部
    '/((?!_next/static|_next/image|favicon.ico|icons|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|m4a)$).*)',
  ],
}
