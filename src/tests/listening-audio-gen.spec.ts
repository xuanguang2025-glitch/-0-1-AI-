/**
 * listening-audio-gen.spec.ts — 音频生成脚本纯函数（T13）。
 *
 * 覆盖：文件名/倍速参数映射、朗读稿组装、时长推导（vtt / 字节）。
 * 这些函数决定 `listening_audio_assets.durationSec` 的口径，而 R2-9 的
 * 字幕时间轴正是按该真实时长缩放的——口径错了字幕就会整体偏移。
 */
import { describe, expect, it } from 'vitest'

import {
  RATES,
  TRUNCATION_RATIO,
  audioFileName,
  countWords,
  durationFromBytes,
  durationFromVtt,
  estimateSpeechSec,
  looksTruncated,
  materialText,
  rateFlag,
  rateTag,
  slugify,
} from '../../scripts/gen-listening-audio'

describe('音频文件名与倍速映射', () => {
  it('三档固定 [0.75, 1.0, 1.25]，文件名后缀 075/100/125', () => {
    expect(RATES).toEqual([0.75, 1.0, 1.25])
    expect(rateTag(0.75)).toBe('075')
    expect(rateTag(1.0)).toBe('100')
    expect(rateTag(1.25)).toBe('125')
    expect(audioFileName('ordering-coffee', 0.75)).toBe('ordering-coffee_075.mp3')
  })

  it('rateFlag：0.75→-25%、1.0→+0%、1.25→+25%', () => {
    expect(rateFlag(0.75)).toBe('-25%')
    expect(rateFlag(1.0)).toBe('+0%')
    expect(rateFlag(1.25)).toBe('+25%')
  })

  it('slugify 与 seed 同口径（小写、非字母数字转连字符、去首尾）', () => {
    expect(slugify('Ordering Coffee at a Café')).toBe('ordering-coffee-at-a-caf')
    expect(slugify('  A  News Report!  ')).toBe('a-news-report')
  })

  it('朗读稿 = 字幕逐句拼接（句间空格，保证自然停顿）', () => {
    const text = materialText({
      id: 'x', title: 'x', category: 'daily', difficulty: 'EASY', cefr: 'A2',
      intensityLevel: 1, tags: [], focusPoints: [], questions: [],
      lines: [{ en: ' Hello. ', zh: '你好。' }, { en: 'Bye.', zh: '再见。' }],
    })
    expect(text).toBe('Hello. Bye.')
  })
})

describe('时长推导', () => {
  it('durationFromVtt：取末条 cue 的结束时间', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:04.800',
      'Good morning.',
      '',
      '00:00:04.800 --> 00:00:09.600',
      'I would like a latte.',
      '',
    ].join('\n')
    expect(durationFromVtt(vtt)).toBeCloseTo(9.6, 3)
  })

  it('durationFromVtt：无 cue / 空串 → null（交由字节估算兜底）', () => {
    expect(durationFromVtt('WEBVTT\n\n')).toBeNull()
    expect(durationFromVtt('')).toBeNull()
  })

  it('durationFromBytes：24kHz/48kbps 单声道口径，至少 1 秒', () => {
    // 48000bps → 6000B/s
    expect(durationFromBytes(60_000)).toBe(10)
    expect(durationFromBytes(0)).toBe(1)
    expect(durationFromBytes(100)).toBe(1)
  })
})

/**
 * 截断自愈（QA 第六轮 P1：lm-36 @1.25 仅 4.08s/170 帧，幂等 skip 永久放过它）。
 * 阈值标定：179 个正常文件 ratio ∈ [0.579, 1.460]（p05=0.625），唯一截断样本 0.245。
 */
describe('截断检测 looksTruncated（QA 第六轮转正条件）', () => {
  it('阈值本身有裕量：低于最低正常样本 0.579，高于截断样本 0.245', () => {
    expect(TRUNCATION_RATIO).toBeGreaterThan(0.245)
    expect(TRUNCATION_RATIO).toBeLessThan(0.579)
  })

  it('estimateSpeechSec 随倍速反向变化（0.75× 比 1.25× 长）', () => {
    const slow = estimateSpeechSec(50, 3, 0.75)
    const normal = estimateSpeechSec(50, 3, 1)
    const fast = estimateSpeechSec(50, 3, 1.25)
    expect(slow).toBeGreaterThan(normal)
    expect(normal).toBeGreaterThan(fast)
    // 50 词 @wpm150 → 1.0× 20s
    expect(normal).toBeCloseTo(20, 5)
  })

  it('抓住真实截断样本：lm-36 @1.25（51 词，实测仅 4s）', () => {
    expect(looksTruncated(4, 51, 3, 1.25)).toBe(true)
  })

  it('不误杀正常样本：同篇 075=29s / 100=21s 均判为正常', () => {
    expect(looksTruncated(29, 51, 3, 0.75)).toBe(false)
    expect(looksTruncated(21, 51, 3, 1)).toBe(false)
  })

  it('不误杀标定集里的最低正常样本（ratio 0.579）', () => {
    // lm-17：36 词 L? → est(0.75)≈28.8s，实测 17s → ratio 0.59
    expect(looksTruncated(17, 36, 1, 0.75)).toBe(false)
  })

  it('words<=0（无词数信息）时不做判断，避免误杀', () => {
    expect(looksTruncated(1, 0, 3, 1.25)).toBe(false)
  })

  it('countWords 与朗读稿口径一致', () => {
    expect(countWords('  Hello   world  ')).toBe(2)
    expect(countWords('')).toBe(0)
    expect(countWords(materialText({
      id: 'x', title: 'x', category: 'daily', difficulty: 'EASY', cefr: 'A2',
      intensityLevel: 1, tags: [], focusPoints: [], questions: [],
      lines: [{ en: 'One two', zh: '' }, { en: 'Three', zh: '' }],
    }))).toBe(3)
  })
})
