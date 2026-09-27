/**
 * A7 GeneratedPlan 输出 Schema。
 */
import { z } from 'zod'

export const GeneratedPlanSchema = z.object({
  summary: z.string(),
  weeks: z
    .array(
      z.object({
        week: z.number().int().min(1),
        focus: z.string(),
        tasks: z
          .array(
            z.object({
              type: z.string(), // vocab | listening | reading | writing | grammar | speaking | translation
              title: z.string(),
              minutes: z.number().int().min(1).max(240),
              detail: z.string().nullish(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  tips: z.array(z.string()).nullish(),
})

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>
