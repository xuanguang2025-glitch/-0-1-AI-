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
  audioFileName,
  durationFromBytes,
  durationFromVtt,
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
