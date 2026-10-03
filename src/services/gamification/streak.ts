/**
 * gamification 出口：level 曲线与 streak 计算同源（架构 §5.4）。
 */
export {
  LEVEL_NAMES,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  REVIEW_XP_DAILY_CAP,
  XP_REWARDS,
  calcStreakDays,
  levelFromXp,
  levelName,
  levelOf,
  levelProgress,
  reviewXpAward,
  totalXpForLevel,
  xpForEvent,
  type XpEvent,
} from './level'
