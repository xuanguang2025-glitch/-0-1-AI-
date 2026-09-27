/**
 * Route Handler 包装器（架构 §1.4.1-1.4.3）：
 * withApi  = envelope + 错误捕获 + 限流 + Zod 校验 + CSRF + 请求上下文
 * withAuth = withAuth ≡ withApi({ auth: true, roles? })，二次 JWT 校验 + RBAC
 * 禁止裸 NextResponse.json。
 */
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import { AppError } from './errors'
import { fail, ok, genTraceId, created } from './response'
import { hitRateLimit, clientIp } from '@/lib/auth/rate-limit'
import { verifyCsrf } from '@/lib/auth/csrf'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { hasRole } from '@/lib/auth/rbac'
import { appConfig } from '@/lib/constants/config'
import { withRequestContext } from '@/lib/logger/request-context'
import { createLogger } from '@/lib/logger/logger'
import { readJson, parseWith } from './zod'
import { parsePage, type PageParams } from './pagination'

const log = createLogger('api.handler')

export interface AuthedContext {
  userId: string
  role: string
  familyId: string
}

export interface ApiContext<Q, B> {
  request: Request
  params: Record<string, string>
  query: URLSearchParams
  /** Zod 解析后的 query（schema 提供时） */
  searchParams: URLSearchParams
  page: PageParams
  /** Zod 解析后的 body（schema 提供时） */
  data: B
  /** Zod 解析后的 query 对象（schema 提供时） */
  queryData: Q
  /** 已认证用户信息（auth: true 时必有） */
  auth?: AuthedContext
  traceId: string
}

export interface ApiOptions<Q, B> {
  /** 需要登录（默认 false） */
  auth?: boolean
  /** 需要的角色（auth:true 时生效，满足任一即可） */
  roles?: readonly string[]
  /** body 校验 schema */
  bodySchema?: ZodType<B>
  /** query 校验 schema */
  querySchema?: ZodType<Q>
  /** 限流规则 key 前缀 + 规则 */
  rateLimit?: { key?: string; limit: number; windowMs: number }
}

type Handler<Q, B> = (ctx: ApiContext<Q, B>) => Promise<NextResponse>

/** 从 cookie 头解析 token（Edge 兼容，不依赖 next/headers） */
function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/** 统一包装：所有 /api route 的唯一入口 */
export function withApi<Q = unknown, B = unknown>(
  handler: Handler<Q, B>,
  options: ApiOptions<Q, B> = {},
): (request: Request, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (request, routeContext) => {
    const traceId = request.headers.get('x-trace-id') ?? genTraceId()
    const startedAt = Date.now()

    const run = async (): Promise<NextResponse> => {
      try {
        // ---- 限流 ----
        if (options.rateLimit) {
          const ip = clientIp(request)
          const url = new URL(request.url)
          const key = `${options.rateLimit.key ?? url.pathname}:${ip}`
          const result = await hitRateLimit(key, {
            limit: options.rateLimit.limit,
            windowMs: options.rateLimit.windowMs,
          })
          if (!result.allowed) {
            return fail('SYS_RATE_LIMIT', {
              traceId,
              message: `请求过于频繁，请 ${Math.ceil(result.retryAfterMs / 1000)} 秒后重试`,
            })
          }
        }

        // ---- CSRF（写方法校验 Origin/Referer）----
        if (!verifyCsrf(request)) {
          return fail('PERM_FORBIDDEN', { traceId, message: '跨站请求被拒绝' })
        }

        // ---- 认证（二次 JWT 校验）----
        let auth: AuthedContext | undefined
        if (options.auth) {
          const token = readCookie(request, 'access_token')
          if (!token) return fail('AUTH_TOKEN_MISSING', { traceId })
          const payload = await verifyAccessToken(token) // 失效内部抛 AppError
          auth = { userId: payload.sub, role: payload.role, familyId: payload.fid }
          if (options.roles && !hasRole(auth.role, options.roles)) {
            return fail('PERM_FORBIDDEN', { traceId })
          }
        }

        // ---- Zod 校验 ----
        const url = new URL(request.url)
        const searchParams = url.searchParams
        const bodySchema = options.bodySchema as ZodType<B> | undefined
        const querySchema = options.querySchema as ZodType<Q> | undefined
        const data = bodySchema && request.method !== 'GET' ? parseWith(bodySchema, await readJson(request)) : (undefined as B)
        const queryData = querySchema ? parseWith(querySchema, Object.fromEntries(searchParams)) : (undefined as Q)

        const params = routeContext?.params ? await routeContext.params : {}

        const ctx: ApiContext<Q, B> = {
          request,
          params,
          query: searchParams,
          searchParams,
          page: parsePage(searchParams),
          data,
          queryData,
          auth,
          traceId,
        }

        return await handler(ctx)
      } catch (e) {
        if (e instanceof AppError) {
          if (e.httpStatus >= 500) log.error({ traceId, msg: e.message, err: e })
          return fail(e.code, { message: e.message, details: e.details, traceId, status: e.httpStatus })
        }
        const err = e instanceof Error ? e : new Error(String(e))
        log.error({ traceId, msg: 'unhandled route error', err })
        return fail('SYS_INTERNAL', {
          traceId,
          // 生产环境不回传堆栈细节
          message: appConfig.app.isProd ? undefined : err.message,
        })
      }
    }

    // 请求上下文内执行，service/logger 可读 traceId/userId
    const response = await withRequestContext({ traceId, ip: clientIp(request) }, run)
    response.headers.set('x-trace-id', traceId)
    log.debug({ traceId, msg: `${request.method} ${new URL(request.url).pathname}`, durationMs: Date.now() - startedAt })
    return response
  }
}

/** 便捷别名：需登录接口 */
export function withAuth<Q = unknown, B = unknown>(
  handler: Handler<Q, B>,
  options: Omit<ApiOptions<Q, B>, 'auth'> = {},
): (request: Request, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return withApi(handler, { ...options, auth: true })
}

export { ok, fail, genTraceId, created }
