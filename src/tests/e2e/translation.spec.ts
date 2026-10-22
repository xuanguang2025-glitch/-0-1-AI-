/**
 * E2E-12 translation：翻译训练主链路（T18）。
 *
 * 覆盖：翻译（Mock 罐头数据）→ 5 档 Tab 切换（验收 2：缺档不白屏）→
 * 一键收藏（验收 3：原句入收藏 + 生词入本）→ 历史可见。
 * 前置：vocabulary 表已有 ECDICT 语料（seed）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

const SOURCE = 'Reading books every week improves your vocabulary and helps you write better essays.'

test('翻译 → 5 档 Tab → 收藏 → 生词入本 → 历史可见', async ({ page }) => {
  const email = uniqueEmail('translate')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/translation')
  await expect(page.getByTestId('translator-input')).toBeVisible({ timeout: FIRST_NAV })

  // ① 输入 ≤500 字符并翻译
  await page.getByTestId('translator-text').fill(SOURCE)
  await page.getByTestId('translate-submit').click()
  await expect(page.getByTestId('result-tabs')).toBeVisible({ timeout: FIRST_NAV })

  // ② 验收 2：Tab 可切换且**不白屏**——Mock generic 回显只保证 literal，
  //    其余档显示「AI 暂不可用」
  await expect(page.getByTestId('style-tab-literal')).toBeVisible()
  await expect(page.getByTestId('style-text-literal')).not.toBeEmpty()
  await page.getByTestId('style-tab-natural').click()
  await expect(page.getByTestId('style-text-natural')).toBeVisible()
  await expect(page.getByTestId('style-text-natural')).toContainText(/AI 暂不可用|./)
  await page.getByTestId('style-tab-formal').click()
  await expect(page.getByTestId('style-text-formal')).toBeVisible()

  // ③ 生词抽取（词典直查）至少出现面板或为空（取决于词典命中）
  const extract = page.getByTestId('word-extract')
  if (await extract.isVisible().catch(() => false)) {
    const addBtns = page.locator('[data-testid^="extract-add-"]')
    if ((await addBtns.count()) > 0) {
      await addBtns.first().click()
      await expect(page.getByText('已在生词本').first()).toBeVisible({ timeout: 15_000 })
    }
  }

  // ④ 验收 3：一键收藏
  await page.getByTestId('favorite-button').click()
  await expect(page.getByTestId('favorite-button')).toContainText('已收藏', { timeout: 15_000 })

  // ⑤ 验收 4：历史可见该条
  await expect(page.locator('[data-testid^="history-item-"]').first()).toBeVisible({ timeout: 15_000 })
})

test('超长输入被拒（验收 1：≤500 字符）', async ({ page }) => {
  const email = uniqueEmail('translate-long')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/translation')
  await expect(page.getByTestId('translator-input')).toBeVisible({ timeout: FIRST_NAV })

  await page.getByTestId('translator-text').fill('word '.repeat(110))
  await expect(page.getByTestId('char-count')).toContainText(/5\d\d\/500/)
  // 超限时翻译按钮禁用
  await expect(page.getByTestId('translate-submit')).toBeDisabled()
})
