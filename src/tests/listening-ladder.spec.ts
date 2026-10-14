/**
 * listening-ladder.spec.ts — 听力难度阶梯 / 模式元数据 / 时间轴估算（架构 §5.2）。
 */
import { describe, expect, it } from 'vitest'

import {
  ALL_MODES,
  AUDIO_RATES,
  MODES,
  availableModes,
  countWords,
  difficultyForIntensity,
  estimatedDurationSec,
  estimateTimeline,
  modeMeta,
  recommendedRate,
  scaleTimeline,
  timelineForRate,
  timelineTotalSec,
  wpmForIntensity,
} from '@/services/listening/ladder'

describe('训练模式元数据（7 模式，Phase 2 可用 6）', () => {
  it('ALL_MODES 共 7 个；availableModes 恰好 6 个且不含 RETELL', () => {
    expect(ALL_MODES).toHaveLength(7)
    const avail = availableModes()
    expect(avail).toHaveLength(6)
    expect(avail).not.toContain('RETELL')
    expect(MODES.RETELL.available).toBe(false)
  })

  it('判分方式：DICTATION=diff、KEYWORD=fuzzy、客观题=objective、精听=none', () => {
    expect(modeMeta('DICTATION').judge).toBe('diff')
    expect(modeMeta('KEYWORD').judge).toBe('fuzzy')
    expect(modeMeta('CHOICE').judge).toBe('objective')
    expect(modeMeta('CLOZE').judge).toBe('objective')
    expect(modeMeta('INTENSIVE').judge).toBe('none')
  })

  it('CLOZE / KEYWORD 仅适用 2-4 档；CHOICE/EXTENSIVE/INTENSIVE/DICTATION 覆盖 1-4', () => {
    expect(modeMeta('CLOZE').levels).toEqual([2, 3, 4])
    expect(modeMeta('KEYWORD').levels).toEqual([2, 3, 4])
    expect(modeMeta('CHOICE').levels).toEqual([1, 2, 3, 4])
    expect(modeMeta('DICTATION').levels).toEqual([1, 2, 3, 4])
  })
})

describe('难度阶梯映射（§5.2）', () => {
  it('语速档固定为 [0.75, 1.0, 1.25]', () => {
    expect(AUDIO_RATES).toEqual([0.75, 1.0, 1.25])
  })

  it('recommendedRate：1/2 档 → 1.0；3/4 档 → 0.75', () => {
    expect(recommendedRate(1)).toBe(1.0)
    expect(recommendedRate(2)).toBe(1.0)
    expect(recommendedRate(3)).toBe(0.75)
    expect(recommendedRate(4)).toBe(0.75)
  })

  it('difficultyForIntensity：1→EASY，2→MEDIUM，3/4→HARD', () => {
    expect(difficultyForIntensity(1)).toBe('EASY')
    expect(difficultyForIntensity(2)).toBe('MEDIUM')
    expect(difficultyForIntensity(3)).toBe('HARD')
    expect(difficultyForIntensity(4)).toBe('HARD')
  })

  it('wpmForIntensity：100 / 130 / 150 / 160', () => {
    expect(wpmForIntensity(1)).toBe(100)
    expect(wpmForIntensity(2)).toBe(130)
    expect(wpmForIntensity(3)).toBe(150)
    expect(wpmForIntensity(4)).toBe(160)
  })
})

describe('字幕时间轴估算（按词数比例，不用 TTS 输出）', () => {
  it('每句时长 = 词数/wpm×60，最短 2 秒；起点累加', () => {
    const tl = estimateTimeline(
      [
        { en: 'One two three', zh: '一二三' }, // 3 词 @120 → 1.5s → 抬高到 2s
        { en: 'One two three four five six', zh: '一至六' }, // 6 词 @120 → 3s
      ],
      120,
    )
    expect(tl[0]).toMatchObject({ startSec: 0, endSec: 2, en: 'One two three' })
    expect(tl[1]).toMatchObject({ startSec: 2, endSec: 5 })
  })

  it('estimatedDurationSec / countWords', () => {
    const lines = [
      { en: 'Good morning everyone', zh: '大家早上好' }, // 3 词
      { en: 'Welcome to the show', zh: '欢迎收看' }, // 4 词
    ]
    expect(countWords(lines)).toBe(7)
    expect(estimatedDurationSec(lines, 60)).toBeGreaterThan(0)
  })

  it('wpm 非法时回退 120，不抛错', () => {
    expect(estimateTimeline([{ en: 'a b', zh: '' }], 0)[0]?.endSec).toBe(2)
  })
})

/**
 * R2-9：时间轴必须与播放倍速同向。
 *
 * 背景（架构师裁决）：`wpmForIntensity()` 随档递增（100/130/150/160），而
 * `recommendedRate()` 给 L3/L4 返回 0.75× 减速——两者方向相反。旧实现只按 wpm
 * 估算、完全不看 rate，导致用户按 0.75× 播放时真实音频比字幕长 1/0.75 ≈ 1.33 倍，
 * **字幕整体跑在音频前面**（越听越超前）。
 *
 * 修复口径：
 *   ① 有 `listening_audio_assets.durationSec` → 按真实总时长等比缩放；
 *   ② 无资产 → 估算式改为 `词数 / (wpm × rate) × 60`，倍速越低每句墙钟时长越长。
 */
describe('R2-9 时间轴与倍速同向（estimateTimeline 的 rate 入参）', () => {
  const lines = [
    { en: 'One two three four five six seven eight', zh: '八' }, // 8 词
    { en: 'One two three four five six seven eight nine ten', zh: '十' }, // 10 词
  ]

  it('同一 wpm 下：rate 越小总时长越长（0.75× 比 1.0× 长 1/0.75 倍）', () => {
    const t1 = timelineTotalSec(estimateTimeline(lines, 120, 1))
    const t075 = timelineTotalSec(estimateTimeline(lines, 120, 0.75))
    const t125 = timelineTotalSec(estimateTimeline(lines, 120, 1.25))
    expect(t075).toBeGreaterThan(t1)
    expect(t1).toBeGreaterThan(t125)
    // 无 2s 下限钳制时严格等于 1/rate
    expect(t075 / t1).toBeCloseTo(1 / 0.75, 5)
    expect(t125 / t1).toBeCloseTo(1 / 1.25, 5)
  })

  it('方向一致性：L3/L4 的 recommendedRate(0.75) 估算必须长于 1.0× 估算', () => {
    for (const level of [3, 4]) {
      const rate = recommendedRate(level)
      expect(rate).toBe(0.75)
      const slow = timelineTotalSec(estimateTimeline(lines, wpmForIntensity(level), rate))
      const normal = timelineTotalSec(estimateTimeline(lines, wpmForIntensity(level), 1))
      expect(slow).toBeGreaterThan(normal)
    }
    // L1/L2 推荐 1.0×，两者相等（不引入无谓的缩放）
    expect(timelineTotalSec(estimateTimeline(lines, wpmForIntensity(1), recommendedRate(1))))
      .toBe(timelineTotalSec(estimateTimeline(lines, wpmForIntensity(1), 1)))
  })

  it('rate 非法（≤0）时回退 1.0，不抛错也不产生负时长', () => {
    const tl = estimateTimeline(lines, 120, 0)
    expect(tl.every((l) => l.endSec > l.startSec && l.startSec >= 0)).toBe(true)
    expect(timelineTotalSec(tl)).toBe(timelineTotalSec(estimateTimeline(lines, 120, 1)))
  })
})

describe('R2-9 timelineForRate：真实资产优先，fallback 方向一致', () => {
  const baseline = estimateTimeline(
    [
      { en: 'One two three four five six seven eight', zh: '八' },
      { en: 'One two three four five six seven eight nine ten', zh: '十' },
    ],
    120,
    1,
  )
  const baseTotal = timelineTotalSec(baseline) // 4 + 5 = 9s

  it('① 有真实资产 → 用真实时长（总时长严格等于资产时长）', () => {
    const real = 12.5
    const tl = timelineForRate(baseline, 120, 0.75, real)
    expect(timelineTotalSec(tl)).toBeCloseTo(real, 1)
    // 行间比例保持不变（第 2 行仍占 5/9）
    expect(tl[1]?.startSec ?? 0).toBeCloseTo((real * 4) / 9, 1)
    expect(tl[0]?.en).toBe(baseline[0]?.en)
  })

  it('①b 真实资产短于估算时按比例压缩（不硬撑到估算值）', () => {
    const tl = timelineForRate(baseline, 120, 1, 6)
    expect(timelineTotalSec(tl)).toBeCloseTo(6, 1)
    expect(tl[1]?.endSec ?? 0).toBeLessThan(baseTotal)
  })

  it('② 无资产 → 按 rate 重新估算，0.75× 总时长 ≈ 基准 / 0.75', () => {
    const tl = timelineForRate(baseline, 120, 0.75, null)
    expect(timelineTotalSec(tl)).toBeCloseTo(baseTotal / 0.75, 1)
    // 且比 1.0× 基准更长（R2-9 的核心断言：不会再「字幕跑在音频前面」）
    expect(timelineTotalSec(tl)).toBeGreaterThan(baseTotal)
  })

  it('②b 无资产且 rate=1 → 与原估算完全一致（不破坏既有口径）', () => {
    const tl = timelineForRate(baseline, 120, 1, null)
    expect(tl).toEqual(baseline)
  })

  it('边界：空时间轴 / 非法资产值不抛错', () => {
    expect(timelineForRate([], 120, 0.75, null)).toEqual([])
    expect(timelineForRate([], 120, 0.75, 30)).toEqual([])
    expect(timelineForRate(baseline, 120, 0.75, 0)).toHaveLength(baseline.length)
    expect(timelineForRate(baseline, 120, 0.75, -5)).toHaveLength(baseline.length)
  })
})

describe('scaleTimeline：等比缩放', () => {
  it('按总时长等比缩放，行间比例与文案不变', () => {
    const tl = estimateTimeline(
      [
        { en: 'a b c d', zh: '' }, // 4 词 @120 → 2s
        { en: 'a b c d e f', zh: '' }, // 6 词 @120 → 3s
      ],
      120,
    )
    const scaled = scaleTimeline(tl, 15)
    expect(timelineTotalSec(scaled)).toBeCloseTo(15, 1)
    expect(scaled[0]?.endSec ?? 0).toBeCloseTo(6, 1) // 2/5 × 15
    expect(scaled[1]?.endSec ?? 0).toBeCloseTo(15, 1)
    expect(scaled.map((l) => l.en)).toEqual(tl.map((l) => l.en))
  })

  it('总时长 ≤0 或空输入时原样返回拷贝（不改入参）', () => {
    const tl = estimateTimeline([{ en: 'a b', zh: '' }], 120)
    const out = scaleTimeline(tl, 0)
    expect(out).toEqual(tl)
    expect(out).not.toBe(tl)
    expect(scaleTimeline([], 10)).toEqual([])
  })
})
