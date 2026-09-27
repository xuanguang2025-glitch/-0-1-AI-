/**
 * OpenAI 兼容协议 Adapter（DeepSeek/GLM/OpenAI/Ollama 均兼容 /chat/completions 协议）。
 * 支持：非流式 + SSE 流式（首 token 超时看护）。
 */
import { estimateCost } from '../pricing'
import type { AiProvider, ProviderChunk, ProviderRequest, ProviderUsage } from '../types'

export interface OpenAICompatibleConfig {
  key: string
  displayName: string
  baseUrl: string
  apiKey: string
  defaultModel: string
}

interface SsePayload {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/** 解析 SSE data: 行（跨 chunk 缓冲，处理 data: [DONE]） */
async function* sseLines(response: Response, signal?: AbortSignal): AsyncGenerator<SsePayload> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data) as SsePayload
        } catch {
          /* 跳过不完整帧 */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export class OpenAICompatibleProvider implements AiProvider {
  readonly key: string
  readonly displayName: string

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.key = config.key
    this.displayName = config.displayName
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok || res.status === 404 // 某些本地端点无 /models 也算健康
    } catch {
      return false
    }
  }

  /**
   * complete：流式/非流式统一出口。
   * 非流式：单 chunk + usage。
   * 流式：逐 chunk；usage 在 finish 时由最后一帧（stream_options.include_usage）或估算补齐。
   */
  complete(req: ProviderRequest): AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- 类方法内 async generator 需捕获实例
    const self = this
    const controller = new AbortController()
    req.signal?.addEventListener('abort', () => controller.abort(), { once: true })

    let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 }
    let usageResolve: ((u: ProviderUsage) => void) | null = null
    const usagePromise = new Promise<ProviderUsage>((resolve) => {
      usageResolve = resolve
    })

    async function* iterate(): AsyncGenerator<ProviderChunk> {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (self.config.apiKey) headers.Authorization = `Bearer ${self.config.apiKey}`

        const res = await fetch(`${self.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: req.model || self.config.defaultModel,
            messages: req.messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens,
            stream: req.stream,
            ...(req.stream ? { stream_options: { include_usage: true } } : {}),
            ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
          // 非流式整体超时；流式由首 token 看护
          ...(req.stream ? {} : { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(req.timeoutMs)]) }),
        })

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`provider HTTP ${res.status}: ${body.slice(0, 200)}`)
        }

        if (!req.stream) {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
          const text = json.choices?.[0]?.message?.content ?? ''
          usage = {
            inputTokens: json.usage?.prompt_tokens ?? 0,
            outputTokens: json.usage?.completion_tokens ?? 0,
          }
          usageResolve?.(usage)
          yield { text, finishReason: 'stop' }
          return
        }

        // ---- 流式 ----
        let firstTokenSeen = false
        const firstTokenMs = req.firstTokenTimeoutMs ?? 3000
        const firstTokenTimer = setTimeout(() => {
          if (!firstTokenSeen) controller.abort()
        }, firstTokenMs)

        try {
          for await (const payload of sseLines(res, controller.signal)) {
            if (payload.usage) {
              usage = {
                inputTokens: payload.usage.prompt_tokens ?? 0,
                outputTokens: payload.usage.completion_tokens ?? 0,
              }
            }
            const delta = payload.choices?.[0]?.delta?.content
            const finish = payload.choices?.[0]?.finish_reason
            if (delta) {
              firstTokenSeen = true
              clearTimeout(firstTokenTimer)
              yield { text: delta, finishReason: finish === 'stop' ? 'stop' : finish === 'length' ? 'length' : null }
            } else if (finish) {
              yield { text: '', finishReason: finish === 'stop' ? 'stop' : 'length' }
            }
          }
        } finally {
          clearTimeout(firstTokenTimer)
        }
      } finally {
        usageResolve?.(usage)
      }
    }

    const iterator = iterate()
    const iterable = {
      [Symbol.asyncIterator]: () => iterator,
      usage: () => usagePromise,
    }
    return iterable as AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> }
  }

  estimateCost(usage: ProviderUsage, model: string): number {
    return estimateCost(this.key, model, usage)
  }
}
