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
