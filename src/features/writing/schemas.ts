/**
 * 听力式共享 Zod schemas：写作模块（T17，FE/BE 共享 —— 架构 §10.11 三方同源）。
 */
import { z } from 'zod'

import { difficultySchema, examTypeSchema } from '@/types/enums'

/** W1 · GET /api/writing/tasks — 任务列表筛选 */
export const writingTaskQuerySchema = z.object({
  taskType: z.string().trim().min(1).max(32).optional(),
  difficulty: difficultySchema.optional(),
  examType: examTypeSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

/** W2 · POST /api/writing/submissions — 新建作文（同步返回 ruleCheck） */
export const writingCreateSchema = z.object({
  taskId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).max(20_000),
})

/** 自动保存 · PATCH /api/writing/submissions/:id */
export const writingUpdateSchema = z.object({
  content: z.string().min(1).max(20_000).optional(),
  title: z.string().trim().max(200).optional(),
})

/** 提交列表筛选 */
export const writingSubmissionQuerySchema = z.object({
  taskId: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

export type WritingTaskQuery = z.infer<typeof writingTaskQuerySchema>
export type WritingCreateInput = z.infer<typeof writingCreateSchema>
export type WritingUpdateInput = z.infer<typeof writingUpdateSchema>
export type WritingSubmissionQuery = z.infer<typeof writingSubmissionQuerySchema>
