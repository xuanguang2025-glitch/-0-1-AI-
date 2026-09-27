/**
 * A9 DailyDiagnosis 输出 Schema。
 */
import { z } from 'zod'

export const DailyDiagnosisSchema = z.object({
  /** 2-3 条诊断 */
  insights: z.array(z.object({ kind: z.string(), text: z.string() })).min(1),
  /** 明日建议 */
  tomorrowTip: z.string(),
  /** 鼓励语 */
  cheer: z.string().nullish(),
})

export type DailyDiagnosis = z.infer<typeof DailyDiagnosisSchema>
