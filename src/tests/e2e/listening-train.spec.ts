/**
 * E2E-9 listening-train：听力训练主链路（T14 验收）。
 *
 * 覆盖：列表（L1）→ 精听页（L2：音频/字幕/换档时间基准）→ 训练页（L3 取题 + L4 提交）
 *       → 报告页（L5）。
 *
 * 前置：seed 已导入 60 篇听力材料（`npm run db:seed`）。
 * 说明：36/60 篇有 TTS 音频，无音频的材料页面会给出明确提示而非白屏。
 * 2026-10-14 实跑通过（2/2，dev + PG 本地）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

test.describe('听力训练主链路', () => {
  test('列表 → 精听页：音频、字幕、换档后时间基准跟随', async ({ page }) => {
    const email = uniqueEmail('listen')
    await apiOnboard(page.context().request, email)
    await loginPage(page, email)

    // ① 列表：seed 60 篇必然非空；带「AI 合成语音」诚实标注
    await page.goto('/listening')
    await expect(page.getByTestId('listening-list')).toBeVisible({ timeout: FIRST_NAV })
    await expect(page.getByText('AI 合成语音（Phase 2）').first()).toBeVisible()
    const cards = page.locator('[data-testid="listening-list"] > div')
    expect(await cards.count()).toBeGreaterThan(0)

    // ② 进入精听页
    await cards.first().getByRole('link', { name: '精听' }).click()
    await expect(page).toHaveURL(/\/listening\/player\/.+/, { timeout: 15_000 })

    // 音频元素与字幕（首篇为 L1，seed 保证有字幕）
    await expect(page.getByTestId('listening-audio')).toBeAttached()
    await expect(page.getByTestId('transcript-line-0')).toBeVisible({ timeout: FIRST_NAV })
    await expect(page.getByText('1× 时间基准')).toBeVisible()

    // ③ 点击字幕 → seek（时间显示不再是 0:00 之前的初始态）
    await page.getByTestId('transcript-line-0').click()

    // ④ 换档：时间基准徽标跟随倍速（R2-9）
    await page.getByTestId('listening-rate').selectOption('0.75')
    await expect(page.getByText('0.75× 时间基准')).toBeVisible()

    // ⑤ 进训练页
    await page.getByRole('link', { name: '去训练' }).click()
    await expect(page).toHaveURL(/\/listening\/training\/.+/, { timeout: 15_000 })
  })

  test('训练页：选择题作答 → 服务端判分 → 报告页', async ({ page }) => {
    const email = uniqueEmail('train')
    await apiOnboard(page.context().request, email)
    await loginPage(page, email)

    await page.goto('/listening')
    await expect(page.getByTestId('listening-list')).toBeVisible({ timeout: FIRST_NAV })
    const cards = page.locator('[data-testid="listening-list"] > div')
    await cards.first().getByRole('link', { name: '训练' }).click()
    await expect(page).toHaveURL(/\/listening\/training\/.+/, { timeout: 15_000 })

    // 模式切换：默认泛听 → 选择
    await expect(page.getByTestId('mode-extensive')).toBeVisible()
    await page.getByTestId('mode-choice').click()
    await expect(page.getByTestId('mode-choice')).toHaveAttribute('aria-selected', 'true')

    // 作答：选第一个选项（题目由 seed 保证存在）
    const firstOption = page.locator('input[type="radio"]').first()
    await expect(firstOption).toBeVisible({ timeout: FIRST_NAV })
    await firstOption.check()

    // 提交 → 跳报告页（L4 判分在服务端）
    await page.getByTestId('answer-submit').click()
    await expect(page).toHaveURL(/\/listening\/report\/.+/, { timeout: 20_000 })

    // 报告：正确率 + 逐题作答 + AI 分析入口
    await expect(page.getByTestId('trainer-report')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('report-accuracy')).toBeVisible()
    await expect(page.getByTestId('report-analyze')).toBeVisible()

    // 生成分析：AI 不可用时回落规则分析并标注来源
    await page.getByTestId('report-analyze').click()
    await expect(page.getByTestId('report-analysis')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/AI 分析|规则分析（AI 不可用）/)).toBeVisible()
  })
})
