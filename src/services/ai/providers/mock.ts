/**
 * Mock Provider：无任何 API Key 时的兜底实现（验收标准 #1）。
 * 流式按 ~40ms 分帧吐出 canned 文本；JSON Mode 返回可解析的 canned JSON。
 */
import { estimateCost } from '../pricing'
import type { AiProvider, ProviderChunk, ProviderRequest, ProviderUsage } from '../types'

const CANNED_TEXT = 'Hello! 我是 EnglishAI 的 Mock 学伴。这是一段用于本地联调与验收的兜底回复：在未配置任何模型 Key 时，我依然会陪你完成整条学习链路。Keep going!'

/**
 * 按 systemPrompt 能力关键词返回符合对应输出 Schema 的 canned JSON。
 * 关键字与 prisma/seed/seed-ai.ts 的 CAPABILITY_TITLES 保持一致；
 * 未识别的能力返回通用 mock 结构（outputSchema=null 的能力不做结构校验，可安全通过）。
 */
function cannedJsonForCapability(systemPrompt: string, userPrompt: string): string {
  const echo = userPrompt.slice(0, 40) || 'input'
  if (systemPrompt.includes('每日诊断')) {
    return JSON.stringify({
      insights: [
        { kind: 'progress', text: '（Mock 兜底）今日学习数据已记录，保持节奏就很好。' },
        { kind: 'suggestion', text: '建议明天优先完成待复习单词，再学 5 个新词。' },
      ],
      tomorrowTip: '（Mock 兜底）明天先复习后学新词，效率更高。',
      cheer: '加油！💪',
    })
  }
  if (systemPrompt.includes('单词深度讲解') || systemPrompt.includes('单词情景')) {
    return JSON.stringify({
      word: echo,
      phoneticUk: '/mɒk/',
      phoneticUs: '/mɑːk/',
      senses: [{ pos: 'n.', zh: '（Mock 兜底）本地联调用释义。', en: 'A canned explanation for local testing.' }],
      rootAffix: null,
      mnemonic: '（Mock 兜底）联想记忆：mock ≈ “模（mock）型”。',
      examples: [{ en: 'This is a mock example.', zh: '这是一个模拟例句。' }],
      collocations: ['mock exam'],
    })
  }
  if (systemPrompt.includes('作文批改') || systemPrompt.includes('真题作文评分')) {
    return JSON.stringify({
      totalScore: 9,
      dimensions: { content: 3, organisation: 3, language: 2, accuracy: 1 },
      overallComment: '（Mock 兜底）结构完整，语言表达可再提升。',
      sentences: [{ original: echo, corrected: null, issue: '（Mock 兜底）示例句。' }],
      modelEssay: null,
    })
  }
  if (systemPrompt.includes('学习计划')) {
    return JSON.stringify({
      summary: '（Mock 兜底）两周基础巩固计划。',
      weeks: [
        {
          week: 1,
          focus: '词汇积累',
          tasks: [{ type: 'vocab', title: '每日 10 个新词', minutes: 20, detail: null }],
        },
      ],
      tips: ['坚持每日打卡'],
    })
  }
  return JSON.stringify({ mock: true, echo, summary: '（Mock 兜底：未配置模型 Key，此为本地兜底结构化结果）' })
}

/** 汉字/单词计数估算 tokens（mock 下够用） */
function estimateTokens(text: string): ProviderUsage {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const words = (text.match(/[a-zA-Z]+/g) ?? []).length
  return { inputTokens: Math.max(1, words + cjk), outputTokens: Math.max(1, words + cjk) }
}

function extractUserPrompt(messages: { role: string; content: string }[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  return lastUser?.content ?? ''
}

export class MockProvider implements AiProvider {
  readonly key = 'mock'
  readonly displayName = 'Mock (No API Key)'

  async healthCheck(): Promise<boolean> {
    return true
  }

  complete(req: ProviderRequest): AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- 类方法内 async generator 需捕获实例
    const self = this
    async function* iterate(): AsyncGenerator<ProviderChunk> {
      if (req.jsonMode) {
        const systemPrompt = req.messages.find((m) => m.role === 'system')?.content ?? ''
        const userPrompt = extractUserPrompt(req.messages)
        const canned = cannedJsonForCapability(systemPrompt, userPrompt)
        // JSON 也要按帧吐，验证前端分帧解析
        for (let i = 0; i < canned.length; i += 24) {
          if (req.signal?.aborted) return
          await sleep(10)
          yield { text: canned.slice(i, i + 24), finishReason: null }
        }
        yield { text: '', finishReason: 'stop' }
        return
      }

      const frames = CANNED_TEXT.match(/.{1,6}/g) ?? [CANNED_TEXT]
      for (const frame of frames) {
        if (req.signal?.aborted) return
        await sleep(40)
        yield { text: frame, finishReason: null }
      }
      yield { text: '', finishReason: 'stop' }
    }

    async function collectUsage(input: string): Promise<ProviderUsage> {
      return estimateTokens(input + CANNED_TEXT)
    }

    let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 }
    const inputText = req.messages.map((m) => m.content).join('\n')

    const iterator = iterate()
    const iterable = {
      [Symbol.asyncIterator]: () => iterator,
      usage: async () => {
        if (usage.inputTokens === 0) usage = await collectUsage(inputText)
        return usage
      },
    }
    // 避免未使用告警
    void self
    return iterable as AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> }
  }

  estimateCost(usage: ProviderUsage, model: string): number {
    return estimateCost(this.key, model, usage)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
