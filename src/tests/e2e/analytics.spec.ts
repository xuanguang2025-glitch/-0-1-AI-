/**
 * E2E-8 analytics：统计 API（trend/overview/calendar）+ Dashboard 数据渲染。
 */
import { test, expect } from '@playwright/test'
import { BASE, apiOnboard, loginPage, uniqueEmail } from './helpers'

test('analytics endpoints return zero-filled data', async ({ request }) => {
  const email = uniqueEmail('analytics')
  await apiOnboard(request, email)

  const trend = await (await request.get(`${BASE}/api/analytics/trend?days=7`)).json()
  expect(trend.success).toBe(true)
  expect(trend.data).toHaveLength(7)
  expect(trend.data[0]).toHaveProperty('date')

  const overview = await (await request.get(`${BASE}/api/analytics`)).json()
  expect(overview.success).toBe(true)
  expect(overview.data.total).toHaveProperty('wordsLearned')

  const calendar = await (await request.get(`${BASE}/api/analytics/calendar?days=30`)).json()
  expect(calendar.success).toBe(true)
  expect(calendar.data).toHaveLength(30)
})

test('dashboard renders stat blocks for authed user', async ({ page }) => {
  const email = uniqueEmail('dash')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/dashboard')
  // 9 模块聚合中的关键模块：问候/今日进度/任务
  await expect(page.getByText(/今日|你好|Hello/i).first()).toBeVisible({ timeout: 15_000 })
})
