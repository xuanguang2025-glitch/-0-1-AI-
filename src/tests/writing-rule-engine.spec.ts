/**
 * writing-rule-engine.spec.ts — 写作规则引擎单测（T17 验收 2）。
 *
 * **本 spec 的核心要求：断言具体扣分值**，不是「有扣分」。
 * 每类检查至少 1 个用例，并覆盖上限钳制、组合扣分、边界（空文本/纯标点）。
 */
import { describe, expect, it } from 'vitest'

import {
  CONNECTORS,
  CONNECTORS_DEDUCTION,
  LONG_SENTENCE_WORDS,
  PARAGRAPHS_DEDUCTION,
  PASSIVE_MAX,
  PASSIVE_PER,
  SENTENCE_LENGTH_MAX,
  SENTENCE_LENGTH_PER,
  SPELLING_MAX,
  SPELLING_PER_ERROR,
  checkConnectors,
  checkParagraphs,
  checkPassiveVoice,
  checkSentenceLength,
  checkSpelling,
  runRuleCheck,
  splitParagraphs,
  splitSentences,
  tokenizeWords,
} from '@/services/writing/rule-engine'

/**
 * 用词典内的词拼一个 N 词长句（避免填充词本身触发拼写扣分干扰断言）。
 */
function longSentenceOf(n: number): string {
  const pool = ['students', 'study', 'hard', 'every', 'day', 'and', 'the', 'school', 'work', 'books']
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]!).join(' ')
}
const DICT = new Set([
  // 功能词
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'have', 'has', 'had',
  'i', 'we', 'they', 'it', 'this', 'that', 'my', 'our', 'us', 'him', 'her', 'his', 'she', 'he',
  'and', 'or', 'but', 'however', 'therefore', 'of', 'to', 'for', 'with', 'without', 'from', 'at', 'on', 'in', 'by',
  'can', 'should', 'will', 'would', 'do', 'does', 'did', 'not', 'no', 'yes', 'so', 'if', 'when',
  // 常用名词/动词/形容词/副词
  'students', 'student', 'study', 'studied', 'studying', 'studys', 'learning', 'learn', 'school', 'schools',
  'important', 'very', 'much', 'more', 'most', 'good', 'bad', 'new', 'old', 'year', 'years',
  'time', 'day', 'days', 'people', 'work', 'working', 'works', 'hard', 'every', 'daily', 'often',
  'love', 'loves', 'like', 'likes', 'reading', 'read', 'books', 'book', 'library', 'librarian',
  'teacher', 'teachers', 'letter', 'letters', 'author', 'authors', 'famous', 'kind', 'nice',
  'use', 'used', 'using', 'useful', 'grow', 'grows', 'growing', 'vocabulary', 'fast', 'slowly',
  'surely', 'task', 'tasks', 'job', 'jobs', 'plan', 'plans', 'make', 'makes', 'start', 'starts',
  'finish', 'finishes', 'recommend', 'recommends', 'recommend', 'send', 'sends', 'delivered',
  'twenty', 'minutes', 'night', 'enough', 'found', 'researchers', 'sleep', 'write', 'writing',
  'wrote', 'written', 'done', 'made', 'sent', 'taken', 'given', 'built', 'kept', 'help',
  // 多词连接词的组成词（checkSpelling 按单词切分，不会把 "for example" 当整体）
  'example', 'as', 'result', 'addition', 'instance', 'conclusion', 'hand', 'fact', 'first', 'second', 'finally', 'also',
  // 组合用例文本中的词（保持拼写项只抓有意放入的错误词）
  'still', 'enjoy', 'enjoys', 'therefore', 'however',
])

// ---------------------------------------------------------------------------
// 文本切分
// ---------------------------------------------------------------------------

describe('文本切分', () => {
  it('tokenizeWords 去掉纯标点/数字词，保留含字母词', () => {
    expect(tokenizeWords('Hello, world! 123 -- test')).toEqual(['Hello', 'world', 'test'])
  })

  it('splitSentences 按句末标点切分', () => {
    expect(splitSentences('One two. Three four! Five?')).toEqual(['One two.', 'Three four!', 'Five?'])
  })

  it('splitSentences 对无标点长文本按 40 词硬切（不把整段当一句）', () => {
    const words = Array.from({ length: 85 }, (_, i) => `w${i}`).join(' ')
    const s = splitSentences(words)
    expect(s).toHaveLength(3) // 40 + 40 + 5
    expect(tokenizeWords(s[2]!)).toHaveLength(5)
  })

  it('splitParagraphs 按空行切段', () => {
    expect(splitParagraphs('Para one.\n\nPara two.\n\n\nPara three.')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// 1. 拼写：断言具体扣分值
// ---------------------------------------------------------------------------

describe('spelling 拼写检查（每错 5 分，上限 20）', () => {
  it('1 个拼写错误 → 扣 5 分（断言具体值）', () => {
    const issue = checkSpelling('I lovve my school.', DICT)
    expect(issue).not.toBeNull()
    expect(issue?.rule).toBe('spelling')
    expect(issue?.deduction).toBe(SPELLING_PER_ERROR) // 5
    expect(issue?.excerpt).toContain('lovve')
  })

  it('3 个拼写错误 → 扣 15 分（线性累加）', () => {
    const issue = checkSpelling('lovve scool and teecher.', DICT)
    expect(issue?.deduction).toBe(15)
  })

  it('5 个拼写错误 → 触上限 20 分（不是 25）', () => {
    const issue = checkSpelling('lovve scool teecher tesis reserch.', DICT)
    expect(issue?.deduction).toBe(SPELLING_MAX) // 20
  })

  it('全对 → null（不误报）', () => {
    expect(checkSpelling('I love my school and my teacher.', DICT)).toBeNull()
  })

  it('屈折形态走词干再查一次：studys/studying 不误报', () => {
    expect(checkSpelling('The student studys hard and is studying.', DICT)).toBeNull()
  })

  it('白名单词（cefr / ai / wifi）不误报', () => {
    expect(checkSpelling('We use AI and WiFi for CEFR study.', DICT)).toBeNull()
  })

  it('重复错误只计一次（dedup）', () => {
    const issue = checkSpelling('lovve lovve lovve', DICT)
    expect(issue?.deduction).toBe(SPELLING_PER_ERROR) // 5 而非 15
  })
})

// ---------------------------------------------------------------------------
// 2. 句长：断言具体扣分值
// ---------------------------------------------------------------------------

describe('sentenceLength 句长检查（每句 5 分，上限 15）', () => {
  it('1 个 26 词长句 → 扣 5 分', () => {
    const long = Array.from({ length: 26 }, (_, i) => `w${i}`).join(' ')
    const issue = checkSentenceLength(`${long}.`)
    expect(issue?.deduction).toBe(SENTENCE_LENGTH_PER) // 5
    expect(issue?.message).toContain('1 个句子')
  })

  it('正好 25 词不扣（边界：> 25 才算超长）', () => {
    const exact = Array.from({ length: LONG_SENTENCE_WORDS }, (_, i) => `w${i}`).join(' ')
    expect(checkSentenceLength(`${exact}.`)).toBeNull()
  })

  it('4 个长句 → 触上限 15 分（不是 20）', () => {
    const long = `${Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')}.`
    const issue = checkSentenceLength(Array.from({ length: 4 }, () => long).join(' '))
    expect(issue?.deduction).toBe(SENTENCE_LENGTH_MAX) // 15
  })
})

// ---------------------------------------------------------------------------
// 3. 连接词：固定 10 分
// ---------------------------------------------------------------------------

describe('connectors 连接词检查（不足扣 10 分）', () => {
  it('0 个连接词 → 扣 10 分', () => {
    const issue = checkConnectors('I like reading. Books are good. I read every day.')
    expect(issue?.deduction).toBe(CONNECTORS_DEDUCTION) // 10
    expect(issue?.message).toContain('连接词仅 0 个')
  })

  it('1 个连接词仍不足 → 扣 10 分（阈值是 ≥2）', () => {
    const issue = checkConnectors('I like reading. However, books are good.')
    expect(issue?.deduction).toBe(CONNECTORS_DEDUCTION)
    expect(issue?.message).toContain('连接词仅 1 个')
  })

  it('2 个不同连接词 → 通过（null）', () => {
    expect(checkConnectors('I like reading. However, books are good. Therefore I read daily.')).toBeNull()
  })

  it('同一连接词重复出现只算 1 个', () => {
    const issue = checkConnectors('However I read. However I write. However I sleep.')
    expect(issue?.deduction).toBe(CONNECTORS_DEDUCTION)
    expect(issue?.message).toContain('连接词仅 1 个')
  })

  it('CONNECTORS 表本身非空且含常用项', () => {
    expect(CONNECTORS.length).toBeGreaterThan(10)
    expect(CONNECTORS).toContain('however')
    expect(CONNECTORS).toContain('therefore')
  })
})

// ---------------------------------------------------------------------------
// 4. 段落：固定 10 分（仅长文）
// ---------------------------------------------------------------------------

describe('paragraphs 段落检查（长文不足 3 段扣 10 分）', () => {
  it('130 词但只有 1 段 → 扣 10 分', () => {
    const text = Array.from({ length: 130 }, (_, i) => `word${i}`).join(' ')
    const issue = checkParagraphs(text)
    expect(issue?.deduction).toBe(PARAGRAPHS_DEDUCTION) // 10
    expect(issue?.message).toContain('130 词仅 1 段')
  })

  it('130 词分 3 段 → 通过', () => {
    const para = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ')
    expect(checkParagraphs(`${para}\n\n${para}\n\n${para}`)).toBeNull()
  })

  it('短文（<120 词）不强制分段 → 不误报', () => {
    expect(checkParagraphs('Just one short paragraph with few words.')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. 被动语态：每个 3 分，上限 12
// ---------------------------------------------------------------------------

describe('passiveVoice 被动语态检查（每个 3 分，上限 12）', () => {
  it('1 处被动 → 扣 3 分', () => {
    const issue = checkPassiveVoice('The book was written by a famous author.')
    expect(issue?.deduction).toBe(PASSIVE_PER) // 3
    expect(issue?.excerpt).toContain('was written')
  })

  it('2 处被动 → 扣 6 分', () => {
    const issue = checkPassiveVoice('The book was written by him. The letter is sent daily.')
    expect(issue?.deduction).toBe(6)
  })

  it('5 处被动 → 触上限 12 分（不是 15）', () => {
    const text = Array.from({ length: 5 }, (_, i) => `The task${i} was finished quickly.`).join(' ')
    expect(checkPassiveVoice(text)?.deduction).toBe(PASSIVE_MAX) // 12
  })

  it('主动语态 → null（is reading 不是被动）', () => {
    expect(checkPassiveVoice('She is reading a book in the library.')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 主入口 runRuleCheck：组合扣分与总分
// ---------------------------------------------------------------------------

describe('runRuleCheck 组合扣分', () => {
  it('干净文本 → 100 分、无问题、passed=true', () => {
    const text =
      'However, reading is important for students. Therefore, we should read every day. ' +
      'For example, books in the library are very useful. As a result, our vocabulary grows fast. ' +
      'In addition, teachers often recommend new books to us.'
    const r = runRuleCheck(text, { knownWords: DICT })
    expect(r.score).toBe(100)
    expect(r.issues).toHaveLength(0)
    expect(r.passed).toBe(true)
  })

  it('仅拼写 2 个错误 → 90 分（扣分依据：2 × SPELLING_PER_ERROR=5）', () => {
    // 文本刻意含 however + therefore 两个**表内**连接词（and 是并列连词，
    // 不在 CONNECTORS 语篇连接词表里——设计如此），避免触发 connectors 扣分以隔离拼写项
    const r = runRuleCheck('However, I lovve my scool and my teacher is kind. Therefore, I still enjoy it.', { knownWords: DICT })
    expect(r.issues.map((i) => i.rule)).toEqual(['spelling'])
    expect(r.issues[0]?.deduction).toBe(10) // 2 × 5
    expect(r.score).toBe(90) // 100 - 10
    // passed 要求「无拼写错误」：有 2 个 → 即使 90 分也不算通过
    expect(r.passed).toBe(false)
  })

  it('拼写(5) + 句长(5) + 连接词(10) → 80 分（三类叠加）', () => {
    // 长句用词典内词拼，避免填充词触发拼写扣满 20 干扰断言
    const text = `I lovve reading. ${longSentenceOf(26)}.`
    const r = runRuleCheck(text, { knownWords: DICT })
    expect(r.score).toBe(80)
    expect(r.issues.map((i) => i.rule).sort()).toEqual(['connectors', 'sentenceLength', 'spelling'])
    // 每类 deduction 之和 == 100 - score
    expect(r.issues.reduce((n, i) => n + i.deduction, 0)).toBe(20)
  })

  it('全部 5 类齐发 → 各扣分累加（5+5+10+10+3=33）→ 67 分', () => {
    // 扣分依据：
    //   spelling      1 错（lovve）→ 5
    //   sentenceLength 1 个 30 词长句（词典内词拼装）→ 5
    //   connectors    全文 0 连接词 → 10
    //   paragraphs    130+ 词仅 1 段 → 10
    //   passiveVoice  1 处（was written）→ 3
    // 合计 33 → 100 - 33 = 67
    // 填充段用词典内词且每 10 词加句号：不额外触发拼写/长句
    const fillerSentences = Array.from({ length: 13 }, () => 'students study hard every day and the school work books.').join(' ')
    const text = [
      'I lovve reading.',
      `${longSentenceOf(30)}.`,
      fillerSentences,
      'The book was written by him.',
    ].join(' ')
    const r = runRuleCheck(text, { knownWords: DICT })
    expect(r.issues.map((i) => i.rule).sort()).toEqual([
      'connectors', 'paragraphs', 'passiveVoice', 'sentenceLength', 'spelling',
    ])
    expect(r.issues.reduce((n, i) => n + i.deduction, 0)).toBe(33)
    expect(r.score).toBe(67)
    expect(r.passed).toBe(false) // 67 < 60 → false
  })

  it('扣分总和永不超过 100（下限钳制到 0）', () => {
    // 构造极端文本：拼写 20 + 句长 15 + 连接词 10 + 段落 10 + 被动 12 = 67
    const longSentence = `${Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')}.`
    const text = [
      'lovve scool teecher tesis reserch qwerty.',
      longSentence, longSentence, longSentence, longSentence,
      Array.from({ length: 130 }, (_, i) => `filler${i}`).join(' '),
      'The task was finished. The job was done. The work was started. The plan was made. The book was written.',
    ].join(' ')
    const r = runRuleCheck(text, { knownWords: DICT })
    const total = r.issues.reduce((n, i) => n + i.deduction, 0)
    expect(total).toBeGreaterThan(0)
    expect(r.score).toBe(Math.max(0, 100 - total))
    expect(r.score).toBeGreaterThanOrEqual(0)
  })

  it('stats 统计准确（词数/句数/段数/长句/被动/连接词/拼写）', () => {
    const text = 'However, I lovve reading. The book was written by him.'
    const r = runRuleCheck(text, { knownWords: DICT })
    expect(r.stats.wordCount).toBe(10)
    expect(r.stats.sentenceCount).toBe(2)
    expect(r.stats.passiveCount).toBe(1)
    expect(r.stats.connectorCount).toBe(1)
    expect(r.stats.spellingErrors).toEqual(['lovve'])
  })

  it('不传 knownWords → 跳过拼写检查（不误报整篇）', () => {
    const r = runRuleCheck('I lovve my scool.')
    expect(r.stats.spellingErrors).toEqual([])
    expect(r.issues.some((i) => i.rule === 'spelling')).toBe(false)
  })

  it('空文本 → 0 问题但连接词会扣 10 分（空文确实不合规）', () => {
    const r = runRuleCheck('', { knownWords: DICT })
    expect(r.stats.wordCount).toBe(0)
    expect(r.score).toBe(90)
    expect(r.issues.map((i) => i.rule)).toEqual(['connectors'])
  })
})
