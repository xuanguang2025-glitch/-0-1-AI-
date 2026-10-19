/**
 * 语法模块 Zod schemas（T16，FE/BE 共享 —— 架构 §10.11 三方同源）。
 */
import { z } from 'zod'

/** G3 · GET /api/grammar/:id/exercise — 取练习题 */
export const grammarExerciseQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(20).optional(),
})

/** G4 · POST /api/grammar/:id/exercise/submit — 提交练习 */
export const grammarExerciseSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(128),
        userAnswer: z.string().max(2000),
      }),
    )
    .min(1)
    .max(20),
  durationSec: z.number().int().min(0).max(86_400).optional(),
})

/** G5 · POST /api/grammar/:id/explain — AI 知识点讲解（带静态兜底） */
export const grammarExplainSchema = z.object({
  /** 可选：指定要讲解的知识点标题；缺省用主题描述 */
  pointTitle: z.string().trim().min(1).max(200).optional(),
})

export type GrammarExerciseQuery = z.infer<typeof grammarExerciseQuerySchema>
export type GrammarExerciseSubmit = z.infer<typeof grammarExerciseSubmitSchema>
export type GrammarExplain = z.infer<typeof grammarExplainSchema>
