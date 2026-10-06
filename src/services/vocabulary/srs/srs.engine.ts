/**
 * SRS 引擎入口（§5.1）：复习/学习事件的统一推进入口 + 复习负担预估（§5.1.4 SRS-P2-5）。
 * 服务端计算（客户端仅展示预测），乐观锁防并发。
 */
import { advance } from './srs.formula'
import { SECONDS_PER_REVIEW, STEADY_STATE_AVG_INTERVAL_DAYS } from './srs.constants'
import type { SrsOutcome, SrsState, SelfRating } from './srs.types'

export { stageFromMastery, nextReviewFrom, clamp } from './srs.formula'
export { ADVANCE_INTERVALS, GRADUATED_INTERVALS, MIN_GRADUATE_REPS, STAGE_THRESHOLDS } from './srs.constants'
export { SECONDS_PER_REVIEW, STEADY_STATE_AVG_INTERVAL_DAYS } from './srs.constants'
export type { SrsOutcome, SrsState, SelfRating, MasteryStage, ReviewPath } from './srs.types'

/** 由 UserVocabulary 行构建引擎状态 */
export function stateFromRow(row: {
  masteryScore: number
  masteryStage: string
  easeFactor: number
  intervalDays: number
  reps: number
  lapses: number
  consecutiveCorrect: number
  avgResponseMs: number
}): SrsState {
  return {
    masteryScore: row.masteryScore,
    stage: row.masteryStage as SrsState['stage'],
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    reps: row.reps,
    lapses: row.lapses,
    consecutiveCorrect: row.consecutiveCorrect,
    avgResponseMs: row.avgResponseMs,
  }
}

/** 复习推进（纯计算） */
export function review(
  state: SrsState,
  rating: SelfRating,
  responseMs: number,
  now = new Date(),
): SrsOutcome {
  const avg = state.avgResponseMs === 0 ? responseMs : Math.round(state.avgResponseMs * 0.7 + responseMs * 0.3)
  const outcome = advance(state, rating, responseMs, now)
  return { ...outcome, avgResponseMs: avg }
}

/** 复习负担预估结果 */
export interface ReviewLoadEstimate {
  /** 已进入 SRS 的词量 */
  wordCount: number
  /** 使用的平均复习间隔（天） */
  avgIntervalDays: number
  /** 单次复习耗时（秒） */
  secondsPerWord: number
  /** 稳态日复习量（词/天，保留两位小数）= wordCount / avgIntervalDays */
  dailyReviews: number
  /** 每日复习 ETA（秒）= dailyReviews × secondsPerWord */
  etaSeconds: number
  /** 每日复习 ETA（分钟，保留一位小数） */
  etaMinutes: number
}

/**
 * 复习负担预估（架构 §5.1.4 B-1 量化论证 / SRS-P2-5）。
 *
 * 稳态日复习量 ≈ `W / I`（W=已学词量，I=平均复习间隔），
 * 再按 `SECONDS_PER_REVIEW` 折算为每日 ETA。
 *
 * - 5000 词 @ 长尾阶梯（I≈120 天）→ ~333 秒/天（M2 时间预算内，≤400s 验收线）
 * - 5000 词 @ Phase 1 封顶 30 天 → ~1333 秒/天（≈22min，吃满预算 → 必须回改）
 *
 * @param wordCount      已进入 SRS 的词量
 * @param avgIntervalDays 平均复习间隔（天），默认 120（稳态口径）
 * @param secondsPerWord 单次复习耗时（秒），默认 8
 */
export function estimateReviewLoad(
  wordCount: number,
  avgIntervalDays: number = STEADY_STATE_AVG_INTERVAL_DAYS,
  secondsPerWord: number = SECONDS_PER_REVIEW,
): ReviewLoadEstimate {
  const safeCount = Number.isFinite(wordCount) && wordCount > 0 ? wordCount : 0
  const safeInterval =
    Number.isFinite(avgIntervalDays) && avgIntervalDays > 0 ? avgIntervalDays : STEADY_STATE_AVG_INTERVAL_DAYS
  const safeSeconds = Number.isFinite(secondsPerWord) && secondsPerWord > 0 ? secondsPerWord : SECONDS_PER_REVIEW

  const dailyReviews = safeCount / safeInterval
  const etaSeconds = Math.round(dailyReviews * safeSeconds)
  return {
    wordCount: safeCount,
    avgIntervalDays: safeInterval,
    secondsPerWord: safeSeconds,
    dailyReviews: Math.round(dailyReviews * 100) / 100,
    etaSeconds,
    etaMinutes: Math.round((etaSeconds / 60) * 10) / 10,
  }
}
