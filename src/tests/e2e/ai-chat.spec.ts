/**
 * E2E-5 ai-chat：AI 陪练对话（Mock Provider 兜底，SSE 首帧可读）。
 */
import { test, expect } from '@playwright/test'
import { BASE, apiOnboard, uniqueEmail } from './helpers'

test('ai chat SSE stream responds without external API key', async ({ request }) => {
  const email = uniqueEmail('chat')
  await apiOnboard(request, email)

  const res = await request.post(`${BASE}/api/ai/chat`, {
    headers: { Origin: BASE, Accept: 'text/event-stream' },
    data: { message: '帮我用 "temporary" 造个句子', conversationId: null },
  })
  expect(res.status()).toBeLessThan(400)

  const raw = await res.text()
  // SSE 帧格式：event: X\ndata: {...}\n\n（Mock Provider 也必须产出合法帧）
  expect(raw).toContain('data:')
  expect(raw.length).toBeGreaterThan(10)
})
