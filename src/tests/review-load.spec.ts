/**
 * review-load.spec.ts — 复习负担预估（架构 §5.1.4 裁决 B-1 量化论证 / SRS-P2-5）。
 *
 * 核心验收：`estimateReviewLoad(5000)` ≤ 400 秒/天（M2 时间预算 22min/DAU）。
 * 同时给出 Phase 1 封顶 30 天的对照，证明长尾回改的必要性。
 */
import { describe, expect, it } from 'vitest'

import { SECONDS_PER_REVIEW, STEADY_STATE_AVG_INTERVAL_DAYS } from '@/services/vocabulary/srs/srs.constants'
import { estimateReviewLoad } from '@/services/vocabulary/srs/srs.engine'

describe('estimateReviewLoad（稳态日复习量 ≈ 词量 / 平均间隔）', () => {
  it('★ 5000 词（CET-4 全量）：默认长尾口径 ≤ 400 秒/天', () => {
    const load = estimateReviewLoad(5000)
    // 5000 / 120 = 41.67 词/天 → ×8s = 333.33 → 333 秒（≈5.6 min）
    expect(load.dailyReviews).toBeCloseTo(41.67, 2)
    expect(load.etaSeconds).toBe(333)
    expect(load.etaSeconds).toBeLessThanOrEqual(400)
    expect(load.avgIntervalDays).toBe(STEADY_STATE_AVG_INTERVAL_DAYS)
    expect(load.secondsPerWord).toBe(SECONDS_PER_REVIEW)
    expect(load.etaMinutes).toBe(5.6)
  })

  it('对照 Phase 1 封顶 30 天：5000 词 → ~1333 秒/天（≈22min，吃满预算 → 必须回改）', () => {
    const legacy = estimateReviewLoad(5000, 30)
    expect(legacy.etaSeconds).toBe(1333)
    expect(legacy.etaSeconds).toBeGreaterThan(400)
  })

  it('20000 词（含 CET-6）：长尾口径 ~1333 秒/天（远低于封顶口径 ~5333 秒）', () => {
    expect(estimateReviewLoad(20000).etaSeconds).toBe(1333)
    expect(estimateReviewLoad(20000, 30).etaSeconds).toBe(5333)
  })

  it('词量为 0 / 非法输入：回退安全默认，不抛错、ETA 为 0', () => {
    expect(estimateReviewLoad(0).etaSeconds).toBe(0)
    expect(estimateReviewLoad(-100).etaSeconds).toBe(0)
    expect(estimateReviewLoad(Number.NaN).etaSeconds).toBe(0)
    // 非法间隔 → 回退默认 120 天
    expect(estimateReviewLoad(1200, 0).avgIntervalDays).toBe(STEADY_STATE_AVG_INTERVAL_DAYS)
    expect(estimateReviewLoad(1200, -5).avgIntervalDays).toBe(STEADY_STATE_AVG_INTERVAL_DAYS)
    // 非法单次耗时 → 回退默认 8s
    expect(estimateReviewLoad(1200, 120, 0).secondsPerWord).toBe(SECONDS_PER_REVIEW)
  })

  it('自定义单次耗时：1200 词 @ 120 天 × 10s = 100 秒/天', () => {
    const load = estimateReviewLoad(1200, 120, 10)
    expect(load.etaSeconds).toBe(100)
  })

  it('单调性：词量越大，每日 ETA 越大', () => {
    expect(estimateReviewLoad(1000).etaSeconds).toBeLessThan(estimateReviewLoad(5000).etaSeconds)
    expect(estimateReviewLoad(5000).etaSeconds).toBeLessThan(estimateReviewLoad(20000).etaSeconds)
  })
})
