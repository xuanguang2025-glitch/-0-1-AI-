/**
 * 认证 Cookie 写入（架构 §1.4.2）：
 * - access_token：15min，httpOnly + SameSite=Lax，全站可读（服务端）
 * - refresh_token：30d，httpOnly + SameSite=Strict，路径限定 /api/auth/refresh
 */
import type { NextResponse } from 'next/server'

import { appConfig } from '@/lib/constants/config'

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'

export interface AuthCookiePayload {
  accessToken?: string
  refreshToken?: string
}

const ACCESS_MAX_AGE = appConfig.auth.accessTtlSeconds
const REFRESH_MAX_AGE = appConfig.auth.refreshTtlDays * 24 * 60 * 60

/** 在响应上写入（或清除 undefined 时）认证 Cookie */
export function setAuthCookies(response: NextResponse, payload: AuthCookiePayload): void {
  const secure = appConfig.app.isProd
  if (payload.accessToken) {
    response.cookies.set(ACCESS_COOKIE, payload.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: ACCESS_MAX_AGE,
      path: '/',
    })
  }
  if (payload.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, payload.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: REFRESH_MAX_AGE,
      path: '/api/auth/refresh',
    })
  }
}

/** 清除认证 Cookie（登出） */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' })
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'strict', maxAge: 0, path: '/api/auth/refresh' })
}
