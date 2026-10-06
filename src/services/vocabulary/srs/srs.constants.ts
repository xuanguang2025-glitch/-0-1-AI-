/**
 * SRS 常量（架构 §5.1 间隔表 + §5.1.4 裁决 B-1）。
 */

/**
 * 答对推进的间隔表（天）：1 → 3 → 7 → 14 → 30 → 60 → 120 → 240。
 *
 * ⚠️ Phase 2 长尾回改（架构 §5.1.4 裁决 B-1，P0）：
 * Phase 1 封顶 30 天会让 5000 词稳态日复习量达 ~167 词/天（≈22min），
 * 直接吃满 M2 的 22min/DAU 时间预算，导致听力/口语/阅读/写作无处安放。
 * 扩展为 8 档后稳态复习量降至约 1/4，保住产品指标。
 */
export const ADVANCE_INTERVALS = [1, 3, 7, 14, 30, 60, 120, 240] as const

/**
 * 毕业后的三级递进间隔（天）：60 → 120 → 240。
 * 替代 Phase 1 的「45 天单跳」——避免已掌握词长期高频占用复习队列（§5.1.4 裁决 B-2）。
 */
export const GRADUATED_INTERVALS = [60, 120, 240] as const

/** 进入毕业递进的起始 reps（`reps - MIN_GRADUATE_REPS` 作为递进下标） */
export const MIN_GRADUATE_REPS = 5

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

// ---------------------------------------------------------------------------
// 复习负担预估参数（架构 §5.1.4 SRS-P2-5：Σ(1/I_i) × 8s）
// ---------------------------------------------------------------------------

/** 单次复习平均耗时（秒），用于把稳态复习量折算为每日 ETA */
export const SECONDS_PER_REVIEW = 8

/**
 * 稳态平均复习间隔（天）。
 * 稳态下绝大多数词沉淀在阶梯长尾（120/240），故取 120 天作为建模均值——
 * 与架构 §5.1.4「文档口径均值 ~120 天」一致。
 */
export const STEADY_STATE_AVG_INTERVAL_DAYS = 120
