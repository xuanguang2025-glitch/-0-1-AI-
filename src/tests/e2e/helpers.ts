/**
 * E2E 公共工具（T10）：API 注册/登录 + 会话注入 + CSRF Origin。
 *
 * 核心机制：Playwright 中 `page.context().request` 与页面共享 Cookie Jar，
 * 因此「先 API 登录 → 再 page.goto」即可完成免 UI 的鉴权前置。
 */
import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

/**
 * 首航/新路由首个断言的超时。
 *
 * Next dev 下每个路由**首次**被访问都要现场编译（冷编译链可吃掉 10-20s），
 * Playwright 自带新 dev server 时 15s 预算经常不够 → 假红（QA 第六轮实测：
 * 同一用例热服务器 20.3s 全过、冷服务器卡在首个 15s 断言）。
 * 页面内的后续断言保持默认 5s / 15s 即可。
 */
export const FIRST_NAV = 45_000

/** 每次 run 唯一的测试邮箱，避免唯一约束冲突 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.test`
}

export const STRONG_PASSWORD = 'Passw0rd!234'

const CSRF_HEADERS = { 'Content-Type': 'application/json', Origin: BASE }

/** API 注册（自动登录态写入 cookie jar）；返回 userId */
export async function apiRegister(
  request: APIRequestContext,
  email: string,
  nickname = 'E2E 用户'
): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/register`, {
    headers: CSRF_HEADERS,
    data: { email, password: STRONG_PASSWORD, nickname },
  })
  const body = await res.json()
  expect(body.success, `register failed: ${JSON.stringify(body)}`).toBe(true)
  return body.data.user.id as string
}

/** API 登录（写入 cookie jar） */
export async function apiLogin(request: APIRequestContext, email: string): Promise<void> {
  const res = await request.post(`${BASE}/api/auth/login`, {
    headers: CSRF_HEADERS,
    data: { email, password: STRONG_PASSWORD },
  })
  const body = await res.json()
  expect(body.success, `login failed: ${JSON.stringify(body)}`).toBe(true)
}

/** 注册 + Onboarding 完成（进入可学习状态） */
export async function apiOnboard(request: APIRequestContext, email: string): Promise<void> {
  await apiRegister(request, email)
  const res = await request.post(`${BASE}/api/onboarding`, {
    headers: CSRF_HEADERS,
    data: {
      steps: {
        goal: 'exam',
        level: 'elementary',
        dailyTime: 30,
        weeklyDays: 5,
        targetExam: 'CET4',
        targetDate: '2026-12-31',
        weakest: ['vocabulary'],
        style: 'scenario',
      },
    },
  })
  const body = await res.json()
  expect(body.success, `onboarding failed: ${JSON.stringify(body)}`).toBe(true)
}

/** 页面级登录前置：API 登录后即可直接 page.goto 受保护路由 */
export async function loginPage(page: Page, email: string): Promise<void> {
  await apiLogin(page.context().request, email)
}
