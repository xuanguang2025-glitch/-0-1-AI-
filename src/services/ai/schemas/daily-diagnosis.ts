/**
 * A9 DailyDiagnosis 输出 Schema（T10 放宽版）：
 * - kind 缺省兜底 'general'；tomorrowTip/cheer 缺省兜底，避免模型漏字段导致整包降级；
 * - insights 至少 1 条；未知字段剥离（zod 默认），不因多余字段失败。
 */
import { z } from 'zod'

export const DailyDiagnosisSchema = z.object({
  /** 2-3 条诊断 */
  insights: z
    .array(
      z.object({
        kind: z.string().default('general'),
        text: z.string().min(1),
      }),
    )
    .min(1),
  /** 明日建议 */
  tomorrowTip: z.string().default('明天继续保持学习节奏。'),
  /** 鼓励语 */
  cheer: z.string().nullish().default('加油！💪'),
})

export type DailyDiagnosis = z.infer<typeof DailyDiagnosisSchema>
