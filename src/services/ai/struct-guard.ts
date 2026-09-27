/**
 * 结构守卫（架构 §4.4）：AI 输出 → JSON 提取 → Zod 校验 → 失败修补重试 1 次 → 仍失败抛错（上层降级）。
 */
import type { ZodType } from 'zod'

export class StructInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StructInvalidError'
  }
}

/** 从模型输出中提取 JSON（容忍 markdown 代码块 / 前后噪声） */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  // 直接解析
  try {
    return JSON.parse(trimmed)
  } catch {
    /* 继续尝试 */
  }
  // markdown 代码块
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      /* 继续尝试 */
    }
  }
  // 首个 { 到最后一个 }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      /* 放弃 */
    }
  }
  throw new StructInvalidError('AI 输出中未找到合法 JSON')
}

/** 校验；通过返回数据，失败返回 null（不抛） */
export function validateStruct<T>(schema: ZodType<T>, raw: unknown): T | null {
  const result = schema.safeParse(raw)
  return result.success ? result.data : null
}

/** 非流式结构化校验流程：extract → validate */
export function guardStruct<T>(schema: ZodType<T>, raw: string): T {
  const parsed = extractJson(raw)
  const data = validateStruct(schema, parsed)
  if (data === null) throw new StructInvalidError('AI 输出不符合 Schema')
  return data
}
