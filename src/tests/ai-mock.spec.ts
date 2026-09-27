/**
 * ai-mock.spec.ts — Mock Provider 结构化输出（T10 修复验证）：
 * jsonMode 下按能力返回的 canned JSON 必须能通过对应输出 Schema（否则整链降级）。
 */
import { describe, expect, it } from 'vitest'

import { guardStruct } from '@/services/ai/struct-guard'
import { DailyDiagnosisSchema } from '@/services/ai/schemas/daily-diagnosis'
import { GeneratedPlanSchema } from '@/services/ai/schemas/generated-plan'
import { WordExplainSchema } from '@/services/ai/schemas/word-explain'
import { WritingReportSchema } from '@/services/ai/schemas/writing-report'
import { MockProvider } from '@/services/ai/providers/mock'

async function collectJson(provider: MockProvider, systemPrompt: string): Promise<string> {
  const iterable = provider.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '【今日数据 JSON】{"minutesStudied":30}' },
    ],
    model: 'mock-1',
    temperature: 0.5,
    maxTokens: 1024,
    stream: false,
    jsonMode: true,
    timeoutMs: 5000,
    firstTokenTimeoutMs: 5000,
  })
  let raw = ''
  for await (const chunk of iterable) raw += chunk.text
  return raw
}

describe('MockProvider jsonMode（能力感知 canned JSON）', () => {
  const provider = new MockProvider()

  it('每日诊断：canned JSON 通过 DailyDiagnosisSchema（P0 修复验证）', async () => {
    const raw = await collectJson(provider, '你是「每日诊断」引擎。')
    const data = guardStruct(DailyDiagnosisSchema, raw)
    expect(data.insights.length).toBeGreaterThanOrEqual(1)
    expect(typeof data.tomorrowTip).toBe('string')
  })

  it('单词讲解：通过 WordExplainSchema', async () => {
    const raw = await collectJson(provider, '你是「单词深度讲解」引擎。')
    const data = guardStruct(WordExplainSchema, raw)
    expect((data.senses ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('作文批改：通过 WritingReportSchema', async () => {
    const raw = await collectJson(provider, '你是「作文批改」引擎。')
    const data = guardStruct(WritingReportSchema, raw)
    expect(data.totalScore).toBeGreaterThanOrEqual(0)
  })

  it('学习计划：通过 GeneratedPlanSchema', async () => {
    const raw = await collectJson(provider, '你是「学习计划生成」引擎。')
    const data = guardStruct(GeneratedPlanSchema, raw)
    expect(data.weeks.length).toBeGreaterThanOrEqual(1)
  })

  it('未知能力：仍返回可解析 JSON（outputSchema=null 的能力透传）', async () => {
    const raw = await collectJson(provider, '普通助手')
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe('DailyDiagnosisSchema 放宽（真实模型容错）', () => {
  it('缺 kind/tomorrowTip/cheer 时用默认值兜底', () => {
    const data = DailyDiagnosisSchema.parse({ insights: [{ text: '今天完成了任务' }] })
    expect(data.insights[0]?.kind).toBe('general')
    expect(data.tomorrowTip).toBe('明天继续保持学习节奏。')
    expect(data.cheer).toBe('加油！💪')
  })
})
