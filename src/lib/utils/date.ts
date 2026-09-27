/**
 * 日期工具（本地时区 yyyy-MM-dd；统计按自然日聚合共用）。
 */

/** 本地时区当前日期（yyyy-MM-dd） */
export function localDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 基于 yyyy-MM-dd 字符串的日期偏移（UTC 语义，避免夏令时跳变） */
export function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
