/**
 * E2E-4 submit-exercise：Placement 答题 API 全链路（开考 → 逐题落答案 → 交卷评分）。
 */
import { test, expect } from '@playwright/test'
import { BASE, apiOnboard, uniqueEmail } from './helpers'

test('placement exercise submit → real scoring', async ({ request }) => {
  const email = uniqueEmail('exercise')
  await apiOnboard(request, email)

  // 开考
  const startRes = await request.post(`${BASE}/api/placement`, {
    headers: { Origin: BASE },
    data: {},
  })
  const start = await startRes.json()
  expect(start.success).toBe(true)
  const testId = start.data.testId as string

  // 取题（不含答案）
  const qRes = await request.get(`${BASE}/api/placement/${testId}/questions`)
  const questions = (await qRes.json()).data.questions as Array<{
    id: string
    options: unknown
  }>
  expect(questions.length).toBeGreaterThan(0)

  // 逐题作答（前 10 题，确保与 UI 行为一致：answer 接口逐题落库）
  for (const q of questions.slice(0, 10)) {
    const options = q.options as string[]
    const ansRes = await request.post(`${BASE}/api/placement/${testId}/answer`, {
      headers: { Origin: BASE },
      data: { questionId: q.id, userAnswer: options[0] ?? 'A', responseMs: 5000 },
    })
    expect((await ansRes.json()).success).toBe(true)
  }

  // 交卷 → 规则评分 + CEFR + CET 估算
  const subRes = await request.post(`${BASE}/api/placement/${testId}/submit`, {
    headers: { Origin: BASE },
    data: {},
  })
  const sub = await subRes.json()
  expect(sub.success).toBe(true)
  expect(sub.data.scores.overall).toBeGreaterThanOrEqual(0)
  expect(sub.data.cefr).toMatch(/^[A-C][12]$/)
  expect(sub.data.cet.cet4).toBeGreaterThan(0)
})
