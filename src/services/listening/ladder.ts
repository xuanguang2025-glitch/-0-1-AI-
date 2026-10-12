/**
 * 听力难度阶梯与训练模式元数据（架构 §5.2）。
 *
 * 纯函数：不触 DB / AI。用于：
 *   - 难度档 ↔ 推荐语速 ↔ 难度标签 的映射；
 *   - 7 种训练模式的可用性 / 判分方式 / 答案来源（§5.2 表）；
 *   - 字幕时间轴的**词数比例估算**（§5.1 局限③：不用 TTS 输出做时间轴）。
 */

export type ListeningModeKey =
  | 'INTENSIVE'
  | 'EXTENSIVE'
  | 'DICTATION'
  | 'CHOICE'
  | 'KEYWORD'
  | 'RETELL'
  | 'CLOZE'

export type JudgeKind = 'objective' | 'fuzzy' | 'diff' | 'none' | 'ai'
export type AnswerSource = 'questions' | 'transcript' | 'focusPoints' | 'none' | 'ai'

export interface ModeMeta {
  mode: ListeningModeKey
  nameZh: string
  /** 适用难度档（intensityLevel） */
  levels: number[]
  answerSource: AnswerSource
  judge: JudgeKind
  /** Phase 2 是否可用（RETELL 移 Phase 3） */
  available: boolean
}

/** §5.2「7 种训练模式与难度档的对应」 */
export const MODES: Record<ListeningModeKey, ModeMeta> = {
  EXTENSIVE: { mode: 'EXTENSIVE', nameZh: '泛听', levels: [1, 2, 3, 4], answerSource: 'questions', judge: 'objective', available: true },
  CHOICE: { mode: 'CHOICE', nameZh: '选择', levels: [1, 2, 3, 4], answerSource: 'questions', judge: 'objective', available: true },
  CLOZE: { mode: 'CLOZE', nameZh: '完形', levels: [2, 3, 4], answerSource: 'questions', judge: 'objective', available: true },
  KEYWORD: { mode: 'KEYWORD', nameZh: '关键词捕捉', levels: [2, 3, 4], answerSource: 'focusPoints', judge: 'fuzzy', available: true },
  INTENSIVE: { mode: 'INTENSIVE', nameZh: '精听', levels: [1, 2, 3, 4], answerSource: 'none', judge: 'none', available: true },
  DICTATION: { mode: 'DICTATION', nameZh: '听写', levels: [1, 2, 3, 4], answerSource: 'transcript', judge: 'diff', available: true },
  RETELL: { mode: 'RETELL', nameZh: '复述', levels: [3, 4], answerSource: 'ai', judge: 'ai', available: false },
}

export const ALL_MODES: ListeningModeKey[] = ['EXTENSIVE', 'CHOICE', 'CLOZE', 'KEYWORD', 'INTENSIVE', 'DICTATION', 'RETELL']

/** Phase 2 可用的 6 个模式 */
export function availableModes(): ListeningModeKey[] {
  return ALL_MODES.filter((m) => MODES[m].available)
}

export function modeMeta(mode: ListeningModeKey): ModeMeta {
  return MODES[mode]
}

/** 语速资产档（架构 §5.2：0.75 / 1.0 / 1.25） */
export const AUDIO_RATES = [0.75, 1.0, 1.25] as const
export type AudioRate = (typeof AUDIO_RATES)[number]

/** intensityLevel → 推荐播放语速（1→1.0，2→1.0，3→0.75，4→0.75） */
export function recommendedRate(intensityLevel: number): AudioRate {
  return intensityLevel >= 3 ? 0.75 : 1.0
}

/** intensityLevel → 难度标签（EASY/MEDIUM/HARD） */
export function difficultyForIntensity(intensityLevel: number): 'EASY' | 'MEDIUM' | 'HARD' {
  if (intensityLevel <= 1) return 'EASY'
  if (intensityLevel === 2) return 'MEDIUM'
  return 'HARD'
}

/** intensityLevel → 词/分钟基准（§5.2 阶梯表） */
export function wpmForIntensity(intensityLevel: number): number {
  switch (intensityLevel) {
    case 1:
      return 100
    case 2:
      return 130
    case 3:
      return 150
    default:
      return 160
  }
}

export interface TimelineLine {
  startSec: number
  endSec: number
  en: string
  zh: string
}

/**
 * 字幕时间轴估算（按词数比例）：每句时长 = 词数 / wpm × 60，最短 2 秒。
 * 明确**不使用 TTS 输出**做时间轴（§5.1 局限③）。
 */
export function estimateTimeline(
  lines: Array<{ en: string; zh: string }>,
  wpm: number,
): TimelineLine[] {
  const safeWpm = wpm > 0 ? wpm : 120
  let cursor = 0
  return lines.map((line) => {
    const words = line.en.trim().split(/\s+/).filter(Boolean).length
    const dur = Math.max(2, (words / safeWpm) * 60)
    const startSec = Number(cursor.toFixed(1))
    const endSec = Number((cursor + dur).toFixed(1))
    cursor += dur
    return { startSec, endSec, en: line.en, zh: line.zh }
  })
}

/** 估算总时长（秒） */
export function estimatedDurationSec(lines: Array<{ en: string; zh: string }>, wpm: number): number {
  const tl = estimateTimeline(lines, wpm)
  return Math.round(tl[tl.length - 1]?.endSec ?? 0)
}

/** 词数统计 */
export function countWords(lines: Array<{ en: string; zh: string }>): number {
  return lines.reduce((n, l) => n + l.en.trim().split(/\s+/).filter(Boolean).length, 0)
}
