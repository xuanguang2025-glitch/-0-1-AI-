/**
 * date.spec.ts — 用户本地日期口径（QA P2 #8）。
 *
 * 回归重点：UTC+8 用户在 UTC 00:00-08:00（即本地 08:00-16:00 之前）请求时，
 * 「今天」必须按 Asia/Shanghai 解析，不能落回前一天。
 */
import { describe, expect, it, vi } from 'vitest'

// user-date.ts 顶层 import prisma（会实例化 PrismaClient），纯函数测试里 mock 掉
vi.mock('@/lib/db', () => ({ prisma: {} }))

import { DEFAULT_TIME_ZONE, dateOffset, localDateIn } from '@/lib/utils/date'
import { todayFor, todayInTimeZone } from '@/lib/utils/user-date'

describe('localDateIn（按 IANA 时区取当地自然日）', () => {
  it('UTC 2026-09-27T20:00Z 在上海是 9-28（+8 跨日）', () => {
    const at = new Date('2026-09-27T20:00:00.000Z')
    expect(localDateIn('Asia/Shanghai', at)).toBe('2026-09-28')
    expect(localDateIn('UTC', at)).toBe('2026-09-27')
  })

  it('UTC 2026-09-27T23:00Z 在上海是 9-28，在纽约（-4）是 9-27', () => {
    const at = new Date('2026-09-27T23:00:00.000Z')
    expect(localDateIn('Asia/Shanghai', at)).toBe('2026-09-28')
    expect(localDateIn('America/New_York', at)).toBe('2026-09-27')
  })

  it('UTC 00:00 时上海已是当天 08:00 —— 这正是旧 UTC 口径归错日的场景', () => {
    const at = new Date('2026-09-27T00:00:00.000Z')
    // 旧实现用服务器本地时区；若服务器在 UTC，则会算成 09-27（对上海用户而言「今天」已到）
    expect(localDateIn('UTC', at)).toBe('2026-09-27')
    expect(localDateIn('Asia/Shanghai', at)).toBe('2026-09-27')
    // 而 UTC 16:00 之后（上海已是次日 00:00 起）才会跨日
    const late = new Date('2026-09-27T16:00:00.000Z')
    expect(localDateIn('UTC', late)).toBe('2026-09-27')
    expect(localDateIn('Asia/Shanghai', late)).toBe('2026-09-28')
  })

  it('跨月/跨年边界', () => {
    expect(localDateIn('Asia/Shanghai', new Date('2026-01-31T16:30:00.000Z'))).toBe('2026-02-01')
    expect(localDateIn('Asia/Shanghai', new Date('2026-12-31T16:30:00.000Z'))).toBe('2027-01-01')
  })

  it('非法时区 / 空值回退服务器本地（不抛错）', () => {
    const at = new Date('2026-09-27T12:00:00.000Z')
    expect(localDateIn('Not/AZone', at)).toBe(localDateIn(DEFAULT_TIME_ZONE, at))
    expect(localDateIn(null, at)).toBe(localDateIn(DEFAULT_TIME_ZONE, at))
    expect(localDateIn(undefined, at)).toBe(localDateIn(DEFAULT_TIME_ZONE, at))
  })

  it('输出始终是 yyyy-MM-dd 10 位', () => {
    expect(localDateIn('Asia/Shanghai', new Date('2026-09-27T04:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('dateOffset（基于日期串的偏移，UTC 语义）', () => {
  it('前后偏移与跨月正确', () => {
    expect(dateOffset('2026-09-27', 0)).toBe('2026-09-27')
    expect(dateOffset('2026-09-27', 1)).toBe('2026-09-28')
    expect(dateOffset('2026-09-27', -1)).toBe('2026-09-26')
    expect(dateOffset('2026-09-27', 6)).toBe('2026-10-03')
    expect(dateOffset('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('同步版包装（todayInTimeZone / todayFor）', () => {
  const at = new Date('2026-09-27T20:00:00.000Z')

  it('todayInTimeZone 透传时区', () => {
    expect(todayInTimeZone('Asia/Shanghai', at)).toBe('2026-09-28')
    expect(todayInTimeZone('UTC', at)).toBe('2026-09-27')
  })

  it('todayFor 读 user.timezone，缺失回退默认时区', () => {
    expect(todayFor({ timezone: 'Asia/Shanghai' }, at)).toBe('2026-09-28')
    expect(todayFor({ timezone: null }, at)).toBe('2026-09-28')
    expect(todayFor(null, at)).toBe('2026-09-28')
  })
})
