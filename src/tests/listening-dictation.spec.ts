/**
 * listening-dictation.spec.ts — 听写比对（架构 L8 / DICTATION）纯函数。
 * 确定性输入 → 断言具体 diff 与 accuracy（不走 AI）。
 */
import { describe, expect, it } from 'vitest'

import { diffDictation, fuzzyMatch, levenshtein, normalizeToken, tokenize } from '@/services/listening/dictation'

describe('normalizeToken / tokenize', () => {
  it('小写化、统一弯撇号、去除首尾标点', () => {
    expect(normalizeToken('Hello,')).toBe('hello')
    expect(normalizeToken('“World!”')).toBe('world')
    expect(normalizeToken("Don’t")).toBe("don't")
    expect(normalizeToken('—')).toBe('')
  })

  it('tokenize 按空白切词并丢弃空 token', () => {
    expect(tokenize('  The cat   sat.  ')).toEqual(['the', 'cat', 'sat'])
    expect(tokenize('')).toEqual([])
  })
})

describe('diffDictation（词级对齐）', () => {
  it('完全正确 → 全 correct、accuracy=100', () => {
    const r = diffDictation('The cat sat on the mat', 'The cat sat on the mat')
    expect(r.diff).toHaveLength(6)
    expect(r.diff.every((d) => d.type === 'correct')).toBe(true)
    expect(r.correctCount).toBe(6)
    expect(r.accuracy).toBe(100)
    expect(r.totalCount).toBe(6)
    expect(r.missing + r.extra + r.substituted).toBe(0)
  })

  it('漏词 → missing，accuracy=83.3（5/6）', () => {
    const r = diffDictation('The cat sat on the mat', 'The cat on the mat')
    const missing = r.diff.filter((d) => d.type === 'missing')
    expect(missing).toHaveLength(1)
    expect(missing[0]).toMatchObject({ token: 'sat', type: 'missing' })
    expect(r.correctCount).toBe(5)
    expect(r.missing).toBe(1)
    expect(r.accuracy).toBe(83.3)
  })

  it('多词 → extra，accuracy=85.7（6/7，多写也降分）', () => {
    const r = diffDictation('The cat sat on the mat', 'The big cat sat on the mat')
    const extra = r.diff.filter((d) => d.type === 'extra')
    expect(extra).toHaveLength(1)
    expect(extra[0]).toMatchObject({ token: 'big', type: 'extra' })
    expect(r.correctCount).toBe(6)
    expect(r.extra).toBe(1)
    expect(r.accuracy).toBe(85.7)
  })

  it('替换 → wrong 且带 actual，accuracy=66.7（2/3）', () => {
    const r = diffDictation('The cat sat', 'The dog sat')
    const wrong = r.diff.filter((d) => d.type === 'wrong')
    expect(wrong).toHaveLength(1)
    expect(wrong[0]).toMatchObject({ token: 'cat', actual: 'dog', type: 'wrong' })
    expect(r.correctCount).toBe(2)
    expect(r.substituted).toBe(1)
    expect(r.accuracy).toBe(66.7)
  })

  it('标点/大小写差异不算错', () => {
    const r = diffDictation('Hello world!', 'hello world')
    expect(r.correctCount).toBe(2)
    expect(r.accuracy).toBe(100)
  })

  it('双空 → accuracy=100；原文空而用户有词 → 0', () => {
    expect(diffDictation('', '').accuracy).toBe(100)
    expect(diffDictation('', 'hello').accuracy).toBe(0)
  })

  it('diff.index 连续自增', () => {
    const r = diffDictation('a b c', 'a x c')
    expect(r.diff.map((d) => d.index)).toEqual([0, 1, 2])
  })
})

describe('levenshtein / fuzzyMatch', () => {
  it('levenshtein 基础', () => {
    expect(levenshtein('cat', 'cat')).toBe(0)
    expect(levenshtein('cat', 'cut')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })

  it('fuzzyMatch 容忍 1 字符（默认），大小写/标点不敏感', () => {
    expect(fuzzyMatch('umbrella', 'umbrela')).toBe(true) // 缺 1 字符
    expect(fuzzyMatch('Umbrella!', 'umbrella')).toBe(true)
    expect(fuzzyMatch('apple', 'orange')).toBe(false)
    expect(fuzzyMatch('apple', 'apple', 0)).toBe(true)
  })
})
