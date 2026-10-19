/**
 * 阅读模块 Zod schemas（T15，FE/BE 共享 —— 架构 §10.11 三方同源）。
 * 路由直接复用这些 schema 做 query/body 校验，前端复用同一份做表单校验。
 */
import { z } from 'zod'

import { cEFRLevelSchema, difficultySchema } from '@/types/enums'

/** R1 · GET /api/reading — 文章列表筛选 */
export const readingListQuerySchema = z.object({
  category: z.string().trim().min(1).max(64).optional(),
  difficulty: difficultySchema.optional(),
  cefr: cEFRLevelSchema.optional(),
  q: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

/** R3 · POST /api/reading/:id/quiz/submit — 提交阅读理解 */
export const readingQuizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(128),
        userAnswer: z.string().max(2000),
      }),
    )
    .min(1)
    .max(50),
  durationSec: z.number().int().min(0).max(86_400).optional(),
})

/** 断点续读 · POST /api/reading/:id/progress */
export const readingProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  lastBlockIndex: z.number().int().min(0).max(500).optional(),
  readSeconds: z.number().int().min(0).max(86_400).optional(),
})

/** 划词收藏 · POST /api/reading/:id/highlight */
export const readingHighlightSchema = z.object({
  word: z.string().trim().min(1).max(64),
  blockIndex: z.number().int().min(0).max(500),
})

/** R4 · POST /api/reading/:id/explain — AI 句子讲解 */
export const readingExplainSchema = z.object({
  sentence: z.string().trim().min(1).max(2000),
  blockIndex: z.number().int().min(0).max(500).optional(),
})

/** 划词直查 · GET /api/reading/word?word=xxx（词典直查，不调 AI） */
export const readingWordQuerySchema = z.object({
  word: z.string().trim().min(1).max(64),
})

export type ReadingListQuery = z.infer<typeof readingListQuerySchema>
export type ReadingQuizSubmit = z.infer<typeof readingQuizSubmitSchema>
export type ReadingProgress = z.infer<typeof readingProgressSchema>
export type ReadingHighlight = z.infer<typeof readingHighlightSchema>
export type ReadingExplain = z.infer<typeof readingExplainSchema>
export type ReadingWordQuery = z.infer<typeof readingWordQuerySchema>
