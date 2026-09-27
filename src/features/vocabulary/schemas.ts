/**
 * 词汇模块 Zod schemas（T08，FE/BE 共享）。
 */
import { z } from 'zod'

/** GET /api/vocabulary/today */
export const todayQuerySchema = z.object({
  book: z.string().min(1).max(64).optional(),
})

/** GET /api/vocabulary/search */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

/** POST /api/vocabulary/learn */
export const learnBodySchema = z.object({
  vocabularyId: z.string().min(1).max(64),
})

/** POST /api/vocabulary/review */
export const reviewBodySchema = z.object({
  userVocabId: z.string().min(1).max(64),
  /** SM-2 自评 0-5 */
  rating: z.number().int().min(0).max(5),
  /** 本题作答耗时（毫秒），用于 EF 调整与平均反应时长 */
  responseMs: z.number().int().min(0).max(600_000),
  /** 幂等键（推荐 uuid），重复提交返回首次结果 */
  idempotencyKey: z.string().min(8).max(64).optional(),
})

/** POST /api/vocabulary/notebook（切换收藏状态） */
export const notebookBodySchema = z.object({
  userVocabId: z.string().min(1).max(64),
})

/** GET /api/vocabulary/records & /api/analytics/history 复用分页 */
export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

/** GET /api/analytics/trend */
export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
})

/** GET /api/analytics/calendar */
export const calendarQuerySchema = z.object({
  days: z.coerce.number().int().min(30).max(366).optional(),
})

export type TodayQuery = z.infer<typeof todayQuerySchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type LearnBody = z.infer<typeof learnBodySchema>
export type ReviewBody = z.infer<typeof reviewBodySchema>
export type NotebookBody = z.infer<typeof notebookBodySchema>
export type RecordsQuery = z.infer<typeof recordsQuerySchema>
export type TrendQuery = z.infer<typeof trendQuerySchema>
export type CalendarQuery = z.infer<typeof calendarQuerySchema>
