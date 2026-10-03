/**
 * level.spec.ts — 等级曲线与 XP 规则（架构 §5.4）：
 *   - LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 15000]（Lv1…Lv6）
 *   - XP 来源表 learn=2 / review=1 / task=5 / exam=80
 *   - 复习正确 XP 每日上限 100（防刷）
 */
import { describe, expect, it } from 'vitest'

import {
  LEVEL_NAMES,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  REVIEW_XP_DAILY_CAP,
  levelFromXp,
  levelName,
  levelProgress,
  reviewXpAward,
  totalXpForLevel,
  xpForEvent,
} from '@/services/gamification/level'

describe('LEVEL_THRESHOLDS（§5.4 阈值表）', () => {
  it('与文档完全一致', () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 500, 1500, 3500, 7000, 15000])
    expect(MAX_LEVEL).toBe(6)
  })

  it('等级名称逐级对应', () => {
    expect(LEVEL_NAMES).toEqual(['Beginner', 'Learner', 'Explorer', 'Achiever', 'Expert', 'Master'])
    expect(levelName(1)).toBe('Beginner')
    expect(levelName(6)).toBe('Master')
  })
})

describe('totalXpForLevel', () => {
  it('Lv1=0 / Lv2=500 / Lv3=1500 / Lv4=3500 / Lv5=7000 / Lv6=15000', () => {
    expect(totalXpForLevel(1)).toBe(0)
    expect(totalXpForLevel(2)).toBe(500)
    expect(totalXpForLevel(3)).toBe(1500)
    expect(totalXpForLevel(4)).toBe(3500)
    expect(totalXpForLevel(5)).toBe(7000)
    expect(totalXpForLevel(6)).toBe(15000)
  })

  it('越界收敛：0/-5 → Lv1，Lv99 → Lv6', () => {
    expect(totalXpForLevel(0)).toBe(0)
    expect(totalXpForLevel(-5)).toBe(0)
    expect(totalXpForLevel(99)).toBe(15000)
  })

  it('非整数向下取整', () => {
    expect(totalXpForLevel(3.9)).toBe(totalXpForLevel(3))
  })
})

describe('levelFromXp', () => {
  it('按阈值分档：0/499→Lv1，500/1499→Lv2，1500→Lv3，3500→Lv4，7000→Lv5，15000→Lv6', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(499)).toBe(1)
    expect(levelFromXp(500)).toBe(2)
    expect(levelFromXp(1499)).toBe(2)
    expect(levelFromXp(1500)).toBe(3)
    expect(levelFromXp(3499)).toBe(3)
    expect(levelFromXp(3500)).toBe(4)
    expect(levelFromXp(6999)).toBe(4)
    expect(levelFromXp(7000)).toBe(5)
    expect(levelFromXp(14999)).toBe(5)
    expect(levelFromXp(15000)).toBe(6)
  })

  it('封顶 Lv6（不再有 Lv7/100）', () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(6)
  })
})

describe('levelProgress', () => {
  it('Lv1 内 250 XP：50%（0→500 区间），距下一级 250', () => {
    expect(levelProgress(250)).toEqual({ level: 1, progressPct: 50, xpToNext: 250 })
  })

  it('恰好升级点（500 XP → Lv2）：进度 0%，距下一级 1000', () => {
    expect(levelProgress(500)).toEqual({ level: 2, progressPct: 0, xpToNext: 1000 })
  })

  it('Lv3 区间中点（2500 XP：1500→3500）→ 50%', () => {
    expect(levelProgress(2500)).toEqual({ level: 3, progressPct: 50, xpToNext: 1000 })
  })

  it('满级（≥15000）：100% 且 xpToNext=0', () => {
    expect(levelProgress(15000)).toEqual({ level: 6, progressPct: 100, xpToNext: 0 })
    expect(levelProgress(999999)).toEqual({ level: 6, progressPct: 100, xpToNext: 0 })
  })

  it('进度与距下一级互补为当前级区间', () => {
    const p = levelProgress(2000)
    expect(p.level).toBe(3)
    expect(p.progressPct + Math.round((p.xpToNext / 2000) * 100)).toBe(100)
  })
})

describe('xpForEvent（§5.4 XP 来源表：learn 2 / review 1 / task 5 / exam 80）', () => {
  it('四类事件 XP 值', () => {
    expect(xpForEvent('learn_word')).toBe(2)
    expect(xpForEvent('review_word')).toBe(1)
    expect(xpForEvent('complete_task')).toBe(5)
    expect(xpForEvent('exam_submit')).toBe(80)
  })
})

describe('reviewXpAward（复习 XP 每日上限 100，防刷）', () => {
  it('答对且未达上限 → 1 XP', () => {
    expect(reviewXpAward(0, true)).toBe(1)
    expect(reviewXpAward(99, true)).toBe(1)
  })

  it('答错 → 0 XP', () => {
    expect(reviewXpAward(0, false)).toBe(0)
    expect(reviewXpAward(50, false)).toBe(0)
  })

  it('当日已达 100 次上限 → 不再发放（脚本刷分无效）', () => {
    expect(REVIEW_XP_DAILY_CAP).toBe(100)
    expect(reviewXpAward(100, true)).toBe(0)
    expect(reviewXpAward(500, true)).toBe(0)
  })

  it('上限边界：第 100 次仍给分，第 101 次不给', () => {
    // correctReviewsToday 为「本次之前」的答对次数
    expect(reviewXpAward(REVIEW_XP_DAILY_CAP - 1, true)).toBe(1)
    expect(reviewXpAward(REVIEW_XP_DAILY_CAP, true)).toBe(0)
  })
})
