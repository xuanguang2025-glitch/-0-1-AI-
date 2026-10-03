/**
 * cefr.spec.ts — Placement 评分映射（架构 §5.5 / PRD Q9）：
 *   - 维度权重 词汇 30% / 语法 30% / 阅读 25% / 听力 15%
 *   - mapCefr 五段 88/78/65/50/33（含 C2 顶档）
 *   - estimateCet = CET_BASE 查表 + 档内线性微调，CET-6 ×0.92，clamp [220, 700]
 */
import { describe, expect, it, vi } from 'vitest'

// placement.service 顶层实例化 PrismaClient（未连接无副作用），测试环境 mock 掉
vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  BAND_CENTER,
  CET_BASE,
  CET_MAX,
  CET_MIN,
  allocateQuestionCounts,
  dimensionScore,
  estimateCet,
  estimateCetFor,
  overallScore,
  scoreToCefr,
} from '@/services/placement.service'

describe('dimensionScore', () => {
  it('正确率 0-100 取整', () => {
    expect(dimensionScore(0, 10)).toBe(0)
    expect(dimensionScore(7, 10)).toBe(70)
    expect(dimensionScore(10, 10)).toBe(100)
  })

  it('维度 0 题给 40（保守中位，避免该维拖低总分）', () => {
    expect(dimensionScore(0, 0)).toBe(40)
  })
})

describe('overallScore（PRD Q9 权重：词汇 30 / 语法 30 / 阅读 25 / 听力 15）', () => {
  it('满分 100', () => {
    expect(overallScore({ vocabulary: 100, grammar: 100, reading: 100, listening: 100 })).toBe(100)
  })

  it('语法权重为 30%（与旧的 25% 不同）', () => {
    const s = overallScore({ vocabulary: 0, grammar: 100, reading: 0, listening: 0 })
    expect(s).toBe(30)
  })

  it('听力权重为 15%（与旧的 20% 不同）', () => {
    const s = overallScore({ vocabulary: 0, grammar: 0, reading: 0, listening: 100 })
    expect(s).toBe(15)
  })

  it('词汇 30% / 阅读 25%', () => {
    expect(overallScore({ vocabulary: 100, grammar: 0, reading: 0, listening: 0 })).toBe(30)
    expect(overallScore({ vocabulary: 0, grammar: 0, reading: 100, listening: 0 })).toBe(25)
  })
})

describe('allocateQuestionCounts（抽题配比与权重对齐，30 题 → 9/9/8/4）', () => {
  it('30 题按 30/30/25/15 分配，总和守恒', () => {
    const plan = allocateQuestionCounts(30)
    expect(plan.vocabulary).toBe(9)
    expect(plan.grammar).toBe(9)
    expect(plan.reading).toBe(8)
    expect(plan.listening).toBe(4)
    expect(plan.vocabulary + plan.grammar + plan.reading + plan.listening).toBe(30)
  })

  it('任意题量总和都等于入参且无负数', () => {
    for (const total of [8, 12, 20, 30, 40]) {
      const plan = allocateQuestionCounts(total)
      const sum = plan.vocabulary + plan.grammar + plan.reading + plan.listening
      expect(sum).toBe(total)
      expect(Object.values(plan).every((n) => n >= 0)).toBe(true)
    }
  })
})

describe('scoreToCefr（§5.5：88→C2 / 78→C1 / 65→B2 / 50→B1 / 33→A2 / 其余 A1）', () => {
  it.each([
    [0, 'A1'],
    [32, 'A1'],
    [32.9, 'A1'],
    [33, 'A2'],
    [49, 'A2'],
    [50, 'B1'],
    [64, 'B1'],
    [65, 'B2'],
    [77, 'B2'],
    [78, 'C1'],
    [87, 'C1'],
    [88, 'C2'],
    [100, 'C2'],
  ])('overall=%i → %s', (overall, expected) => {
    expect(scoreToCefr(overall)).toBe(expected)
  })

  it('C2 为最高档（100 分仍是 C2，不溢出）', () => {
    expect(scoreToCefr(99.9)).toBe('C2')
  })
})

describe('estimateCet（§5.5 CET_BASE/BAND_CENTER 查表 + CET-6 ×0.92 + clamp[220,700]）', () => {
  it('CET_BASE / BAND_CENTER 与文档一致', () => {
    expect(CET_BASE).toEqual({ A1: 220, A2: 330, B1: 420, B2: 520, C1: 600, C2: 660 })
    expect(BAND_CENTER).toEqual({ A1: 20, A2: 42, B1: 58, B2: 72, C1: 84, C2: 94 })
  })

  it('落在档位中心时 CET4 = CET_BASE[level]', () => {
    for (const [level, center] of Object.entries(BAND_CENTER)) {
      expect(estimateCetFor(center, level as 'B1', 'CET4')).toBe(CET_BASE[level as 'B1'])
    }
  })

  it('A1 低分段被 clamp 到下限 220（不再是 0/190）', () => {
    expect(estimateCet(0, 'A1')).toEqual({ cet4: 220, cet6: 220 })
  })

  it('B2 中段：CET4=520 基准，CET6 = round(520×0.92)=478', () => {
    expect(estimateCet(72, 'B2')).toEqual({ cet4: 520, cet6: 478 })
  })

  it('C1 高段：档内上调', () => {
    // adjust = round(0.5 × (100 − 84)) = 8 → CET4 = 608
    const { cet4, cet6 } = estimateCet(100, 'C1')
    expect(cet4).toBe(608)
    expect(cet6).toBe(Math.round(608 * 0.92))
  })

  it('C2 顶档：CET4 = 660 + adjust', () => {
    // adjust = round(0.5 × (100 − 94)) = 3 → CET4 = 663，CET6 = round(663×0.92)=610
    expect(estimateCet(100, 'C2')).toEqual({ cet4: 663, cet6: 610 })
  })

  it('恒在 [220, 700] 闭区间内', () => {
    for (const overall of [0, 20, 33, 42, 50, 58, 65, 72, 78, 84, 88, 94, 100]) {
      const level = scoreToCefr(overall)
      const { cet4, cet6 } = estimateCet(overall, level)
      for (const v of [cet4, cet6]) {
        expect(v).toBeGreaterThanOrEqual(CET_MIN)
        expect(v).toBeLessThanOrEqual(CET_MAX)
      }
    }
  })

  it('CET4 恒 ≥ CET6（同水平 CET-6 略低）', () => {
    for (const overall of [0, 25, 40, 55, 70, 85, 100]) {
      const { cet4, cet6 } = estimateCet(overall, scoreToCefr(overall))
      expect(cet4).toBeGreaterThanOrEqual(cet6)
    }
  })

  it('CET6 不再出现 0/负值下限', () => {
    const { cet6 } = estimateCet(0, 'A1')
    expect(cet6).toBeGreaterThanOrEqual(CET_MIN)
  })
})
