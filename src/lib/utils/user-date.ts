/**
 * 用户本地日期解析（架构 §2.5 时区口径 / QA P2 #8）。
 *
 * 所有「当日」口径（streak / daily_learning_stats / study_tasks / SRS 到期统计）
 * 必须以 user.timezone 解析，不能用服务器本地时区，否则 UTC+8 用户在
 * UTC 00:00-08:00 会被算到前一天。
 *
 * 时区读取走 60s 进程内缓存（用户极少改时区），避免每次统计都打 DB。
 */
import { prisma } from '@/lib/db'
import { memoryCache } from '@/lib/cache/memory-cache'
import { CACHE_TTL } from '@/lib/cache/keys'
import { DEFAULT_TIME_ZONE, localDateIn } from './date'

/** 解析用户时区（缓存 60s；查不到或非法回退 Asia/Shanghai） */
export async function resolveUserTimeZone(userId: string, now: Date = new Date()): Promise<string> {
  return memoryCache(`user:tz:${userId}`, CACHE_TTL.analytics, async () => {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
    const tz = row?.timezone
    if (!tz) return DEFAULT_TIME_ZONE
    try {
      // 合法性校验：非法时区会让 Intl 抛错
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
      return tz
    } catch {
      return DEFAULT_TIME_ZONE
    }
  })
}

/** 用户本地日期（yyyy-MM-DD） */
export async function userToday(userId: string, now: Date = new Date()): Promise<string> {
  const tz = await resolveUserTimeZone(userId, now)
  return localDateIn(tz, now)
}

/** 用户本地日期（同步版：调用方已持有 timezone 时使用，避免额外查询） */
export function todayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  return localDateIn(timeZone, now)
}

/** 用户时区（同步版，供已 select timezone 的查询直接使用） */
export function todayFor(user: { timezone: string | null } | null, now: Date = new Date()): string {
  return localDateIn(user?.timezone ?? DEFAULT_TIME_ZONE, now)
}
