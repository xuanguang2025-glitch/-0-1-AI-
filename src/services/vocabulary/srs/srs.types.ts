/**
 * SRS 类型（架构 §5.1）。
 */

/** 自评 0-5 */
export type SelfRating = 0 | 1 | 2 | 3 | 4 | 5

export type MasteryStage = 'NEW' | 'STRANGER' | 'LEARNING' | 'FAMILIAR' | 'PROFICIENT' | 'MASTERED'

/** 复习路径：答错（LAPSE）/ 答对推进（ADVANCE）/ 满级（MASTERED） */
export type ReviewPath = 'LAPSE' | 'ADVANCE' | 'MASTERED'

export interface SrsState {
  masteryScore: number // 0-100
  stage: MasteryStage
  easeFactor: number // SM-2 EF [1.3, 2.8]
  intervalDays: number
  reps: number
  lapses: number
  consecutiveCorrect: number
  avgResponseMs: number
}

export interface SrsOutcome extends SrsState {
  path: ReviewPath
  nextReviewAt: Date
  isCorrect: boolean
}
