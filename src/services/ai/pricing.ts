/**
 * 厂商单价表（架构 §4.5）：单位 分/1k tokens；可后台覆盖。
 * 价格为 2026 初中国市场常见价的粗估，仅用于成本报表。
 */

export interface ModelPrice {
  /** 输入：分 / 1k tokens */
  input: number
  /** 输出：分 / 1k tokens */
  output: number
}

/** key = providerKey:model（小写），未命中用 default */
const PRICE_TABLE: Record<string, ModelPrice> = {
  'deepseek:deepseek-chat': { input: 0.02, output: 0.06 },
  'zhipu:glm-4-flash': { input: 0.01, output: 0.01 },
  'zhipu:glm-4-plus': { input: 0.35, output: 0.35 },
  'openai:gpt-4o-mini': { input: 1.1, output: 4.4 },
  'ollama:*': { input: 0, output: 0 },
  'mock:*': { input: 0, output: 0 },
  default: { input: 0.05, output: 0.15 },
}

export function getModelPrice(providerKey: string, model: string): ModelPrice {
  const exact = PRICE_TABLE[`${providerKey}:${model.toLowerCase()}`]
  if (exact) return exact
  const wildcard = PRICE_TABLE[`${providerKey}:*`]
  if (wildcard) return wildcard
  return PRICE_TABLE.default ?? { input: 0.05, output: 0.15 }
}

/** 成本估算（单位：分） */
export function estimateCost(providerKey: string, model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const price = getModelPrice(providerKey, model)
  const cents = (usage.inputTokens / 1000) * price.input + (usage.outputTokens / 1000) * price.output
  return Math.max(0, Math.round(cents))
}
