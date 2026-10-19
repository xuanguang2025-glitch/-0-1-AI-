/**
 * 语法模块前端 DTO（T16）。
 *
 * 与 `src/services/grammar.service.ts` 的返回结构一一对应，但在此**显式重复声明**而非
 * re-export：service 模块依赖 `@prisma/client`（server-only），客户端页面只应依赖这些
 * 纯类型，避免打包器把 Prisma 运行时拖进浏览器 bundle。
 */

/** 知识点讲解块 */
export interface GrammarContentPoint {
  title: string
  content: string
}

/** 例句 */
export interface GrammarExample {
  en: string
  zh: string
  structure: string
}

/** 错误示例对照 */
export interface GrammarErrorExample {
  wrong: string
  right: string
  reason: string
}

/** 树节点（G1） */
export interface GrammarTopicNode {
  id: string
  name: string
  slug: string
  category: string
  difficulty: string
  orderIndex: number
  questionCount: number
  /** 掌握度 0-100；未练习为 null */
  mastery: number | null
  mastered: boolean
  children: GrammarTopicNode[]
}

export interface GrammarTopicListResult {
  topics: GrammarTopicNode[]
  total: number
}

export interface GrammarTopicDetail {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  difficulty: string
  content: GrammarContentPoint[]
  examples: GrammarExample[]
  errorExamples: GrammarErrorExample[]
  questionCount: number
  mastery: number | null
  mastered: boolean
  attemptCount: number
  correctCount: number
}

/** 练习题（**不含答案**） */
export interface GrammarExerciseItem {
  id: string
  type: string
  stem: string
  options: string[] | null
}

export interface GrammarExerciseResult {
  topicId: string
  topicName: string
  questions: GrammarExerciseItem[]
  total: number
}

export interface GrammarAnswerResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
}

export interface GrammarSubmitResult {
  topicId: string
  score: number
  total: number
  correctCount: number
  accuracy: number
  answers: GrammarAnswerResult[]
  wrongCount: number
  /** 更新后的掌握度（累计正确率） */
  mastery: number
  mastered: boolean
  attemptCount: number
}

export interface GrammarExplainResult {
  topicId: string
  pointTitle: string
  explanation: string
  /** ai = AI 生成；static = 静态知识点兜底 */
  source: 'ai' | 'static'
}

/** 难度中文名（与全站口径一致） */
export const DIFFICULTY_NAMES: Record<string, string> = {
  EASY: '入门',
  MEDIUM: '标准',
  HARD: '挑战',
}
