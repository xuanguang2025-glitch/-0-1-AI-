/**
 * Mock Provider：无任何 API Key 时的兜底实现（验收标准 #1）。
 * 流式按 ~40ms 分帧吐出 canned 文本；JSON Mode 返回可解析的 canned JSON。
 */
import { estimateCost } from '../pricing'
import type { AiProvider, ProviderChunk, ProviderRequest, ProviderUsage } from '../types'

const CANNED_TEXT = 'Hello! 我是 EnglishAI 的 Mock 学伴。这是一段用于本地联调与验收的兜底回复：在未配置任何模型 Key 时，我依然会陪你完成整条学习链路。Keep going!'

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
        const userPrompt = extractUserPrompt(req.messages)
        // 提取用户输入中的关键词回显，生成确定性的 canned JSON
        const keyword = userPrompt.slice(0, 40) || 'input'
        const canned = JSON.stringify({
          mock: true,
          echo: keyword,
          summary: '（Mock 兜底：未配置模型 Key，此为本地兜底结构化结果）',
        })
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
