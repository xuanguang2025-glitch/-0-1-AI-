/**
 * AI 输出 Schema 注册表：AiPrompt.outputSchema 字符串 → Zod Schema。
 * struct-guard 依此校验 AI 输出。
 */
import { GeneratedPlanSchema } from './generated-plan'
import { DailyDiagnosisSchema } from './daily-diagnosis'
import { WordExplainSchema } from './word-explain'
import { WritingReportSchema } from './writing-report'
import type { ZodType } from 'zod'

export const OUTPUT_SCHEMAS: Record<string, ZodType> = {
  WordExplain: WordExplainSchema,
  WritingReport: WritingReportSchema,
  DailyDiagnosis: DailyDiagnosisSchema,
  GeneratedPlan: GeneratedPlanSchema,
}

export function getOutputSchema(name: string | null | undefined): ZodType | null {
  if (!name) return null
  return OUTPUT_SCHEMAS[name] ?? null
}
