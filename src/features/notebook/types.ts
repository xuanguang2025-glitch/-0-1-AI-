/**
 * 错题本模块前端 DTO（错题本闭环）。
 */
export type WrongSource = 'exam' | 'quiz' | 'grammar' | 'vocab' | 'listening' | 'reading' | 'challenge'

export interface WrongQuestionItem {
  id: string
  source: string
  refType: string | null
  refId: string | null
  stem: string
  options: string[]
  userAnswer: string | null
  correctAnswer: string | null
  explanation: string | null
  aiExplanation: string | null
  aiCategory: string | null
  errorCount: number
  lastWrongAt: string
  masteredAt: string | null
  isFavorite: boolean
}

export interface WrongQuestionListResult {
  items: WrongQuestionItem[]
  total: number
  page: number
  pageSize: number
  sourceCounts: Array<{ source: string; count: number }>
}

export interface WrongQuestionReviewResult {
  id: string
  masteredAt: string | null
}

/** 来源中文名 */
export const SOURCE_NAMES: Record<string, string> = {
  exam: '考试',
  quiz: '测验',
  grammar: '语法',
  vocab: '词汇',
  listening: '听力',
  reading: '阅读',
  challenge: '挑战',
}

/** AI 错因中文名（与服务端 aiCategoryName 同口径） */
export const AI_CATEGORY_NAMES: Record<string, string> = {
  vocab: '词汇',
  grammar: '语法',
  comprehension: '理解',
  careless: '粗心',
  knowledge_gap: '知识漏洞',
}
