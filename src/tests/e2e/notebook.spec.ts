/**
 * E2E-13 notebook：错题本闭环（team-lead 增补项）。
 *
 * 覆盖：阅读 quiz 做错一题（seed 答案恒为 A → 故意选 B）→ 错题本可见该题 →
 * 标记已掌握 → 状态变化（验收：错题本新增记录 + 复习闭环）。
 * 前置：seed 已导入 60 篇阅读文章（`npm run db:seed`）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

test('做错阅读题 → 错题本可见 → 标记已掌握 → 状态变化', async ({ page }) => {
  const email = uniqueEmail('notebook')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  // ① 做错一题：阅读 quiz 故意选 B（seed 答案恒为 A）
  await page.goto('/reading')
  await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: FIRST_NAV })
  const cards = page.locator('[data-testid="reading-list"] > div')
  await cards.first().getByRole('link', { name: /开始阅读|继续阅读/ }).click()
  await expect(page.getByTestId('quiz-area')).toBeVisible({ timeout: FIRST_NAV })
  await page.locator('input[type="radio"][value="B"]').first().check()
  await page.getByTestId('quiz-submit').click()
  await expect(page.getByTestId('quiz-result')).toBeVisible({ timeout: 20_000 })

  // ② 错题本可见该题（来源=阅读，待复习）
  await page.goto('/notebook')
  await expect(page.getByTestId('wrong-question-list')).toBeVisible({ timeout: FIRST_NAV })
  const item = page.locator('[data-testid^="wrong-item-"]').first()
  await expect(item).toBeVisible()
  await expect(page.getByTestId('source-reading')).toBeVisible()
  await expect(item.getByTestId(/^wrong-pending-/)).toBeVisible()

  // ③ 标记第一条已掌握 → 切到「已掌握」筛选，该题出现且徽章变化
  // （阅读 quiz 表单提交全部 2 题 → 错题本有 2 条待复习；标记 1 条后
  //   「待复习」列表仍有剩余，不能断言 wrong-empty）
  await item.getByTestId(/^wrong-master-/).click()
  await page.getByTestId('filter-mastered').click()
  const masteredItem = page.locator('[data-testid^="wrong-item-"]').first()
  await expect(masteredItem).toBeVisible({ timeout: 15_000 })
  await expect(masteredItem.getByTestId(/^wrong-mastered-/)).toBeVisible()

  // ④ 回到待复习：剩余错题仍在（另一题未标记）
  await page.getByTestId('filter-pending').click()
  await expect(page.locator('[data-testid^="wrong-item-"]').first()).toBeVisible({ timeout: 15_000 })
})
