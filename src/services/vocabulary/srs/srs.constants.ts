/**
 * SRS 常量（§5.1 间隔表）。
 */

/** 答对推进的间隔表（天）：1 → 3 → 7 → 14 → 30 → 之后 EF 缩放 */
export const ADVANCE_INTERVALS = [1, 3, 7, 14, 30] as const

/** 阶段阈值（masteryScore 0-100 → stage） */
export const STAGE_THRESHOLDS = {
  STRANGER: 0,
  LEARNING: 25,
  FAMILIAR: 50,
  PROFICIENT: 75,
  MASTERED: 90,
} as const

/** SM-2 EF 边界 */
export const EASE_MIN = 1.3
export const EASE_MAX = 2.8
export const EASE_DEFAULT = 2.5

/** 掌握度增量 */
export const MASTERY = {
  /** 每次答对基础增量 */
  correctBase: 12,
  /** 答错扣减 */
  wrongPenalty: 25,
  /** 快速作答奖励（<4s） */
  speedBonus: 4,
  /** 慢速作答衰减（>12s） */
  slowPenalty: 3,
} as const

/** 反应时长基准 */
export const RESPONSE_FAST_MS = 4000
export const RESPONSE_SLOW_MS = 12000
