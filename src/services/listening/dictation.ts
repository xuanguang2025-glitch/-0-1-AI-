/**
 * 听力听写比对（架构 §3.1 L8 / §5.2 DICTATION 模式）。
 *
 * 关键决策：听写批改是**确定性问题**（字符串 diff），**不走 AI**——零成本、零延迟、无降级问题。
 * 本模块为纯函数，单测断言具体 diff 与 accuracy。
 */

export type DictationTokenType = 'correct' | 'wrong' | 'missing' | 'extra'

export interface DictationToken {
  /** 结果序列中的位置（从 0 起） */
  index: number
  /** 展示用词（correct/wrong/missing 取原文词；extra 取用户词） */
  token: string
  type: DictationTokenType
  /** wrong 时为用户实际写出的词 */
  actual?: string
}

export interface DictationResult {
  diff: DictationToken[]
  /** 正确率 0-100（保留 1 位小数）= correct / max(原文词数, 用户词数) */
  accuracy: number
  correctCount: number
  /** 原文词数 */
  totalCount: number
  substituted: number
  missing: number
  extra: number
}

const APOSTROPHES = /[\u2018\u2019\u02bc\u2032]/g

/** 归一化单个词：小写、统一撇号、去掉首尾非字母数字字符（保留词内连字符/撇号） */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(/^[^a-z0-9']+/, '')
    .replace(/[^a-z0-9']+$/, '')
}

/** 按空白切词（保留原文词用于展示） */
function splitWords(text: string): string[] {
  const trimmed = text.trim()
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/)
}

/** 词级 token 化（归一化后、去空） */
export function tokenize(text: string): string[] {
  return splitWords(text).map(normalizeToken).filter((t) => t.length > 0)
}

/**
 * 听写比对（Levenshtein 对齐）：
 * - correct  原文与用户一致
 * - wrong    原文词被替换（substitute）
 * - missing  原文词缺失（delete）
 * - extra    用户多写（insert）
 *
 * 对齐确定性：回溯优先级为「对角(替换/一致) → 上(缺失) → 左(多余)」。
 */
export function diffDictation(original: string, dictation: string): DictationResult {
  const origWords = splitWords(original)
  const dictWords = splitWords(dictation)
  const a = origWords.map(normalizeToken)
  const b = dictWords.map(normalizeToken)
  const m = a.length
  const n = b.length

  // DP 编辑距离矩阵
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j - 1]! + cost, dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1)
    }
  }

  // 回溯
  type Op = { type: DictationTokenType; oi?: number; di?: number }
  const ops: Op[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      if (dp[i]![j] === dp[i - 1]![j - 1]! + cost) {
        ops.push({ type: cost === 0 ? 'correct' : 'wrong', oi: i - 1, di: j - 1 })
        i -= 1
        j -= 1
        continue
      }
    }
    if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      ops.push({ type: 'missing', oi: i - 1 })
      i -= 1
      continue
    }
    if (j > 0) {
      ops.push({ type: 'extra', di: j - 1 })
      j -= 1
      continue
    }
    // 理论不可达兜底
    if (i > 0) {
      ops.push({ type: 'missing', oi: i - 1 })
      i -= 1
    }
  }
  ops.reverse()

  const diff: DictationToken[] = []
  let correctCount = 0
  let substituted = 0
  let missing = 0
  let extra = 0
  ops.forEach((op, index) => {
    const token = op.oi !== undefined ? (origWords[op.oi] ?? '') : (dictWords[op.di ?? 0] ?? '')
    const entry: DictationToken = { index, token, type: op.type }
    if (op.type === 'wrong' && op.di !== undefined) entry.actual = dictWords[op.di] ?? ''
    diff.push(entry)
    if (op.type === 'correct') correctCount += 1
    else if (op.type === 'wrong') substituted += 1
    else if (op.type === 'missing') missing += 1
    else extra += 1
  })

  const denominator = Math.max(m, n, 1)
  const accuracy = m === 0 && n === 0 ? 100 : Math.round((correctCount / denominator) * 1000) / 10

  return { diff, accuracy, correctCount, totalCount: m, substituted, missing, extra }
}

/** Levenshtein 距离（关键词模糊匹配用） */
export function levenshtein(a: string, b: string): number {
  const s = a
  const t = b
  const n = s.length
  const mm = t.length
  if (n === 0) return mm
  if (mm === 0) return n
  let prev = Array.from({ length: mm + 1 }, (_, j) => j)
  for (let i = 1; i <= n; i++) {
    const curr = new Array<number>(mm + 1).fill(0)
    curr[0] = i
    for (let j = 1; j <= mm; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }
  return prev[mm]!
}

/** 关键词模糊匹配（默认容忍 1 个字符差异，大小写/标点不敏感） */
export function fuzzyMatch(expected: string, input: string, tolerance = 1): boolean {
  const e = normalizeToken(expected)
  const u = normalizeToken(input)
  if (e.length === 0) return u.length === 0
  return levenshtein(e, u) <= tolerance
}
