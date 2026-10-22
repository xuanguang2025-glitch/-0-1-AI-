/**
 * E2E-14 speaking-session：口语对话主链路（T19）。
 *
 * **走文本降级路径**：Playwright chromium 不支持 SpeechRecognition——
 * 正好实测验收 5（自动降级文本输入，`wasTextInput=true`，评分链路仍通）。
 * 覆盖：目录（11×9）→ 选角色场景 → 文本对话 3 轮（SSE 流式回复）→ 结束 →
 * 报告（scoreSource='rule' 徽章 + S6 统计 + **无"发音"维度**）。
 * 前置：seed 已导入 11 角色 + 9 场景（`npm run db:seed`）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

test('选角色场景 → 文本模式对话 3 轮 → 结束 → 报告可见（验收 4/5/6/8）', async ({ page }) => {
  const email = uniqueEmail('speaking')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)
  // 验收 5：Chromium 带 webkitSpeechRecognition 构造器（运行时才失败）——
  // 显式删除以确定性实测「不支持 → 文本降级」路径（Firefox/Safari 用户即此路径）
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.webkitSpeechRecognition
    delete w.SpeechRecognition
  })

  // ① 目录
  await page.goto('/speaking')
  await expect(page.getByTestId('role-picker')).toBeVisible({ timeout: FIRST_NAV })
  // 验收 1：11 角色 × 9 场景
  expect(await page.locator('[data-testid^="role-picker-"]').count()).toBe(11)
  expect(await page.getByTestId('scene-picker').locator('button').count()).toBe(9)

  // ② 选角色 + 场景 → 开始
  await page.getByTestId('role-picker').locator('button').first().click()
  await page.getByTestId('scene-picker').locator('button').first().click()
  await page.getByTestId('start-session').click()
  await expect(page).toHaveURL(/\/speaking\/partner\/[a-z0-9]+/i, { timeout: FIRST_NAV })

  // 验收 5：Playwright 无 SpeechRecognition → 文本降级提示 + 无「开始说话」按钮
  await expect(page.getByText(/已切换为文本输入模式/)).toBeVisible({ timeout: FIRST_NAV })
  await expect(page.getByTestId('start-speaking')).toHaveCount(0)

  // ③ 文本对话 3 轮（SSE 流式回复）
  const thread = page.getByTestId('chat-thread')
  await expect(thread).toBeVisible({ timeout: FIRST_NAV })
  for (let turn = 1; turn <= 3; turn += 1) {
    await page.getByTestId('chat-input').fill(`Hello, this is practice turn number ${turn}.`)
    await page.getByTestId('chat-send').click()
    // 等本条用户消息渲染 + AI 回复到达（气泡计数：欢迎语 1 + 用户 N + AI N）
    await expect
      .poll(async () => thread.locator('[data-speaker="USER"]').count(), { timeout: 20_000 })
      .toBe(turn)
    await expect
      .poll(async () => thread.locator('[data-speaker="AI"]').count(), { timeout: 20_000 })
      .toBe(turn + 1) // 欢迎语 1 条 + AI 回复 turn 条
  }

  // ④ 结束 → 报告页
  await page.getByTestId('end-session').click()
  await expect(page).toHaveURL(/\/speaking\/report\/[a-z0-9]+/i, { timeout: FIRST_NAV })
  await expect(page.getByTestId('speaking-report-header')).toBeVisible({ timeout: FIRST_NAV })

  // 验收 6：Mock → scoreSource='rule' 徽章；S6 统计可见（wpm 真实数字）
  await expect(page.getByTestId('speaking-report-header')).toContainText('规则评分')
  await expect(page.getByTestId('rule-stats-panel')).toBeVisible()
  await expect(page.getByTestId('rule-stats-panel')).toContainText(/wpm/)

  // 验收 6：**无"发音"维度**——雷达只有 4 维（语法/词汇/流利度/自然度）
  const radarText = (await page.getByTestId('speaking-score-radar').textContent()) ?? ''
  expect(radarText).toContain('语法')
  expect(radarText).not.toContain('发音')
})
