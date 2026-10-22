/**
 * E2E-6 writing-analyze-real：写作批改主链路（T17）——**真实走
 * `POST /api/writing/:id/analyze`**，替换掉旧版误打 `/api/ai/diagnosis`
 * 的假覆盖（QA 核对发现旧 spec 根本不算写作批改测试）。
 *
 * 覆盖：任务列表 → 新建作文 → 编辑器输入（自动保存 + 规则检查实时更新）
 *       → 请求 AI 批改 → 报告页 scoreSource 徽章（验收 8）。
 *
 * Mock 环境：gateway 的 mock provider 对写作返回**合法罐头数据**（totalScore=9 +
 * 四维分，degraded=false），因此实际走 AI 轨；断言对两种轨自适应
 * （若上游改为恒降级则 rule 轨），核心验收点是「scoreSource 徽章真实 + 页面不空白」。
 * 前置：seed 已导入 30 个写作任务（`npm run db:seed`）。
 */
import { test, expect } from '@playwright/test'
import { FIRST_NAV, apiOnboard, loginPage, uniqueEmail } from './helpers'

/** 约 95 词的合规作文（含 however/therefore 两个连接词，规则分应较高） */
const ESSAY = `However, I always relax by reading books after a busy week. Reading helps me forget stress and sleep better at night. Therefore, I visit the library every Saturday and borrow two or three novels for the coming days. While some people prefer sports or parties, quiet reading suits my personality much better than loud activities. For example, last weekend I finished a short mystery book and felt refreshed on Monday morning. In addition, reading is cheap and easy to start anywhere. As a result, this hobby keeps my mind calm, improves my vocabulary, and gives me new ideas for school work every single week.`

test('写作批改主链路：新建 → 输入 → 自动保存 → 批改 → 报告 scoreSource 徽章', async ({ page }) => {
  const email = uniqueEmail('writing')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  // ① 任务列表
  await page.goto('/writing')
  await expect(page.getByTestId('writing-tasks')).toBeVisible({ timeout: FIRST_NAV })

  // ② 开始写作 → 创建占位稿 → 进入编辑器
  const firstTask = page.locator('[data-testid^="writing-start-"]').first()
  await firstTask.click()
  await expect(page).toHaveURL(/\/writing\/[a-z0-9]+$/i, { timeout: FIRST_NAV })

  // ③ 输入作文 → 规则检查面板更新（验收 3：边写边出提示）
  const editor = page.getByTestId('writing-content')
  await expect(editor).toBeVisible({ timeout: FIRST_NAV })

  // 防回归（QA 第八轮 P2）：先读面板**初值**，输入后断言分数改变——
  // 占位稿创建时面板就有值，只断言「可见」会空转
  const initialScore = (await page.getByTestId('rule-score').textContent()) ?? ''
  await editor.fill(ESSAY)
  await expect(page.getByTestId('word-count')).toContainText(/\d+ 词/, { timeout: 15_000 })
  await expect(page.getByTestId('inline-check-panel')).toBeVisible()

  // ④ 自动保存（验收 6：防抖 2.5s 后落库，指示器显示已保存）
  await expect(page.getByTestId('autosave-saved')).toBeVisible({ timeout: 15_000 })
  // 面板分数必须随最新保存实时变化（合规作文 + ≥2 连接词 → 无连接词扣分，分数应上升）
  await expect(page.getByTestId('rule-score')).not.toHaveText(initialScore, { timeout: 15_000 })

  // ⑤ 请求 AI 批改 → 跳转报告页
  await page.getByTestId('request-analyze').click()
  await expect(page).toHaveURL(/\/writing\/[a-z0-9]+\/report/i, { timeout: FIRST_NAV })

  // ⑥ 验收 8：scoreSource 徽章可见（分支自适应——本仓库 Mock provider 对写作返回
  //    合法罐头数据且 degraded=false（totalScore=9 + 四维分），因此实际会走 AI 轨；
  //    若上游某天改为恒降级则走 rule 轨。两种都是合法渲染，核心断言是「不空白」）
  await expect(page.getByTestId('report-header')).toBeVisible({ timeout: FIRST_NAV })
  const badge = page.getByTestId('score-source-badge')
  await expect(badge).toHaveText(/规则评分|AI 评分/)
  await expect(page.getByTestId('report-score')).toBeVisible()

  if ((await badge.textContent()) === 'AI 评分') {
    // AI 轨：雷达 + 逐句建议可见；规则区也并列展示
    await expect(page.getByTestId('score-radar')).toBeVisible()
    await expect(page.getByTestId('correction-list')).toBeVisible()
  } else {
    // rule 轨：降级说明 + 规则问题清单
    await expect(page.getByTestId('rule-mode-hint')).toBeVisible()
  }

  // 两种轨都渲染规则检查结果
  await expect(page.getByTestId('report-rule-issues')).toBeVisible()

  // ⑧ 回到列表：记录带 scoreSource 徽章（Mock 下 AI 轨 → 「AI 评分」）
  await page.goto('/writing')
  await expect(page.getByTestId('writing-submissions')).toBeVisible({ timeout: FIRST_NAV })
  await expect(page.getByText(/规则评分|AI 评分/).first()).toBeVisible()
})

test('字数不足提示（验收 7）：给出明确差额', async ({ page }) => {
  const email = uniqueEmail('writing-short')
  await apiOnboard(page.context().request, email)
  await loginPage(page, email)

  await page.goto('/writing')
  await expect(page.getByTestId('writing-tasks')).toBeVisible({ timeout: FIRST_NAV })
  await page.locator('[data-testid^="writing-start-"]').first().click()
  await expect(page.getByTestId('writing-content')).toBeVisible({ timeout: FIRST_NAV })

  // 只写 3 个词（任务要求 ≥80）→ 应显示「还差 N 词」
  await page.getByTestId('writing-content').fill('I read books.')
  const under = page.getByTestId('word-under')
  await expect(under).toBeVisible({ timeout: 15_000 })
  await expect(under).toContainText(/还差 \d+ 词/)
})
