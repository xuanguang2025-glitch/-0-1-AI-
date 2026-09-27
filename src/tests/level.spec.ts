/**
 * level.spec.ts — 等级曲线（累计 XP = 100*n*(n+1)/2）与进度换算。
 */
import { describe, expect, it } from 'vitest'

import { levelFromXp, levelProgress, totalXpForLevel, xpForEvent } from '@/services/gamification/level'

describe('totalXpForLevel', () => {
  it('1 级 100 / 2 级 300 / 3 级 600', () => {
    expect(totalXpForLevel(1)).toBe(100)
    expect(totalXpForLevel(2)).toBe(300)
    expect(totalXpForLevel(3)).toBe(600)
  })

  it('非整数向下取整，最小 1', () => {
    expect(totalXpForLevel(2.9)).toBe(totalXpForLevel(2))
    expect(totalXpForLevel(0)).toBe(totalXpForLevel(1))
    expect(totalXpForLevel(-5)).toBe(totalXpForLevel(1))
  })
})

describe('levelFromXp', () => {
  it('升级门槛为累计 XP ≥ totalXpForLevel(n+1)：0/299→Lv1，300/599→Lv2，600→Lv3', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(100)).toBe(1)
    expect(levelFromXp(299)).toBe(1)
    expect(levelFromXp(300)).toBe(2)
    expect(levelFromXp(599)).toBe(2)
    expect(levelFromXp(600)).toBe(3)
  })

  it('超大 XP 封顶 Lv100', () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(100)
  })
})

describe('levelProgress', () => {
  it('150 XP：Lv1 内 25%，距下一级 150', () => {
    expect(levelProgress(150)).toEqual({ level: 1, progressPct: 25, xpToNext: 150 })
  })

  it('恰好升级点（300 XP → Lv2）：进度 0%', () => {
    expect(levelProgress(300)).toEqual({ level: 2, progressPct: 0, xpToNext: 300 })
  })

  it('进度与距下一级互补为当前级区间', () => {
    const p = levelProgress(250)
    expect(p.level).toBe(1)
    expect(p.progressPct).toBe(75)
    expect(p.xpToNext).toBe(50)
  })
})

describe('xpForEvent（奖励规则）', () => {
  it('learn 4 / review 2 / task 10 / exam 50', () => {
    expect(xpForEvent('learn_word')).toBe(4)
    expect(xpForEvent('review_word')).toBe(2)
    expect(xpForEvent('complete_task')).toBe(10)
    expect(xpForEvent('exam_submit')).toBe(50)
  })
})
