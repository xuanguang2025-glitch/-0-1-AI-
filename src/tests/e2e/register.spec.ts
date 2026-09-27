/**
 * E2E-1 register：注册表单 → 自动登录 → 跳 Onboarding。
 */
import { test, expect } from '@playwright/test'
import { uniqueEmail, STRONG_PASSWORD } from './helpers'

test('register → auto login → onboarding', async ({ page }) => {
  const email = uniqueEmail('reg')
  await page.goto('/register')

  await page.getByPlaceholder('怎么称呼你？').fill('E2E 注册员')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('至少 8 位，包含字母和数字').fill(STRONG_PASSWORD)

  await page.getByRole('button', { name: /注册|创建/ }).click()

  // 注册成功后服务端写入会话 Cookie，前端跳 onboarding
  await page.waitForURL(/onboarding|dashboard/, { timeout: 15_000 })
  await expect(page).toHaveURL(/onboarding|dashboard/)
})
