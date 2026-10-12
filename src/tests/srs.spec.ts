/**
 * srs.spec.ts — SRS 三路径推进（§5.1）：LAPSE / ADVANCE / MASTERED + EF 公式。
 */
import { describe, expect, it } from 'vitest'

import { ADVANCE_INTERVALS, EASE_MAX, EASE_MIN, GRADUATED_INTERVALS, MIN_GRADUATE_REPS, STAGE_THRESHOLDS } from '@/services/vocabulary/srs/srs.constants'
import { advance, clamp, nextReviewFrom, stageFromMastery } from '@/services/vocabulary/srs/srs.formula'
import { review, stateFromRow } from '@/services/vocabulary/srs/srs.engine'
import type { SrsState } from '@/services/vocabulary/srs/srs.types'

const NOW = new Date('2026-09-27T10:00:00Z')

/** 初始状态（新词） */
function freshState(overrides: Partial<SrsState> = {}): SrsState {
  return {
    masteryScore: 10,
    stage: 'STRANGER',
    easeFactor: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    consecutiveCorrect: 0,
    avgResponseMs: 0,
    ...overrides,
  }
}

describe('stageFromMastery（阈值 0/25/50/75/90）', () => {
  it.each([
    [0, 'STRANGER'],
    [24, 'STRANGER'],
    [25, 'LEARNING'],
    [49, 'LEARNING'],
    [50, 'FAMILIAR'],
    [74, 'FAMILIAR'],
    [75, 'PROFICIENT'],
    [89, 'PROFICIENT'],
    [90, 'MASTERED'],
    [100, 'MASTERED'],
  ])('mastery=%i → %s', (m, expected) => {
    expect(stageFromMastery(m)).toBe(expected)
  })
})

describe('LAPSE 路径（rating < 2 视为答错）', () => {
  it('答错：间隔回 1 天、lapses+1、reps 清零、mastery 扣 25、EF 惩罚', () => {
    const s = freshState({ masteryScore: 60, reps: 3, consecutiveCorrect: 2, easeFactor: 2.5 })
    const out = advance(s, 1, 8000, NOW)
    expect(out.path).toBe('LAPSE')
    expect(out.isCorrect).toBe(false)
    expect(out.intervalDays).toBe(1)
    expect(out.reps).toBe(0)
    expect(out.lapses).toBe(1)
    expect(out.consecutiveCorrect).toBe(0)
    expect(out.masteryScore).toBe(35) // 60 - 25
    expect(out.stage).toBe('LEARNING') // 35 → LEARNING
    // EF：q=1 → 0.1 - 4*(0.08+4*0.02) = 0.1 - 0.64 = -0.54
    expect(out.easeFactor).toBeCloseTo(1.96, 5)
    expect(out.nextReviewAt.getTime()).toBe(nextReviewFrom(NOW, 1).getTime())
  })

  it('mastery 扣减下限为 0', () => {
    const out = advance(freshState({ masteryScore: 10 }), 0, 8000, NOW)
    expect(out.masteryScore).toBe(0)
  })
})

describe('ADVANCE 路径（答对且未毕业）', () => {
  it('rating=5 快速作答：mastery +19（(12+4)*1.2）→ LEARNING，间隔查表 reps=1', () => {
    const out = advance(freshState(), 5, 3000, NOW)
    expect(out.path).toBe('ADVANCE')
    expect(out.isCorrect).toBe(true)
    expect(out.masteryScore).toBe(29)
    expect(out.reps).toBe(1)
    expect(out.consecutiveCorrect).toBe(1)
    // EF：q=5 → +0.1
    expect(out.easeFactor).toBeCloseTo(2.6, 5)
    // baseInterval=1，EF 2.6 缩放 = round(1 * (0.5 + 2.6/2.5*0.5)) = round(1.02) = 1
    expect(out.intervalDays).toBe(1)
  })

  it('rating=3 无时间加成：mastery +12', () => {
    const out = advance(freshState(), 3, 8000, NOW)
    expect(out.masteryScore).toBe(22)
  })

  it('慢速作答（>12s）衰减 3：rating=4 → (12-3)*1.2', () => {
    const out = advance(freshState(), 4, 15000, NOW)
    expect(out.masteryScore).toBe(21) // 10 + round(9*1.2)=11 → 21
  })

  it('间隔表 × EF 缩放：reps=2（base=3）低 EF 折扣', () => {
    const s = freshState({ reps: 1, consecutiveCorrect: 1, easeFactor: EASE_MIN, masteryScore: 60 })
    const out = advance(s, 3, 8000, NOW)
    expect(out.reps).toBe(2)
    // scaled = max(1, round(3 * (0.5 + 1.3/2.5*0.5))) = round(3*0.76)=2
    expect(out.intervalDays).toBe(2)
  })

  it('reps 超表长后取末位间隔（长尾 240 天）', () => {
    // mastery 保持在 90 以下、rating=4（EF 不变量）→ 走 ADVANCE 路径、缩放系数 1.0
    const s = freshState({ reps: 9, consecutiveCorrect: 9, masteryScore: 50, easeFactor: 2.5 })
    const out = advance(s, 4, 8000, NOW)
    expect(out.path).toBe('ADVANCE')
    expect(out.reps).toBe(10)
    const base = ADVANCE_INTERVALS[ADVANCE_INTERVALS.length - 1] ?? 240
    expect(base).toBe(240)
    // EF=2.5 → 缩放系数 1.0 → 恰为末位间隔 240
    expect(out.intervalDays).toBe(240)
    expect(out.intervalDays).toBeGreaterThanOrEqual(Math.round(base * 0.5))
  })
})

describe('长尾阶梯（架构 §5.1.4 裁决 B-1，P0）：8 档 [1,3,7,14,30,60,120,240]', () => {
  it('ADVANCE_INTERVALS 长度为 8 且末位为 240', () => {
    expect(ADVANCE_INTERVALS.length).toBe(8)
    expect(ADVANCE_INTERVALS[ADVANCE_INTERVALS.length - 1]).toBe(240)
  })

  it('ADVANCE 查表：EF=2.5（缩放系数 1.0）时 reps=1..8 依次取 [1,3,7,14,30,60,120,240]', () => {
    // 本用例只验证「ADVANCE 查表」本身——**非**真实连续答对序列（QA 第四轮 R2-2 已指出原标题误导）：
    // rating=4 时 EF 增量为 0（不变量），缩放系数恒为 1.0，可直接读到间隔表原值；
    // 每轮人为复位 mastery/连续计数，是为隔离「毕业分支」，让 reps 递增单独驱动查表下标。
    // 真实（不复位）连续序列见下一 describe：毕业会**跳过**表中尚未消费的档位。
    let s = freshState({ masteryScore: 10 })
    const intervals: number[] = []
    for (let i = 0; i < 8; i++) {
      const out = advance(s, 4, 8000, NOW)
      expect(out.path).toBe('ADVANCE')
      expect(out.easeFactor).toBeCloseTo(2.5, 5)
      intervals.push(out.intervalDays)
      s = { ...out, masteryScore: 10, consecutiveCorrect: 0 }
    }
    expect(intervals).toEqual([1, 3, 7, 14, 30, 60, 120, 240])
  })
})

describe('真实连续答对序列（不复位，QA 第四轮 R2-2）', () => {
  /*
   * 与上一条「隔离毕业分支」的查表用例不同，这里**不复位** mastery / consecutiveCorrect，
   * 完整跑真实推进；断言取自 QA 独立驱动的实测序列（本机复核一致）。
   *
   * ⚠️ 设计意图说明（**不要**为了让序列「符合直觉」而改公式）：
   *   - ADVANCE 路径的间隔表 [1,3,7,14,30,60,120,240] 只在「未毕业」时逐档消费；
   *   - 一旦 mastery≥90 且连续答对≥3，即切到 MASTERED 毕业递进 GRADUATED_INTERVALS=[60,120,240]，
   *     下标 = reps - MIN_GRADUATE_REPS(=5)，因而会**跳过** ADVANCE 表中尚未消费的档位；
   *   - 所以「答得越快（mastery 增速越高）→ 毕业越早 → 被跳过的中间档越多」是**预期行为**：
   *     让已掌握词尽快沉入长尾、少占复习队列（§5.1.4 裁决 B）。
   */
  it('rating=4 常态 8s：r6 触发毕业（下标=1）直接取 120，跳过 ADVANCE 首档 60', () => {
    let s = freshState()
    const intervals: number[] = []
    const paths: string[] = []
    for (let i = 0; i < 7; i++) {
      const out = advance(s, 4, 8000, NOW)
      intervals.push(out.intervalDays)
      paths.push(out.path)
      s = { ...out }
    }
    // r1..r5 逐档 ADVANCE（1/3/7/14/30）；r6 mastery 80→94 触发 MASTERED，reps=6 → gradIndex=1 → 120；
    // r7 递进到 240。注意：**60 被跳过**（不是 120 跳档）。
    expect(intervals).toEqual([1, 3, 7, 14, 30, 120, 240])
    expect(paths).toEqual(['ADVANCE', 'ADVANCE', 'ADVANCE', 'ADVANCE', 'ADVANCE', 'MASTERED', 'MASTERED'])
  })

  it('rating=4 慢速 15s：mastery 增速最慢 → 唯一走满 ADVANCE 全 8 档 [1,3,7,14,30,60,120,240]', () => {
    let s = freshState()
    const intervals: number[] = []
    for (let i = 0; i < 8; i++) {
      const out = advance(s, 4, 15000, NOW)
      intervals.push(out.intervalDays)
      s = { ...out }
    }
    expect(intervals).toEqual([1, 3, 7, 14, 30, 60, 120, 240])
  })

  it('rating=5 快速 2s：EF 升至 2.8（缩放 1.06）使 14→15，r5 达 mastery=100 毕业取首档 60', () => {
    let s = freshState()
    const intervals: number[] = []
    for (let i = 0; i < 7; i++) {
      const out = advance(s, 5, 2000, NOW)
      intervals.push(out.intervalDays)
      s = { ...out }
    }
    expect(intervals).toEqual([1, 3, 7, 15, 60, 120, 240])
  })
})

describe('MASTERED 路径（mastery≥90 且连续答对 3 次）', () => {
  it('毕业：首档间隔 60 天（替代 Phase 1 的 45 天单跳）、stage=MASTERED', () => {
    const s = freshState({ masteryScore: 85, consecutiveCorrect: 2, reps: 4 })
    const out = advance(s, 5, 2000, NOW)
    expect(out.path).toBe('MASTERED')
    expect(out.stage).toBe('MASTERED')
    expect(out.intervalDays).toBe(60)
    expect(out.consecutiveCorrect).toBe(3)
    expect(out.masteryScore).toBe(100)
    expect(out.nextReviewAt.getTime()).toBe(nextReviewFrom(NOW, 60).getTime())
  })

  it('毕业递进：连续答对后间隔为 60 → 120 → 240（三级递进，§5.1.4 裁决 B-2）', () => {
    expect(GRADUATED_INTERVALS).toEqual([60, 120, 240])
    expect(MIN_GRADUATE_REPS).toBe(5)
    // 起始 reps=4 → 首次推进后 reps=5 → 递进下标 0（60）
    let s = freshState({ masteryScore: 95, consecutiveCorrect: 3, reps: 4 })
    const ups: number[] = []
    for (let i = 0; i < 3; i++) {
      const out = advance(s, 4, 8000, NOW)
      expect(out.path).toBe('MASTERED')
      ups.push(out.intervalDays)
      s = { ...out } // mastery 恒为 100、consecutiveCorrect 递增、reps 递增
    }
    expect(ups).toEqual([60, 120, 240])
  })

  it('mastery 达标但连续不足 3 次 → 不毕业（ADVANCE）', () => {
    const s = freshState({ masteryScore: 85, consecutiveCorrect: 1, reps: 4 })
    const out = advance(s, 5, 2000, NOW)
    expect(out.path).toBe('ADVANCE')
    expect(out.consecutiveCorrect).toBe(2)
  })

  it('连续达标但 mastery < 90 → 不毕业（ADVANCE）', () => {
    const s = freshState({ masteryScore: 70, consecutiveCorrect: 2, reps: 4 })
    const out = advance(s, 4, 8000, NOW)
    expect(out.path).toBe('ADVANCE')
  })
})

describe('EF 边界与 review 平滑', () => {
  it('rating=0：EF 大幅惩罚但不低于 EASE_MIN（2.0-0.8=1.2 → 1.3）', () => {
    const out = advance(freshState({ easeFactor: 2.0 }), 0, 8000, NOW)
    expect(out.easeFactor).toBe(EASE_MIN)
  })

  it('rating=5：EF 上限 EASE_MAX', () => {
    const out = advance(freshState({ easeFactor: EASE_MAX }), 5, 8000, NOW)
    expect(out.easeFactor).toBe(EASE_MAX)
  })

  it('review()：avgResponseMs 首次直接采用，其后 0.7/0.3 平滑', () => {
    const first = review(freshState(), 4, 6000, NOW)
    expect(first.avgResponseMs).toBe(6000)
    const second = review(freshState({ avgResponseMs: 6000 }), 4, 2000, NOW)
    expect(second.avgResponseMs).toBe(Math.round(6000 * 0.7 + 2000 * 0.3)) // 4800
  })

  it('stateFromRow：由 DB 行构建引擎状态', () => {
    const s = stateFromRow({
      masteryScore: 42, masteryStage: 'FAMILIAR', easeFactor: 2.3, intervalDays: 5,
      reps: 2, lapses: 1, consecutiveCorrect: 2, avgResponseMs: 5200,
    })
    expect(s.stage).toBe('FAMILIAR')
    expect(s.masteryScore).toBe(42)
  })

  it('clamp 边界', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})

describe('阈值一致性', () => {
  it('STAGE_THRESHOLDS 与毕业条件一致（MASTERED=90）', () => {
    expect(STAGE_THRESHOLDS.MASTERED).toBe(90)
  })
})
