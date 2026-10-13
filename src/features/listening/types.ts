/**
 * 听力模块前端 DTO（T14）。
 *
 * 与 `src/services/listening.service.ts` 的返回结构一一对应，但在此**显式重复声明**而非 re-export：
 * service 模块依赖 `@prisma/client`（server-only），客户端页面只应依赖这些纯类型，
 * 避免打包器把 Prisma 运行时拖进浏览器 bundle。
 */

/** 训练强度档 1-4 */
export type IntensityLevel = 1 | 2 | 3 | 4

/** 训练模式（RETELL 为 Phase 3） */
export type ListeningModeKey = 'INTENSIVE' | 'EXTENSIVE' | 'DICTATION' | 'CHOICE' | 'KEYWORD' | 'RETELL' | 'CLOZE'

/** 判分方式 */
export type JudgeKind = 'objective' | 'fuzzy' | 'diff' | 'none' | 'ai'

export interface TimelineLine {
  startSec: number
  endSec: number
  en: string
  zh: string
}

export interface ListeningAudioUrl {
  rate: number
  url: string
  /** 音频实际时长（秒）；未登记资产时为 null */
  durationSec: number | null
}

export interface ListeningFocusPoint {
  word: string
  meaning: string
  /** NEW_WORD | KEY_WORD | PHRASE | GRAMMAR */
  type: string
  startSec: number
}

export interface ListeningProgress {
  positionSec: number
  playbackRate: number
  completed: boolean
}

export interface ListeningMaterialListItem {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: string
  cefrLevel: string | null
  intensityLevel: number
  durationSec: number
  wordCount: number
  audioUrls: ListeningAudioUrl[]
  recommendedRate: number
  coverUrl: string | null
  questionCount: number
  progress: ListeningProgress | null
  bestAccuracy: number | null
}

export interface ListeningFacetItem {
  value: string
  count: number
}

export interface ListeningFacets {
  categories: ListeningFacetItem[]
  difficulties: ListeningFacetItem[]
  intensityLevels: ListeningFacetItem[]
}

export interface ListeningListResult {
  materials: ListeningMaterialListItem[]
  facets: ListeningFacets
  total: number
  page: number
  pageSize: number
}

export interface ListeningDetail {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: string
  cefrLevel: string | null
  intensityLevel: number
  durationSec: number
  wordCount: number
  audioUrl: string
  audioUrls: ListeningAudioUrl[]
  recommendedRate: number
  transcript: TimelineLine[]
  translation: string | null
  focusPoints: ListeningFocusPoint[]
  progress: ListeningProgress | null
  availableModes: ListeningModeKey[]
  questionCount: number
}

export interface ListeningQuestion {
  id: string
  type: string
  stem: string
  options: string[] | null
  hint: string | null
}

export interface ListeningQuestionsResult {
  materialId: string
  mode: ListeningModeKey
  judge: JudgeKind
  available: boolean
  questions: ListeningQuestion[]
  transcript: TimelineLine[] | null
}

export interface DictationToken {
  index: number
  token: string
  type: 'correct' | 'wrong' | 'missing' | 'extra'
  actual?: string
}

export interface ListeningAttemptResult {
  recordId: string
  mode: ListeningModeKey
  accuracy: number
  correctCount: number
  totalCount: number
  dictationDiff: DictationToken[] | null
}

export interface ListeningReportAnswer {
  questionId: string
  userAnswer: string
  isCorrect: boolean
}

export interface ListeningReport {
  recordId: string
  materialId: string
  materialTitle: string
  intensityLevel: number
  mode: string
  accuracy: number
  correctCount: number
  totalCount: number
  durationSec: number
  playbackRate: number
  completedAt: string
  unknownWords: Array<{ word: string; meaning?: string }>
  focusPoints: ListeningFocusPoint[]
  ruleStats: Record<string, number>
  answers: ListeningReportAnswer[]
  dictationDiff: DictationToken[] | null
  ai: { degraded: boolean }
}

export interface ListeningAnalysis {
  accuracy: number
  suggestions: string[]
  weakSpots: string[]
  nextMaterials: Array<{ id: string; title: string; intensityLevel: number }>
}

export interface ListeningAnalyzeResult {
  analysis: ListeningAnalysis
  source: 'ai' | 'rule'
  ai: { degraded: boolean }
}

/** 模式元数据（与 ladder.ts 的 MODES 同源，供前端展示） */
export const MODE_META: Record<ListeningModeKey, { nameZh: string; levels: number[]; available: boolean }> = {
  EXTENSIVE: { nameZh: '泛听', levels: [1, 2, 3, 4], available: true },
  CHOICE: { nameZh: '选择', levels: [1, 2, 3, 4], available: true },
  CLOZE: { nameZh: '完形', levels: [2, 3, 4], available: true },
  KEYWORD: { nameZh: '关键词', levels: [2, 3, 4], available: true },
  INTENSIVE: { nameZh: '精听', levels: [1, 2, 3, 4], available: true },
  DICTATION: { nameZh: '听写', levels: [1, 2, 3, 4], available: true },
  RETELL: { nameZh: '复述', levels: [3, 4], available: false },
}

/** Phase 2 可用的 6 个模式 */
export const AVAILABLE_MODES: ListeningModeKey[] = ['EXTENSIVE', 'CHOICE', 'CLOZE', 'KEYWORD', 'INTENSIVE', 'DICTATION']

/** 语速档（用户可手动覆盖） */
export const AUDIO_RATES = [0.75, 1.0, 1.25] as const

/** 强度档名称（§5.2） */
export const INTENSITY_NAMES: Record<number, string> = {
  1: '泛听入门',
  2: 'CET-4 标准',
  3: 'CET-6 强化',
  4: '高阶精听',
}
