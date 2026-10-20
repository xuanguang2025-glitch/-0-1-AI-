/**
 * 写作规则检查引擎（T17，架构 §六 / Phase 2 设计）。
 *
 * **设计原则**：
 *   1. **纯函数**：不触 DB / AI / 网络。词典以 `knownWords` 参数注入（依赖反转），
 *      因此可完整单测（测试传一个小词典即可断言精确扣分）。
 *   2. **同步 + 确定性**：保存即算，< 200ms。AI 批改是异步增强，两者双轨
 *      （`scoreSource='rule' | 'ai'`），AI 不可用也永远有分可看。
 *   3. **扣分值全部具名常量**：测试直接断言数值，不允许「有扣分」这种模糊断言。
 *
 * 5 类检查与扣分（起始 100 分，逐项扣，下限 0）：
 *   - spelling      拼写错误：每个 5 分，上限 20
 *   - sentenceLength 句长超限（>25 词）：每句 5 分，上限 15
 *   - connectors    连接词不足（<2 个）：固定 10 分
 *   - paragraphs    段落不足（<3 段，仅对 ≥120 词的长文）：固定 10 分
 *   - passiveVoice  被动语态过多：每个 3 分，上限 12
 *
 * ⚠️ 已知局限（有意为之的工程取舍，非缺陷）：
 *   - 被动语态用 `be + 过去分词` 正则近似，会漏掉情态被动（should be done 可命中，
 *     ought to be done 漏）与少数形容词结构（is interested in）；
 *   - 拼写只查「完全不在词典且不在白名单」的词，专有名词/缩写需由白名单或
 *     `knownWords` 覆盖。宁可漏报也不误报——误报会让用户觉得引擎不可信。
 */

// ---------------------------------------------------------------------------
// 扣分常量（测试直接断言这些数值）
// ---------------------------------------------------------------------------

/** 拼写：每个错误扣 5 分，最多扣 20（即 4 个错误封顶） */
export const SPELLING_PER_ERROR = 5
export const SPELLING_MAX = 20

/** 句长：超过该词数的句子算「超长」，每句扣 5 分，最多扣 15 */
export const LONG_SENTENCE_WORDS = 25
export const SENTENCE_LENGTH_PER = 5
export const SENTENCE_LENGTH_MAX = 15

/** 连接词：全文不同连接词少于该个数扣 10 分 */
export const MIN_CONNECTORS = 2
export const CONNECTORS_DEDUCTION = 10

/** 段落：长文（≥该词数）段落少于 3 段扣 10 分 */
export const PARAGRAPH_MIN_WORDS = 120
export const PARAGRAPH_MIN_COUNT = 3
export const PARAGRAPHS_DEDUCTION = 10

/** 被动语态：每个扣 3 分，最多扣 12 */
export const PASSIVE_PER = 3
export const PASSIVE_MAX = 12

/** 常见连接词/过渡词表（小写匹配） */
export const CONNECTORS: readonly string[] = [
  'however', 'therefore', 'moreover', 'furthermore', 'besides', 'although', 'though',
  'because', 'since', 'while', 'whereas', 'in addition', 'for example', 'for instance',
  'as a result', 'in conclusion', 'on the other hand', 'in fact', 'nevertheless',
  'meanwhile', 'thus', 'hence', 'consequently', 'first', 'second', 'finally', 'also',
]

/** 不需要做拼写检查的词：缩写、常见专有名词、数字单位等 */
const SPELLING_WHITELIST: ReadonlySet<string> = new Set([
  'ai', 'api', 'cefr', 'cet', 'cet4', 'cet6', 'email', 'emails', 'internet', 'online',
  'offline', 'website', 'websites', 'wifi', 'app', 'apps', 'tv', 'pc', 'id', 'url',
  'ok', 'vs', 'etc', 'mr', 'mrs', 'ms', 'dr', 'prof', 'phd', 'ba', 'ma',
  'usa', 'uk', 'us', 'un', 'eu', 'ceo', 'hr', 'it', 'pdf', 'gps', 'lv',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
])

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type RuleKind = 'spelling' | 'sentenceLength' | 'connectors' | 'paragraphs' | 'passiveVoice'

export interface RuleIssue {
  rule: RuleKind
  /** 人类可读的问题描述 */
  message: string
  /** 该条问题的扣分（已按上限钳制后的**该类总计**，不是单项） */
  deduction: number
  /** 相关片段（出错单词 / 超长句子开头） */
  excerpt?: string
}

export interface RuleStats {
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  longSentences: number
  passiveCount: number
  /** 不同连接词个数 */
  connectorCount: number
  /** 拼写错误的单词（去重、小写） */
  spellingErrors: string[]
}

export interface RuleCheckResult {
  /** 0-100 */
  score: number
  issues: RuleIssue[]
  stats: RuleStats
  /** 是否通过基本检查（score ≥ 60 且无拼写错误） */
  passed: boolean
}

// ---------------------------------------------------------------------------
// 文本切分（确定性）
// ---------------------------------------------------------------------------

/** 按空白切词，仅保留含字母的词（去掉纯数字/标点） */
export function tokenizeWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, ''))
    .filter((w) => /[A-Za-z]/.test(w))
}

/** 按句末标点切句；无标点的长文本按 40 词硬切，避免整段被当成一句 */
export function splitSentences(text: string): string[] {
  const raw = text
    .replace(/\r/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const s of raw) {
    const words = tokenizeWords(s)
    if (words.length <= 40) {
      out.push(s)
      continue
    }
    // 硬切：每 40 词一段（只在没有句末标点时触发）
    for (let i = 0; i < words.length; i += 40) {
      out.push(words.slice(i, i + 40).join(' '))
    }
  }
  return out
}

/** 按空行/换行切段 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// 5 类检查（各自返回 null = 无问题，或返回带 deduction 的 issue）
// ---------------------------------------------------------------------------

/** 1. 拼写：不在词典、不在白名单、且不是「专有名词形态」的词 */
export function checkSpelling(text: string, knownWords: ReadonlySet<string>): RuleIssue | null {
  const seen = new Set<string>()
  const errors: string[] = []
  for (const w of tokenizeWords(text)) {
    const lower = w.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    if (SPELLING_WHITELIST.has(lower)) continue
    if (knownWords.has(lower)) continue
    // 容忍英文常见屈折：复数/三单/过去式直接去掉后缀再查一次
    const stem = lower.replace(/(?:es|s|ed|ing|ly)$/, '')
    if (stem.length >= 3 && knownWords.has(stem)) continue
    errors.push(lower)
  }
  if (errors.length === 0) return null
  return {
    rule: 'spelling',
    message: `发现 ${errors.length} 个疑似拼写错误`,
    deduction: Math.min(SPELLING_MAX, errors.length * SPELLING_PER_ERROR),
    excerpt: errors.slice(0, 5).join(', '),
  }
}

/** 2. 句长：超过 25 词的句子 */
export function checkSentenceLength(text: string): RuleIssue | null {
  const long = splitSentences(text).filter((s) => tokenizeWords(s).length > LONG_SENTENCE_WORDS)
  if (long.length === 0) return null
  return {
    rule: 'sentenceLength',
    message: `${long.length} 个句子超过 ${LONG_SENTENCE_WORDS} 词，建议拆分为短句`,
    deduction: Math.min(SENTENCE_LENGTH_MAX, long.length * SENTENCE_LENGTH_PER),
    excerpt: long[0]?.slice(0, 60),
  }
}

/** 3. 连接词：全文不同连接词个数不足 */
export function checkConnectors(text: string): RuleIssue | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `
  const found = CONNECTORS.filter((c) => lower.includes(` ${c} `) || lower.includes(` ${c},`) || lower.includes(` ${c}.`))
  const unique = new Set(found)
  if (unique.size >= MIN_CONNECTORS) return null
  return {
    rule: 'connectors',
    message: `连接词仅 ${unique.size} 个（建议至少 ${MIN_CONNECTORS} 个），行文连贯性不足`,
    deduction: CONNECTORS_DEDUCTION,
    excerpt: found.join(', ') || undefined,
  }
}

/** 4. 段落：长文段落数不足 */
export function checkParagraphs(text: string): RuleIssue | null {
  const wordCount = tokenizeWords(text).length
  if (wordCount < PARAGRAPH_MIN_WORDS) return null // 短文不强制分段
  const count = splitParagraphs(text).length
  if (count >= PARAGRAPH_MIN_COUNT) return null
  return {
    rule: 'paragraphs',
    message: `${wordCount} 词仅 ${count} 段，长文建议至少 ${PARAGRAPH_MIN_COUNT} 段`,
    deduction: PARAGRAPHS_DEDUCTION,
  }
}

/**
 * 常见不规则过去分词（be + 这类词也是被动语态）。
 * 只用 `-ed/-en` 正则会漏掉 sent / done / made / taken / given 等高频词，
 * 学生作文里这些恰恰最常见，因此显式列出。
 */
const IRREGULAR_PARTICIPLES =
  'written|done|made|taken|given|sent|seen|known|chosen|broken|spoken|driven|eaten|forgotten|' +
  'hidden|held|kept|left|lost|paid|said|sold|taught|thought|understood|built|bought|brought|' +
  'caught|felt|found|heard|cut|put|set|shut|split|thrown|worn|won|begun|blown|born|drawn|drunk|' +
  'flown|frozen|grown|risen|rung|shaken|shown|sunk|struck|sworn|torn|woken'

/** 5. 被动语态：be 动词 + 过去分词（正则近似） */
const PASSIVE_RE = new RegExp(
  `\\b(?:am|is|are|was|were|be|been|being)\\s+(?:[a-z]{3,}(?:ed|en)|${IRREGULAR_PARTICIPLES})\\b`,
  'gi',
)

export function checkPassiveVoice(text: string): RuleIssue | null {
  const matches = text.match(PASSIVE_RE)
  if (matches === null || matches.length === 0) return null
  return {
    rule: 'passiveVoice',
    message: `检测到 ${matches.length} 处被动语态，建议适当改为主动语态`,
    deduction: Math.min(PASSIVE_MAX, matches.length * PASSIVE_PER),
    excerpt: matches.slice(0, 3).join(' / '),
  }
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export interface RuleCheckOptions {
  /** 已知单词集合（小写 lemma）；传空集合则跳过拼写检查 */
  knownWords?: ReadonlySet<string>
}

/**
 * 执行全部 5 类检查并给出 0-100 分。
 *
 * @param text 用户作文（英文）
 * @param options.knownWords 词典（依赖注入；不传则不做拼写检查）
 */
export function runRuleCheck(text: string, options: RuleCheckOptions = {}): RuleCheckResult {
  const stats: RuleStats = {
    wordCount: tokenizeWords(text).length,
    sentenceCount: splitSentences(text).length,
    paragraphCount: splitParagraphs(text).length,
    longSentences: splitSentences(text).filter((s) => tokenizeWords(s).length > LONG_SENTENCE_WORDS).length,
    passiveCount: (text.match(PASSIVE_RE) ?? []).length,
    connectorCount: new Set(
      CONNECTORS.filter((c) => text.toLowerCase().includes(c)),
    ).size,
    spellingErrors: [],
  }

  const issues: RuleIssue[] = []

  // 拼写（仅在提供词典时检查）
  if (options.knownWords !== undefined) {
    const issue = checkSpelling(text, options.knownWords)
    if (issue) {
      issues.push(issue)
      stats.spellingErrors = (issue.excerpt ?? '').split(', ').filter(Boolean)
    }
  }

  for (const check of [checkSentenceLength, checkConnectors, checkParagraphs, checkPassiveVoice]) {
    const issue = check(text)
    if (issue) issues.push(issue)
  }

  const deduction = issues.reduce((n, i) => n + i.deduction, 0)
  const score = Math.max(0, 100 - deduction)

  return {
    score,
    issues,
    stats,
    // 通过线：≥60 分且无拼写错误（拼写是硬伤）
    passed: score >= 60 && stats.spellingErrors.length === 0,
  }
}
