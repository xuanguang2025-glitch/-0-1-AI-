/**
 * E2E-11 grammar-exercise：语法学习主链路（T16）。
 *
 * 覆盖：目录（14 类树形）→ 主题详情（知识点/例句/易错）→ AI 讲解（Mock 时静态兜底）
 *       → 练习 5 题 → 提交 → 逐题解析 + 掌握度变化。
 * 前置：seed 已导入 14 类语法主题与 56 道题（`npm run db:seed`）。
 */
import { test, expect } from '@playwright/test'
import { apiOnboard, loginPage, uniqueEmail } from './helpers'

test.describe('语法学习主链路', () => {
  test('目录 → 主题详情 → 讲解 → 做 5 题 → 提交 → 看到解析', async ({ page }) => {
    const email = uniqueEmail('grammar')
    await apiOnboard(page.context().request, email)
    await loginPage(page, email)

    // ① 目录：14 类主题树
    await page.goto('/grammar')
    await expect(page.getByTestId('topic-tree')).toBeVisible({ timeout: 15_000 })
    const nodes = page.locator('[data-testid="topic-tree"] > li')
    expect(await nodes.count()).toBeGreaterThanOrEqual(14)

    // ② 选中第一个主题 → 详情面板（知识点/例句/易错对照）
    await nodes.first().click()
    await expect(page.getByTestId('topic-detail')).toBeVisible({ timeout: 15_000 })

    // ③ AI 讲解：Mock 时静态兜底（区块不消失，标注来源）
    await page.getByTestId('topic-explain-0').click()
    await expect(page.getByTestId('grammar-explain-panel')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('grammar-explain-text')).not.toBeEmpty()
    await expect(page.getByTestId('grammar-explain-source')).toHaveText(/AI 生成|静态知识点（AI 不可用）/)

    // ④ 进入练习页
    await page.goto('/grammar')
    await nodes.first().click()
    await page.getByTestId('goto-exercise').click()
    await expect(page).toHaveURL(/\/grammar\/.+\/exercise/, { timeout: 15_000 })
    await expect(page.getByTestId('exercise-runner')).toBeVisible({ timeout: 15_000 })

    // ⑤ 作答（每主题 seed 4 题；每题选 B —— seed 答案不恒定为 B，保证有对有错）
    const groups = page.locator('[data-testid="exercise-runner"] fieldset')
    const total = await groups.count()
    expect(total).toBeGreaterThanOrEqual(4)
    for (let i = 0; i < total; i += 1) {
      await groups.nth(i).locator('input[type="radio"]').first().check()
    }

    // ⑥ 提交 → 逐题解析 + 掌握度 + 错题本
    await page.getByTestId('exercise-submit').click()
    await expect(page.getByTestId('exercise-result')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('exercise-accuracy')).toBeVisible()
    await expect(page.getByTestId('exercise-answer-0')).toBeVisible()
    await expect(page.getByTestId('exercise-wrong-count')).toHaveText(/错题本 \+\d+/)
    // 验收 4：掌握度徽章出现（未练习 → 已练习）
    await expect(page.getByTestId('mastery-badge').first()).toBeVisible()

    // ⑦ 再练一轮 → 回到作答区
    await page.getByTestId('exercise-retry').click()
    await expect(page.getByTestId('exercise-runner')).toBeVisible({ timeout: 15_000 })
  })
})
