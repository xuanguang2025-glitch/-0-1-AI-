/**
 * Placement Zod schemas。
 */
import { z } from 'zod'

export const answerSchema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.string().min(1, '请选择答案').max(200),
  responseMs: z.number().int().min(0).max(600_000),
})

export type AnswerInput = z.infer<typeof answerSchema>

/** 报告分数结构 */
export interface PlacementScoresDto {
  vocabulary: number
  grammar: number
  reading: number
  listening: number
  overall: number
}
