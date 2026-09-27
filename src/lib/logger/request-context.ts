/**
 * 请求上下文（架构 §1.4.5）：AsyncLocalStorage 透传 traceId/userId。
 * middleware 生成 traceId → handler 注入 → service/logger/AI gateway 全程可读。
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
  traceId: string
  userId?: string
  role?: string
  ip?: string
}

/** Next.js 推荐全局单例（dev 热重载下不丢失） */
const globalForContext = globalThis as unknown as { __requestContext?: AsyncLocalStorage<RequestContext> }

export const requestContext: AsyncLocalStorage<RequestContext> =
  globalForContext.__requestContext ?? new AsyncLocalStorage<RequestContext>()

if (process.env.NODE_ENV !== 'production') {
  globalForContext.__requestContext = requestContext
}

/** 在上下文内执行回调 */
export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(ctx, fn)
}

/** 取当前上下文（无上下文时返回 null） */
export function getRequestContext(): RequestContext | null {
  return requestContext.getStore() ?? null
}

/** 取当前 traceId（无上下文时现场生成，兜底） */
export function currentTraceId(): string {
  return requestContext.getStore()?.traceId ?? crypto.randomUUID().replace(/-/g, '')
}

/** 取当前 userId（未登录返回 null） */
export function currentUserId(): string | null {
  return requestContext.getStore()?.userId ?? null
}
