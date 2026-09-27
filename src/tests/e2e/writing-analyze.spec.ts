/**
 * E2E-6 writing-analyze：结构化 AI 输出链路。
 * 写作批改（writing-review）与每日诊断共用 struct-guard（extractJson → Zod → 降级），
 * 此处通过 /api/ai/diagnosis 验证「无外部 Key 时也必须返回可解析的结构化 JSON」。
 */
import { test, expect } from '@playwright/test'
import { BASE, apiOnboard, uniqueEmail } from './helpers'

test('structured ai output falls back gracefully without key', async ({ request }) => {
  const email = uniqueEmail('writing')
  await apiOnboard(request, email)

  const res = await request.post(`${BASE}/api/ai/diagnosis`, {
    headers: { Origin: BASE },
    data: {
      stats: {
        minutesStudied: 25,
        wordsLearned: 10,
        wordsReviewed: 8,
        accuracy: 0.72,
        tasksCompleted: 2,
        tasksTotal: 3,
      },
      streakDays: 3,
    },
  })
  expect(res.status()).toBeLessThan(400)

  const body = await res.json()
  expect(body.success).toBe(true)
  // Mock / 降级路径同样输出结构化数据（字符串或对象，由能力 schema 定形）
  expect(body.data).toBeTruthy()
})
