/**
 * 结构化日志（架构 §10.9）。
 *
 * - 级别：debug / info / warn / error；`debug` 仅开发环境输出；
 * - 脱敏红线：邮箱 → `a***@b.com`；IP → `192.168.*.*`；密钥/token 一律不落日志；
 * - 生产环境输出 JSON 行，便于采集。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  /** 产生日志的模块，如 'vocabulary.service' */
  module?: string
  /** 人类可读的短消息 */
  msg?: string
  userId?: string
  traceId?: string
  capability?: string
  [key: string]: unknown
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const isProd = process.env.NODE_ENV === 'production'
const minWeight = isProd ? LEVEL_WEIGHT.info : LEVEL_WEIGHT.debug

/** 邮箱脱敏：ab.cd@example.com → a***d@example.com */
export function maskEmail(input: string): string {
  const at = input.indexOf('@')
  if (at <= 0) return input
  const local = input.slice(0, at)
  const domain = input.slice(at + 1)
  if (local.length <= 1) return `*@${domain}`
  const head = local.slice(0, 1)
  const tail = local.slice(-1)
  return `${head}***${tail}@${domain}`
}

/** IP 脱敏：192.168.1.23 → 192.168.*.*；IPv6 仅保留前两段 */
export function maskIp(input: string): string {
  if (input.includes(':')) {
    const parts = input.split(':')
    return `${parts[0] ?? ''}:${parts[1] ?? ''}:*`
  }
  const parts = input.split('.')
  if (parts.length === 4) {
    return `${parts[0] ?? ''}.${parts[1] ?? ''}.*.*`
  }
  return '***'
}

const SENSITIVE_KEY = /(password|passwd|secret|token|api[_-]?key|authorization)/i

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null) return value
  if (depth > 4) return '[deep]'
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: isProd ? undefined : value.stack }
  }
  if (typeof value === 'string') {
    if (value.includes('@') && value.includes('.')) return maskEmail(value)
    return value
  }
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[REDACTED]'
    } else {
      out[key] = sanitize(val, depth + 1)
    }
  }
  return out
}

function emit(level: LogLevel, context: LogContext): void {
  if (LEVEL_WEIGHT[level] < minWeight) return
  const { module, msg, ...rest } = context
  const payload = sanitize(rest) as Record<string, unknown>
  const record = {
    level,
    time: new Date().toISOString(),
    module: module ?? 'app',
    msg: msg ?? '',
    ...payload,
  }
  const line = isProd ? JSON.stringify(record) : `[${record.level}] ${record.module} ${record.msg}`
  const args: unknown[] = isProd ? [line] : [line, payload]
  if (level === 'error') console.error(...args)
  else if (level === 'warn') console.warn(...args)
  else console.log(...args)
}

export const logger = {
  debug: (context: LogContext): void => emit('debug', context),
  info: (context: LogContext): void => emit('info', context),
  warn: (context: LogContext): void => emit('warn', context),
  error: (context: LogContext): void => emit('error', context),
}

export type Logger = typeof logger

/**
 * 创建带模块名的 logger（架构 §1.4.5）：`createLogger('auth.service')`。
 * traceId 从 request-context 自动注入（存在时）。
 */
export function createLogger(module: string): Logger & { duration: <T>(msg: string, fn: () => Promise<T>) => Promise<T> } {
  const withModule = (context: LogContext): LogContext => ({ ...context, module })
  const base: Logger = {
    debug: (context) => logger.debug(withModule(context)),
    info: (context) => logger.info(withModule(context)),
    warn: (context) => logger.warn(withModule(context)),
    error: (context) => logger.error(withModule(context)),
  }
  return {
    ...base,
    /** 计时便捷方法：记录耗时并返回结果 */
    duration: async <T,>(msg: string, fn: () => Promise<T>): Promise<T> => {
      const started = Date.now()
      try {
        const result = await fn()
        base.info({ msg, durationMs: Date.now() - started })
        return result
      } catch (e) {
        base.error({ msg, durationMs: Date.now() - started, err: e instanceof Error ? e : String(e) })
        throw e
      }
    },
  }
}
