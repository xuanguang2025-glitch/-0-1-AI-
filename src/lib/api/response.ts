/**
 * 响应构造器（架构 §3.1）：ok / fail 的唯一出口。
 * Route Handler 返回 NextResponse.json(envelope, { status })。
 */
import { NextResponse } from 'next/server'

import type { ApiAiMeta, ApiError, ApiMeta, ApiResponse } from '@/types/api'
import { ERROR_MESSAGES, statusForCode } from './errors'

/** 生成 traceId：无外部依赖的 128bit 随机 hex */
export function genTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function ok<T>(data: T, options?: { meta?: ApiMeta; ai?: ApiAiMeta; traceId?: string; status?: number }): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    ...(options?.meta ? { meta: options.meta } : {}),
    ...(options?.ai ? { ai: options.ai } : {}),
    traceId: options?.traceId ?? genTraceId(),
  }
  return NextResponse.json(body, { status: options?.status ?? 200 })
}

export function created<T>(data: T, options?: { traceId?: string }): NextResponse<ApiResponse<T>> {
  return ok(data, { ...options, status: 201 })
}

export function fail(
  code: string,
  options?: { message?: string; details?: unknown; traceId?: string; status?: number },
): NextResponse<ApiResponse<never>> {
  const error: ApiError = {
    code,
    message: options?.message ?? ERROR_MESSAGES[code] ?? code,
    ...(options?.details !== undefined ? { details: options.details } : {}),
  }
  const body: ApiResponse<never> = {
    success: false,
    data: null,
    error,
    traceId: options?.traceId ?? genTraceId(),
  }
  return NextResponse.json(body, { status: options?.status ?? statusForCode(code) })
}
