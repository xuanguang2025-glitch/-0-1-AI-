/**
 * 翻译模块 Zod schemas（T18，FE/BE 共享）。
 */
import { z } from 'zod'

import { MAX_SOURCE_LEN } from '@/services/translation.service'

/** T1 · POST /api/translation/translate */
export const translateSchema = z.object({
  text: z.string().trim().min(1).max(MAX_SOURCE_LEN),
  direction: z.enum(['zh2en', 'en2zh']),
})

/** T2 · POST /api/translation/save */
export const translationSaveSchema = z.object({
  recordId: z.string().min(1).max(64).optional(),
  addWords: z.boolean().optional(),
})

/** T3 · GET /api/translation/history */
export const translationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  /** 'true' / 'false' 字符串（query 无布尔类型）；路由层转 boolean */
  favoriteOnly: z.enum(['true', 'false']).optional(),
})

/** 生词抽取 · GET /api/translation/words?text=... */
export const translationWordsQuerySchema = z.object({
  text: z.string().trim().min(1).max(MAX_SOURCE_LEN),
})

/** 生词入本 · POST /api/translation/words */
export const translationAddWordSchema = z.object({
  vocabularyId: z.string().min(1).max(64),
})

export type TranslateInput = z.infer<typeof translateSchema>
export type TranslationSaveInput = z.infer<typeof translationSaveSchema>
/** 查询的**输出**类型（favoriteOnly 已被 transform 成 boolean） */
export type TranslationHistoryQuery = z.output<typeof translationHistoryQuerySchema>
export type TranslationAddWordInput = z.infer<typeof translationAddWordSchema>
