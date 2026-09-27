/**
 * Zod 辅助（架构 §1.4.1）：body/query 统一解析入口，错误转 VALIDATION_ERROR。
 */
import type { ZodType } from 'zod'

import { AppError } from './errors'

export interface FieldIssue {
  field: string
  message: string
}

/** 解析失败 → AppError(VALIDATION_ERROR, details=FieldIssue[]) */
export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (result.success) return result.data
  const details: FieldIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
  throw new AppError('VALIDATION_ERROR', undefined, { details })
}

/** JSON body 安全解析：空 body 返回 {} */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text()
    if (!text) return {}
    return JSON.parse(text) as unknown
  } catch {
    throw new AppError('VALIDATION_ERROR', '请求体不是合法 JSON')
  }
}
