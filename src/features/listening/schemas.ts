/**
 * 听力模块 Zod schemas（T13/T14，FE/BE 共享 —— 架构 §10.11 三方同源）。
 * 路由直接复用这些 schema 做 query/body 校验，前端复用同一份做表单校验。
 */
import { z } from 'zod'

import { listeningModeSchema } from '@/types/enums'

/** L1 · GET /api/listening — 材料列表筛选 */
export const listeningListQuerySchema = z.object({
  category: z.string().trim().min(1).max(64).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  cefr: z.string().trim().min(1).max(8).optional(),
  intensity: z.coerce.number().int().min(1).max(4).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

/** L3 · GET /api/listening/:id/questions — 按模式取题 */
export const listeningQuestionsQuerySchema = z.object({
  mode: listeningModeSchema,
})

/** L4 · POST /api/listening/:id/attempts — 提交训练结果 */
export const listeningAttemptBodySchema = z.object({
  mode: listeningModeSchema,
  answers: z
    .array(z.object({ questionId: z.string().min(1).max(128), userAnswer: z.string().max(2000) }))
    .max(200)
    .optional(),
  durationSec: z.number().int().min(0).max(86_400).optional(),
  unknownWords: z
    .array(z.object({ word: z.string().trim().min(1).max(64), meaning: z.string().max(200).optional() }))
    .max(200)
    .optional(),
  dictationText: z.string().max(20_000).optional(),
  playbackRate: z.number().min(0.5).max(2).optional(),
})

/** L7 · POST /api/listening/progress — 保存播放进度 */
export const listeningProgressBodySchema = z.object({
  materialId: z.string().min(1).max(64),
  positionSec: z.number().int().min(0).max(86_400),
  playbackRate: z.number().min(0.5).max(2).optional(),
  completed: z.boolean().optional(),
})

/** L8 · POST /api/listening/dictation-check — 听写比对（纯本地 diff） */
export const dictationCheckBodySchema = z.object({
  original: z.string().min(1).max(20_000),
  dictation: z.string().max(20_000),
})

export type ListeningListQuery = z.infer<typeof listeningListQuerySchema>
export type ListeningQuestionsQuery = z.infer<typeof listeningQuestionsQuerySchema>
export type ListeningAttemptBody = z.infer<typeof listeningAttemptBodySchema>
export type ListeningProgressBody = z.infer<typeof listeningProgressBodySchema>
export type DictationCheckBody = z.infer<typeof dictationCheckBodySchema>
