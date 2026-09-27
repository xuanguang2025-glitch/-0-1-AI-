/**
 * A2 WritingReport 输出 Schema。
 */
import { z } from 'zod'

export const WritingReportSchema = z.object({
  totalScore: z.number().min(0).max(15),
  dimensions: z.object({
    content: z.number().min(0).max(5),
    organisation: z.number().min(0).max(4),
    language: z.number().min(0).max(4),
    accuracy: z.number().min(0).max(2),
  }),
  overallComment: z.string(),
  sentences: z
    .array(
      z.object({
        original: z.string(),
        corrected: z.string().nullish(),
        issue: z.string().nullish(),
      }),
    )
    .default([]),
  modelEssay: z.string().nullish(),
})

export type WritingReport = z.infer<typeof WritingReportSchema>
