/**
 * cefr.spec.ts — Placement 评分映射（§5.5）：scoreToCefr 分段 + estimateCet 公式。
 */
import { describe, expect, it, vi } from 'vitest'

// placement.service 顶层实例化 PrismaClient（未连接无副作用），测试环境 mock 掉
vi.mock('@/lib/db', () => ({ prisma: {} }))

import { estimateCet, scoreToCefr } from '@/services/placement.service'

describe('scoreToCefr（§5.5 分段：A1 <40, A2 ≥40, B1 ≥55, B2 ≥70, C1 ≥85）', () => {
  it.each([
    [0, 'A1'],
    [39, 'A1'],
    [39.9, 'A1'],
    [40, 'A2'],
    [54, 'A2'],
    [55, 'B1'],
    [69, 'B1'],
    [70, 'B2'],
    [84, 'B2'],
    [85, 'C1'],
    [100, 'C1'],
  ])('overall=%i → %s', (overall, expected) => {
    expect(scoreToCefr(overall)).toBe(expected)
  })

  it('C1 为最高档（无 C2 映射）', () => {
    expect(scoreToCefr(99.9)).toBe('C1')
  })
})

describe('estimateCet（base=250+overall*3.8；B2/C1 +30；CET4=base+10+bump；CET6=base-60+bump）', () => {
  it('overall=0 / A1：无加成', () => {
    expect(estimateCet(0, 'A1')).toEqual({ cet4: 260, cet6: 190 })
  })

  it('overall=50 / A2：无加成', () => {
    const base = 250 + Math.round((50 / 100) * 380) // 440
    expect(estimateCet(50, 'A2')).toEqual({ cet4: base + 10, cet6: base - 60 })
  })

  it('overall=70 / B2：+30 加成', () => {
    const base = 250 + Math.round((70 / 100) * 380) // 516
    expect(estimateCet(70, 'B2')).toEqual({ cet4: base + 10 + 30, cet6: base - 60 + 30 })
  })

  it('overall=100 / C1：+30 加成且不超 710', () => {
    const { cet4, cet6 } = estimateCet(100, 'C1')
    expect(cet4).toBe(670)
    expect(cet6).toBe(600)
    expect(cet4).toBeLessThanOrEqual(710)
    expect(cet6).toBeLessThanOrEqual(710)
  })

  it('CET4 恒 ≥ CET6', () => {
    for (const overall of [0, 25, 40, 55, 70, 85, 100]) {
      const { cet4, cet6 } = estimateCet(overall, scoreToCefr(overall))
      expect(cet4).toBeGreaterThanOrEqual(cet6)
    }
  })

  it('CET6 下限不为负', () => {
    const { cet6 } = estimateCet(0, 'A1')
    expect(cet6).toBeGreaterThanOrEqual(0)
  })
})
