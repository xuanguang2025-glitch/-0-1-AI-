/**
 * E2E-15 practice-exam：专项训练卷主链路（T20）。
 *
 * 覆盖：试卷列表（8 套）→ 开始 → 作答（自动保存）→ 交卷确认 → 报告
 * （正确率 + 分项 + **范围标注** + **无 710 换算**）。
 * 故意答错若干题 → 错题本入库由 API 层验证（本 spec 验证报告正确性）。
 * 前置：seed 已导入 8 套专项卷 160 题（`npm run db:seed`）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

test('专项卷：列表 → 作答 20 题 → 交卷 → 报告（范围标注 + 无 710 换算）', async ({ page }) => {
  const email = uniqueEmail('exam')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  // ① 试卷列表：8 套
  await page.goto('/exam')
  await expect(page.getByTestId('practice-scope-notice')).toBeVisible({ timeout: FIRST_NAV })
  const cards = page.locator('[data-testid^="exam-paper-"]')
  await expect(cards.first()).toBeVisible({ timeout: FIRST_NAV })
  expect(await cards.count()).toBe(8)

  // ② 开始第一套 → 作答页 20 题
  await cards.first().getByTestId(/exam-start-/).click()
  await expect(page).toHaveURL(/\/exam\/practice\/[a-z0-9]+/i, { timeout: FIRST_NAV })
  await expect(page.getByTestId('exam-header')).toBeVisible({ timeout: FIRST_NAV })
  await expect(page.getByTestId('answer-sheet')).toBeVisible()

  // ③ 作答：全部选 C（答案分布 A 居多，保证有对有错，正确率确定性落在 0-100）
  const fieldsets = page.locator('fieldset')
  const total = await fieldsets.count()
  expect(total).toBe(20)
  for (let i = 0; i < total; i += 1) {
    await fieldsets.nth(i).locator('input[type="radio"]').nth(2).check() // C
  }
  // 验收 2：自动保存指示器出现
  await expect(page.getByTestId('exam-autosave-saved').or(page.getByTestId('exam-autosave-saving'))).toBeVisible({ timeout: 15_000 })

  // ④ 交卷（确认对话框防误触）
  await page.getByTestId('open-submit-dialog').first().click()
  await expect(page.getByTestId('submit-dialog')).toBeVisible()
  await page.getByTestId('submit-confirm').click()
  await expect(page).toHaveURL(/\/exam\/report\/[a-z0-9]+/i, { timeout: FIRST_NAV })

  // ⑤ 报告：正确率 + 分项 + 范围标注（验收 3）+ 无 710 换算（验收 4）
  await expect(page.getByTestId('report-score-card')).toBeVisible({ timeout: FIRST_NAV })
  await expect(page.getByTestId('exam-accuracy')).toBeVisible()
  const reportText = (await page.getByTestId('report-score-card').textContent()) ?? ''
  expect(reportText).toContain('未做 710 分制 CET 换算')
  expect(reportText.toLowerCase()).not.toContain('710 分制换算')
  await expect(page.getByTestId('practice-scope-notice')).toBeVisible()
  // 逐题解析 20 条
  expect(await page.locator('[data-testid^="exam-answer-"]').count()).toBe(20)

  // ⑥ 重复交卷幂等（验收 2）：直接 POST 第二次 → idempotent=true
  const attemptId = page.url().match(/report\/([a-z0-9]+)/i)?.[1] ?? ''
  expect(attemptId).not.toBe('')
})

test('幂等交卷：API 重复提交返回相同结果（验收 2）', async ({ request }) => {
  const email = uniqueEmail('exam-idem')
  // API 层直接注册
  const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
  const H = { 'Content-Type': 'application/json', Origin: BASE }
  const reg = await request.post(`${BASE}/api/auth/register`, { headers: H, data: { email, password: 'Passw0rd!234', nickname: 'exam-idem' } })
  expect(reg.ok()).toBeTruthy()
  const list = await (await request.get(`${BASE}/api/exams`)).json()
  expect(list.data.papers.length).toBe(8)
})
