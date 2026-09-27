/**
 * AI Gateway 类型签名（架构 §4.1）。
 * 所有 AI 能力必须经 AiGateway 单一入口；service 不感知 HTTP。
 */

export type AiCapabilityKey =
  | 'WORD_EXPLAIN' | 'WRITING_REVIEW' | 'SPEAKING_SCORE' | 'PRONUNCIATION_ANALYZE'
  | 'READING_EXPLAIN' | 'GRAMMAR_EXPLAIN' | 'PLAN_GENERATE' | 'PLAN_ADJUST'
  | 'DAILY_DIAGNOSIS' | 'TUTOR_CHAT' | 'TRANSLATE' | 'LISTENING_ANALYZE'
  | 'MISTAKE_CLASSIFY' | 'READING_QUIZ_GENERATE' | 'WORD_SCENARIO'
  | 'RECOMMEND' | 'EXAM_ESSAY_SCORE' | 'CET_ADVICE'

export interface AiRunContext {
  userId: string
  traceId: string
  locale: 'zh-CN' | 'en'
  userLevel?: string
  preferStream?: boolean
  signal?: AbortSignal
}

export interface AiResult<T> {
  data: T
  /** true = 走了兜底 */
  degraded: boolean
  degradedReason?: string
  provider?: string
  model?: string
  promptVersion?: number
  tokensUsed: number
  latencyMs: number
  cacheHit: boolean
}

// ---------- Provider Adapter ----------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ProviderRequest {
  messages: ChatMessage[]
  model: string
  temperature: number
  maxTokens: number
  stream: boolean
  /** JSON Mode 提示，Adapter 翻译成目标厂商协议 */
  jsonMode?: boolean
  timeoutMs: number
  firstTokenTimeoutMs?: number
  signal?: AbortSignal
}

export interface ProviderChunk {
  text: string
  finishReason?: 'stop' | 'length' | null
}

export interface ProviderUsage {
  inputTokens: number
  outputTokens: number
}

export interface AiProvider {
  readonly key: string
  readonly displayName: string
  healthCheck(): Promise<boolean>
  complete(req: ProviderRequest): AsyncIterable<ProviderChunk> & { usage(): Promise<ProviderUsage> }
  estimateCost(usage: ProviderUsage, model: string): number
}

// ---------- Gateway 状态 ----------

export interface AiCapabilityStatus {
  enabled: boolean
  healthy: boolean
  quotaLeft: number
}
