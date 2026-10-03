/**
 * 日期工具（用户本地时区口径，架构 §2.5「Timestamps: UTC always. Local dates derived from
 * user.timezone」）。
 *
 * 背景：统计/streak/当日任务都以「用户本地自然日 YYYY-MM-DD」为口径。
 * 若直接用服务器本地时区，UTC+8 用户在 UTC 00:00-08:00 之间会被算到前一天，
 * 因此所有业务侧调用必须走 `userLocalDate(userId)`（按 user.timezone 解析），
 * 纯函数 `localDateIn(tz)` 便于单测。
 */

/** 默认时区（与 prisma User.timezone 默认值一致） */
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

/** 服务器本地时区当前日期（yyyy-MM-dd）——仅用于无用户上下文的场景（如 seed/脚本） */
export function localDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/** 取（缓存的）指定时区日期格式化器，输出 en-CA 风格的 yyyy-MM-dd */
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

/**
 * 指定 IANA 时区的当前日期（yyyy-MM-dd）。
 * 非法时区回退到服务器本地时区，避免整条链路因脏数据抛错。
 */
export function localDateIn(timeZone: string | null | undefined, now: Date = new Date()): string {
  if (!timeZone) return localDate(now)
  try {
    // en-CA 输出即 yyyy-MM-dd
    return dateFormatter(timeZone).format(now)
  } catch {
    return localDate(now)
  }
}

/** 基于 yyyy-MM-dd 字符串的日期偏移（UTC 语义，避免夏令时跳变） */
export function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
