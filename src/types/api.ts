/**
 * 统一响应 Envelope 类型（架构 §3.1）。
 * 所有 Route Handler 的唯一返回形态，禁止裸 NextResponse.json。
 */

export interface ApiError {
  /** 见 §3.2 错误码表，如 "AUTH_003" */
  code: string
  /** 面向用户的提示（由 i18n 字典按 code 映射） */
  message: string
  /** 字段级校验错误：{ field, message }[] */
  details?: unknown
}

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  hasNext?: boolean
  hasPrev?: boolean
}

export interface ApiAiMeta {
  /** true = AI 不可用，data 为兜底内容 */
  degraded: boolean
  provider?: string
  model?: string
  promptVersion?: number
  latencyMs?: number
  tokensUsed?: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta?: ApiMeta
  ai?: ApiAiMeta
  /** 贯穿 middleware → service → ai gateway → db log */
  traceId: string
}
