/**
 * E2E-3 word-learn：学词页加载今日词 → 显示释义 → 标记学会 → 下一张。
 */
import { test, expect } from '@playwright/test'
import { apiOnboard, loginPage, uniqueEmail } from './helpers'

test('learn a word end-to-end', async ({ page }) => {
  const email = uniqueEmail('learn')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/vocabulary/learn')

  // 今日词队列（CET-4 核心词库 seed 后必然非空）
  const card = page.locator('h1')
  await expect(card.first()).toBeVisible({ timeout: 15_000 })

  // 释义先隐藏 → 点开
  await page.getByRole('button', { name: '点击显示释义' }).click()
  await expect(page.getByText(/n\.|v\.|adj\.|a\./).first()).toBeVisible()

  // 标记学会 → 前进到下一张（或完成态）
  await page.getByRole('button', { name: /学会了，下一个/ }).click()
  await expect(
    page.getByText(/\d+ \/ \d+|本次学了|今日暂无新词/).first()
  ).toBeVisible({ timeout: 10_000 })
})
