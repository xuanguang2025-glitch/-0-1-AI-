/**
 * E2E-2 login：已注册用户 UI 登录 → Dashboard；未登录访问受保护页 → 跳 /login。
 */
import { test, expect } from '@playwright/test'
import { apiRegister, loginPage, uniqueEmail } from './helpers'

test('login via UI → dashboard', async ({ page }) => {
  const email = uniqueEmail('login')
  await apiRegister(page.context().request, email, 'E2E 登录员')

  // 带着会话访问受保护页前先登出（清除 API 注册产生的会话），用 UI 登录验证完整流程
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('你的密码').fill('Passw0rd!234')
  await page.getByRole('button', { name: /登录|登 录/ }).click()

  await page.waitForURL(/dashboard|onboarding/, { timeout: 15_000 })
})

test('unauthenticated protected page redirects to /login', async ({ page }) => {
  await page.context().clearCookies()
  const res = await page.goto('/dashboard')
  // 中间件 307 → /login?next=/dashboard（浏览器最终停在 login 页）
  await page.waitForURL(/\/login/, { timeout: 10_000 })
  expect(res?.status() ?? 200).toBeLessThan(400)
  void loginPage
})
