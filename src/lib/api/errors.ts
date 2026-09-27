/**
 * 错误码体系（架构 §3.2）：格式 DOMAIN_NNN，HTTP 状态码与错误码分离。
 * 前端按 code 做文案映射；服务端只管抛 AppError。
 */

/** 错误码 → 默认 HTTP 状态码映射（§3.2 全表 30 条） */
export const ERROR_STATUS: Readonly<Record<string, number>> = {
  SUCCESS: 200,

  SYS_INTERNAL: 500,
  SYS_RATE_LIMIT: 429,
  SYS_MAINTENANCE: 503,
  SYS_DEPENDENCY_DOWN: 503,

  VALIDATION_ERROR: 400,
  RESOURCE_NOT_FOUND: 404,
  PERM_FORBIDDEN: 403,

  AUTH_TOKEN_MISSING: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_SESSION_REVOKED: 401,
  AUTH_BAD_CREDENTIALS: 401,
  AUTH_EMAIL_TAKEN: 409,
  AUTH_WEAK_PASSWORD: 400,
  AUTH_ACCOUNT_LOCKED: 423,
  AUTH_ACCOUNT_DISABLED: 403,

  AI_UNAVAILABLE: 503,
  AI_QUOTA_EXCEEDED: 429,
  AI_TIMEOUT: 200,
  AI_STRUCT_INVALID: 200,
  AI_CONTENT_BLOCKED: 400,
  AI_CAPABILITY_DISABLED: 403,
  AI_CONCURRENCY_LIMIT: 429,

  VOCAB_NO_BOOK_SELECTED: 400,
  VOCAB_QUEUE_EMPTY: 200,

  EXAM_SAVE_TOO_FREQUENT: 409,
  EXAM_ALREADY_SUBMITTED: 409,
  EXAM_TIME_EXPIRED: 409,

  CONTENT_TOO_LONG: 413,
}

/** 面向用户的默认中文文案（i18n 字典可覆盖） */
export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  SYS_INTERNAL: '服务开小差了，请稍后重试',
  SYS_RATE_LIMIT: '请求过于频繁，请稍后再试',
  SYS_MAINTENANCE: '系统维护中',
  SYS_DEPENDENCY_DOWN: '服务暂时不可用，请稍后重试',
  VALIDATION_ERROR: '输入有误，请检查表单',
  RESOURCE_NOT_FOUND: '资源不存在或已删除',
  PERM_FORBIDDEN: '没有权限执行此操作',
  AUTH_TOKEN_MISSING: '请先登录',
  AUTH_TOKEN_INVALID: '登录状态无效，请重新登录',
  AUTH_TOKEN_EXPIRED: '登录已过期',
  AUTH_SESSION_REVOKED: '会话已失效，为安全起见请重新登录',
  AUTH_BAD_CREDENTIALS: '邮箱或密码错误',
  AUTH_EMAIL_TAKEN: '该邮箱已注册，可直接登录或找回密码',
  AUTH_WEAK_PASSWORD: '密码强度不足：至少 8 位，含字母和数字',
  AUTH_ACCOUNT_LOCKED: '失败次数过多，账号已临时锁定',
  AUTH_ACCOUNT_DISABLED: '账号已被禁用，请联系管理员',
  AI_UNAVAILABLE: 'AI 服务暂时不可用',
  AI_QUOTA_EXCEEDED: '今日 AI 使用次数已达上限，明天再来吧',
  AI_TIMEOUT: 'AI 响应超时，已为你准备兜底内容',
  AI_STRUCT_INVALID: 'AI 输出异常，已为你准备兜底内容',
  AI_CONTENT_BLOCKED: '内容未通过安全检查，请调整后再试',
  AI_CAPABILITY_DISABLED: '该功能已下线',
  AI_CONCURRENCY_LIMIT: '当前使用人数较多，请稍候重试',
  VOCAB_NO_BOOK_SELECTED: '请先选择一本词库',
  VOCAB_QUEUE_EMPTY: '今日学习任务已完成！',
  EXAM_SAVE_TOO_FREQUENT: '保存过于频繁',
  EXAM_ALREADY_SUBMITTED: '试卷已提交',
  EXAM_TIME_EXPIRED: '考试时间已到',
  CONTENT_TOO_LONG: '内容超出长度限制',
}

/** 业务错误：service 层抛出，handler 层捕获并转 envelope */
export class AppError extends Error {
  readonly code: string
  readonly httpStatus: number
  readonly details?: unknown

  constructor(code: string, message?: string, options?: { httpStatus?: number; details?: unknown }) {
    super(message ?? ERROR_MESSAGES[code] ?? code)
    this.name = 'AppError'
    this.code = code
    this.httpStatus = options?.httpStatus ?? ERROR_STATUS[code] ?? 500
    this.details = options?.details
  }
}

/** 快捷构造器 */
export const errValidation = (details?: unknown): AppError =>
  new AppError('VALIDATION_ERROR', undefined, { details })
export const errNotFound = (message?: string): AppError => new AppError('RESOURCE_NOT_FOUND', message)
export const errForbidden = (message?: string): AppError => new AppError('PERM_FORBIDDEN', message)
export const errUnauthorized = (code = 'AUTH_TOKEN_MISSING'): AppError => new AppError(code)

/** 按 code 取 HTTP 状态码 */
export function statusForCode(code: string): number {
  return ERROR_STATUS[code] ?? 500
}
