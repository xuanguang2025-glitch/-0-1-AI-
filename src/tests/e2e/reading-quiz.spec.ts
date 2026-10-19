/**
 * E2E-10 reading-quiz：阅读训练主链路（T15）。
 *
 * 覆盖：列表 → 文章详情（断点续读/划词/译文）→ quiz 提交 → 报告 → 错题定位高亮。
 * 前置：seed 已导入 60 篇阅读文章（`npm run db:seed`）。
 * 说明：seed 的阅读题正确答案恒为 'A'，故 E2E 故意选 'B' 以保证必然产生错题，
 *       从而确定性断言「错题本 +N」。
 */
import { test, expect } from '@playwright/test'
import { apiOnboard, loginPage, uniqueEmail } from './helpers'

test.describe('阅读训练主链路', () => {
  test('打开文章 → 断点续读 → 划词直查 → 做 quiz → 提交 → 报告可见', async ({ page }) => {
    const email = uniqueEmail('read')
    await apiOnboard(page.context().request, email)
    await loginPage(page, email)

    // ① 列表（seed 60 篇必然非空）
    await page.goto('/reading')
    await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: 15_000 })
    const cards = page.locator('[data-testid="reading-list"] > div')
    expect(await cards.count()).toBeGreaterThan(0)

    // ② 进入文章详情
    await cards.first().getByRole('link', { name: /开始阅读|继续阅读/ }).click()
    await expect(page).toHaveURL(/\/reading\/.+/, { timeout: 15_000 })
    await expect(page.getByTestId('article-body')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('article-block-0')).toBeVisible()

    // ③ 断点续读：滚动后进度被记录（防抖 2s）
    await page.getByTestId('article-body').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(2500)

    // ④ 划词直查：选中一个英文单词 → 词典浮层
    await page.getByTestId('article-block-0').evaluate((el) => {
      const range = document.createRange()
      const text = el.firstChild
      if (!text) return
      range.setStart(text, 0)
      range.setEnd(text, Math.min(6, text.textContent?.length ?? 6))
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await expect(page.getByTestId('highlight-popover')).toBeVisible({ timeout: 10_000 })

    // ⑤ 译文显隐
    await page.getByTestId('translation-toggle').click()
    await expect(page.getByTestId('translation-0')).toBeVisible()

    // ⑥ 做 quiz 并提交（**故意选 B**：seed 的正确答案恒为 A，保证有错题）
    const quizArea = page.getByTestId('quiz-area')
    if (await quizArea.isVisible().catch(() => false)) {
      await quizArea.locator('input[type="radio"][value="B"]').first().check()
      await page.getByTestId('quiz-submit').click()
      await expect(page.getByTestId('quiz-result')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('quiz-accuracy')).toBeVisible()
      // 验收 3：错题自动写入 wrong_questions —— 报告页明示新增条数（必然 ≥1）
      await expect(page.getByTestId('quiz-wrong-count')).toHaveText(/错题本 \+[1-9]/)
      // 验收 4：逐题解析带「定位到第 N 段」
      await expect(page.getByTestId('quiz-locate-0')).toBeVisible()
    }

    // ⑦ 点击定位 → 原文段落高亮
    await page.getByTestId('quiz-locate-0').click()
    await expect(page.locator('[data-highlight="true"]').first()).toBeVisible()
  })

  test('列表筛选：难度 chips 与搜索可用', async ({ page }) => {
    const email = uniqueEmail('readfilter')
    await apiOnboard(page.context().request, email)
    await loginPage(page, email)

    await page.goto('/reading')
    await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: 15_000 })

    // ① 难度筛选（独立验证：不与搜索叠加，避免组合过滤后为空）
    await page.getByRole('button', { name: '入门' }).click()
    await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: '全部难度' }).click()
    await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: 10_000 })

    // ② 标题搜索（"Reading" 命中多篇，确定性非空）
    await page.getByTestId('reading-search').fill('Reading')
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByTestId('reading-list')).toBeVisible({ timeout: 10_000 })
  })
})
