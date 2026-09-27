/**
 * SRS 引擎入口（§5.1）：复习/学习事件的统一推进入口。
 * 服务端计算（客户端仅展示预测），乐观锁防并发。
 */
import { advance } from './srs.formula'
import type { SrsOutcome, SrsState, SelfRating } from './srs.types'

export { stageFromMastery, nextReviewFrom, clamp } from './srs.formula'
export { ADVANCE_INTERVALS, STAGE_THRESHOLDS } from './srs.constants'
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
