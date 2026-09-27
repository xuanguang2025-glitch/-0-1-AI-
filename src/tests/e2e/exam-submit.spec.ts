/**
 * E2E-7 exam-submit：UI 走完 Placement（开始测试 → 答题 → 交卷 → 报告页）。
 */
import { test, expect } from '@playwright/test'
import { apiOnboard, loginPage, uniqueEmail } from './helpers'

test('placement UI flow → report page', async ({ page }) => {
  const email = uniqueEmail('exam')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/placement')
  await page.getByRole('button', { name: '开始测试' }).click()

  // 等题目渲染（30 题 seed 保证非空）
  await expect(page.getByRole('button', { name: '交卷并生成报告' })).toBeVisible({
    timeout: 20_000,
  })

  // 答前 5 题：选项为 role=radio（radiogroup 内），点击后自动前进
  const radioGroup = page.getByRole('radiogroup', { name: '选项' })
  for (let i = 0; i < 5; i += 1) {
    await radioGroup.getByRole('radio').first().click()
    await page.waitForTimeout(400)
  }

  await page.getByRole('button', { name: '交卷并生成报告' }).click()
  await page.waitForURL(/placement\/report\//, { timeout: 20_000 })
  await expect(page.getByText(/CEFR|预计|分数|报告/).first()).toBeVisible()
})
