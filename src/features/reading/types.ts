/**
 * 阅读模块前端 DTO（T15）。
 *
 * 与 `src/services/reading.service.ts` 的返回结构一一对应，但在此**显式重复声明**而非
 * re-export：service 模块依赖 `@prisma/client`（server-only），客户端页面只应依赖这些
 * 纯类型，避免打包器把 Prisma 运行时拖进浏览器 bundle。
 */

/** 段落 */
export interface ReadingBlock {
  index: number
  en: string
  zh: string
}

/** 重点词 */
export interface ReadingKeyWord {
  word: string
  pos: string
  meaning: string
}

/** 长难句 */
export interface ReadingSentence {
  sentence: string
  structure: string
  translation: string
}

/** 答案定位（点击跳转原文段落） */
export interface ReadingLocation {
  blockIndex: number
  charStart: number
  charEnd: number
}

export interface ReadingArticleListItem {
  id: string
  title: string
  category: string
  difficulty: string
  cefrLevel: string | null
  wordCount: number
  readingMinutes: number
  progress: number
  quizDone: boolean
  quizAccuracy: number | null
  tags: string[]
}

export interface ReadingFacetItem {
  value: string
  count: number
}

export interface ReadingFacets {
  categories: ReadingFacetItem[]
  difficulties: ReadingFacetItem[]
}

export interface ReadingListResult {
  articles: ReadingArticleListItem[]
  facets: ReadingFacets
  total: number
  page: number
  pageSize: number
}

/** 列表页题目（**不含答案**，判分在服务端） */
export interface ReadingQuestion {
  id: string
  type: string
  stem: string
  options: string[] | null
  location: ReadingLocation | null
}

export interface ReadingQuizSnapshot {
  score: number
  total: number
  correctCount: number
}

export interface ReadingHighlight {
  word: string
  meaning: string
  blockIndex: number
}

export interface ReadingArticleDetail {
  id: string
  title: string
  category: string
  difficulty: string
  cefrLevel: string | null
  wordCount: number
  readingMinutes: number
  contentBlocks: ReadingBlock[]
  keyWords: ReadingKeyWord[]
  sentences: ReadingSentence[]
  questions: ReadingQuestion[]
  /** 断点续读：上次读到的段落下标 */
  lastBlockIndex: number
  progress: number
  quizResult: ReadingQuizSnapshot | null
  highlights: ReadingHighlight[]
  sourceName: string | null
  sourceUrl: string | null
}

export interface ReadingQuizAnswerResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
  location: ReadingLocation | null
}

export interface ReadingQuizResult {
  articleId: string
  score: number
  total: number
  correctCount: number
  accuracy: number
  answers: ReadingQuizAnswerResult[]
  /** 本次新增错题本条目数 */
  wrongCount: number
}

export interface ReadingExplainResult {
  sentence: string
  explanation: string | null
  /** true = AI 不可用 → 前端隐藏整个 AI 区块 */
  degraded: boolean
}

export interface ReadingWordResult {
  word: string
  lemma: string
  phoneticUk: string | null
  phoneticUs: string | null
  pos: string[]
  definitions: Array<{ pos: string; zh: string; en?: string }>
  examples: Array<{ en: string; zh: string }>
  found: boolean
}

/** 难度中文名（与全站口径一致） */
export const DIFFICULTY_NAMES: Record<string, string> = {
  EASY: '入门',
  MEDIUM: '标准',
  HARD: '挑战',
}

/** 题型中文名 */
export const QUESTION_TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: '单选',
  MULTI_CHOICE: '多选',
  TRUE_FALSE: '判断',
  FILL_BLANK: '填空',
  CLOZE: '完形',
}
