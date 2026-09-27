/**
 * A1 WordExplain 输出 Schema。
 */
import { z } from 'zod'

export const WordExplainSchema = z.object({
  word: z.string(),
  phoneticUk: z.string().nullish(),
  phoneticUs: z.string().nullish(),
  senses: z.array(z.object({ pos: z.string(), zh: z.string(), en: z.string().nullish() })).default([]),
  rootAffix: z.string().nullish(),
  mnemonic: z.string().nullish(),
  examples: z.array(z.object({ en: z.string(), zh: z.string().nullish() })).default([]),
  collocations: z.array(z.string()).nullish(),
})

export type WordExplain = z.infer<typeof WordExplainSchema>
