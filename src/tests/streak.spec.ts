/**
 * streak.spec.ts — 连续天数计算（今天没学不打断，从昨天回数）。
 */
import { describe, expect, it } from 'vitest'

import { calcStreakDays } from '@/services/gamification/level'

/** 以今天为锚生成 YYYY-MM-DD 偏移日期 */
function dayOffset(base: string, offset: number): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe('calcStreakDays', () => {
  it('今天学了：连续 3 天 → 3', () => {
    const today = '2026-09-27'
    const dates = new Set([dayOffset(today, 0), dayOffset(today, -1), dayOffset(today, -2)])
    expect(calcStreakDays(dates, today)).toBe(3)
  })

  it('今天没学：从昨天回数不打断 → 连续 2 天', () => {
    const today = '2026-09-27'
    const dates = new Set([dayOffset(today, -1), dayOffset(today, -2)])
    expect(calcStreakDays(dates, today)).toBe(2)
  })

  it('中间断档：只数到断点', () => {
    const today = '2026-09-27'
    const dates = new Set([dayOffset(today, 0), dayOffset(today, -1), dayOffset(today, -4)])
    expect(calcStreakDays(dates, today)).toBe(2)
  })

  it('空集合 → 0', () => {
    expect(calcStreakDays(new Set(), '2026-09-27')).toBe(0)
  })

  it('只有今天 → 1', () => {
    expect(calcStreakDays(new Set(['2026-09-27']), '2026-09-27')).toBe(1)
  })

  it('只看今天以前 → 0（昨天也没学）', () => {
    const today = '2026-09-27'
    const dates = new Set([dayOffset(today, -5)])
    expect(calcStreakDays(dates, today)).toBe(0)
  })
})
