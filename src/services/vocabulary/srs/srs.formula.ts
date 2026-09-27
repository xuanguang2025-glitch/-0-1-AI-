/**
 * SRS 公式（纯函数，架构 §5.1）：
 * mastery' = clamp(mastery + Δ), Δ = ±f(rating, timeFactor)
 * EF' = clamp(EF + 0.1 - (5-rating)*(0.08 + (5-rating)*0.02))
 * interval' = LAPSE→1 | ADVANCE→table[min(reps, len-1)] * EF 缩放 | MASTERED→45+
 */
import { ADVANCE_INTERVALS, EASE_MAX, EASE_MIN, MASTERY, RESPONSE_FAST_MS, RESPONSE_SLOW_MS, STAGE_THRESHOLDS } from './srs.constants'
import type { MasteryStage, SrsOutcome, SrsState, SelfRating } from './srs.types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** masteryScore → 阶段 */
export function stageFromMastery(mastery: number): MasteryStage {
  if (mastery >= STAGE_THRESHOLDS.MASTERED) return 'MASTERED'
  if (mastery >= STAGE_THRESHOLDS.PROFICIENT) return 'PROFICIENT'
  if (mastery >= STAGE_THRESHOLDS.FAMILIAR) return 'FAMILIAR'
  if (mastery >= STAGE_THRESHOLDS.LEARNING) return 'LEARNING'
  return 'STRANGER'
}

/** 下次复习时间：now + intervalDays */
export function nextReviewFrom(now: Date, intervalDays: number): Date {
  return new Date(now.getTime() + intervalDays * 24 * 60 * 60_000)
}

/**
 * 单次复习推进（核心纯函数）。
 * @param state    复习前状态
 * @param rating   自评 0-5（>=2 视为答对）
 * @param responseMs 本次反应时长
 */
export function advance(state: SrsState, rating: SelfRating, responseMs: number, now = new Date()): SrsOutcome {
  const isCorrect = rating >= 2

  // ---- EF（SM-2 公式）----
  const q = clamp(rating, 0, 5)
  const newEase = clamp(state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), EASE_MIN, EASE_MAX)

  // ---- 掌握度增量（含时间因子）----
  const timeFactor = responseMs > 0 && responseMs < RESPONSE_FAST_MS ? MASTERY.speedBonus : responseMs > RESPONSE_SLOW_MS ? -MASTERY.slowPenalty : 0
  let newMastery: number
  if (isCorrect) {
    const ratingWeight = rating >= 4 ? 1.2 : rating === 3 ? 1 : 0.6
    newMastery = clamp(state.masteryScore + Math.round((MASTERY.correctBase + timeFactor) * ratingWeight), 0, 100)
  } else {
    newMastery = clamp(state.masteryScore - MASTERY.wrongPenalty, 0, 100)
  }

  // ---- 三条路径 ----
  if (!isCorrect) {
    // LAPSE：间隔回 1 天，EF 惩罚，连续正确清零
    const outcome: SrsOutcome = {
      ...state,
      masteryScore: newMastery,
      stage: stageFromMastery(newMastery),
      easeFactor: newEase,
      intervalDays: 1,
      reps: 0,
      lapses: state.lapses + 1,
      consecutiveCorrect: 0,
      path: 'LAPSE',
      nextReviewAt: nextReviewFrom(now, 1),
      isCorrect,
    }
    return outcome
  }

  const reps = state.reps + 1
  const consecutiveCorrect = state.consecutiveCorrect + 1

  // MASTERED：连续 3 次答对且 mastery ≥ 90 → 毕业间隔 45 天
  if (newMastery >= STAGE_THRESHOLDS.MASTERED && consecutiveCorrect >= 3) {
    return {
      ...state,
      masteryScore: newMastery,
      stage: 'MASTERED',
      easeFactor: newEase,
      intervalDays: 45,
      reps,
      lapses: state.lapses,
      consecutiveCorrect,
      path: 'MASTERED',
      nextReviewAt: nextReviewFrom(now, 45),
      isCorrect,
    }
  }

  // ADVANCE：查表 × EF 缩放（EF>2.5 加成，<2.5 折扣，但不低于表中值一半）
  const tableIndex = Math.min(reps - 1, ADVANCE_INTERVALS.length - 1)
  const baseInterval = ADVANCE_INTERVALS[tableIndex] ?? 30
  const scaled = Math.max(1, Math.round(baseInterval * (0.5 + (newEase / 2.5) * 0.5)))
  return {
    ...state,
    masteryScore: newMastery,
    stage: stageFromMastery(newMastery),
    easeFactor: newEase,
    intervalDays: scaled,
    reps,
    lapses: state.lapses,
    consecutiveCorrect,
    path: 'ADVANCE',
    nextReviewAt: nextReviewFrom(now, scaled),
    isCorrect,
  }
}
