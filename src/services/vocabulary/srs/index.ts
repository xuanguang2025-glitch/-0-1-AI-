/**
 * SRS 模块 barrel（架构 §5.1）：统一出口，避免调用方深链到具体文件。
 * 常量 / 公式 / 引擎 / 类型四层。
 */
export {
  ADVANCE_INTERVALS,
  GRADUATED_INTERVALS,
  MIN_GRADUATE_REPS,
  STAGE_THRESHOLDS,
  EASE_MIN,
  EASE_MAX,
  EASE_DEFAULT,
  MASTERY,
  RESPONSE_FAST_MS,
  RESPONSE_SLOW_MS,
  SECONDS_PER_REVIEW,
  STEADY_STATE_AVG_INTERVAL_DAYS,
} from './srs.constants'

export { advance, clamp, nextReviewFrom, stageFromMastery } from './srs.formula'

export { review, stateFromRow, estimateReviewLoad, type ReviewLoadEstimate } from './srs.engine'

export type { MasteryStage, ReviewPath, SelfRating, SrsOutcome, SrsState } from './srs.types'
