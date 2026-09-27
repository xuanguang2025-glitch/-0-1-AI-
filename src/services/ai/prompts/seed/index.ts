/**
 * Prompt seed 聚合：prompt-registry 的本地兜底源（DB ai_prompts 永远优先）。
 */
import { WORD_EXPLAIN_PROMPT } from './word-explain'
import { WRITING_REVIEW_PROMPT } from './writing-review'
import { TUTOR_CHAT_PROMPT } from './tutor-chat'
import { PLAN_GENERATE_PROMPT } from './plan-generate'
import { DAILY_DIAGNOSIS_PROMPT } from './daily-diagnosis'

export interface SeedPrompt {
  key: string
  version: number
  title: string
  systemPrompt: string
  userTemplate: string
  variables: ReadonlyArray<{ name: string; required: boolean; description: string }>
}

const SEED_PROMPTS: Record<string, SeedPrompt> = {
  WORD_EXPLAIN: WORD_EXPLAIN_PROMPT,
  WRITING_REVIEW: WRITING_REVIEW_PROMPT,
  TUTOR_CHAT: TUTOR_CHAT_PROMPT,
  PLAN_GENERATE: PLAN_GENERATE_PROMPT,
  DAILY_DIAGNOSIS: DAILY_DIAGNOSIS_PROMPT,
}

/** 取能力对应的 seed prompt；未知能力返回 null（上层抛 AI_STRUCT_INVALID 前先降级） */
export function getSeedPrompt(key: string): SeedPrompt | null {
  return SEED_PROMPTS[key] ?? null
}
