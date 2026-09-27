/**
 * 前端 auth API 客户端：fetch 封装，解析 envelope，处理 401 静默刷新。
 * Cookie 由服务端 Set-Cookie（httpOnly），前端只拿 data。
 */
import type { ApiResponse } from '@/types/api'
import type { AuthUserDto, LoginResultDto, RegisterResultDto } from '@/types/dto/auth.dto'

/** envelope 解包：失败抛 ApiClientError（含 code/message） */
export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!body) throw new ApiClientError('SYS_INTERNAL', '响应解析失败', response.status)
  if (body.success && body.data !== null) return body.data
  const err = body.error
  throw new ApiClientError(err?.code ?? 'SYS_INTERNAL', err?.message ?? '请求失败', response.status, err?.details)
}

/** 全局 on401：由 AuthProvider 注入（跳转登录 / 静默刷新） */
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler()
  }
  return unwrap<T>(response)
}

export const authApi = {
  register: (input: { email: string; password: string; nickname: string }): Promise<RegisterResultDto> =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: { email: string; password: string }): Promise<LoginResultDto> =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),

  logout: (): Promise<null> =>
    request('/api/auth/logout', { method: 'POST' }),

  refresh: (): Promise<{ user: AuthUserDto } | null> =>
    request('/api/auth/refresh', { method: 'POST' }),

  me: (): Promise<AuthUserDto> =>
    request('/api/auth/me'),

  forgotPassword: (input: { email: string }): Promise<{ devHint: string | null }> =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(input) }),

  resetPassword: (input: { token: string; password: string }): Promise<{ revokedSessions: number }> =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(input) }),
}
