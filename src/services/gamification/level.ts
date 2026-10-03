/**
 * 游戏化纯函数：等级曲线 + 连续天数（无 IO，架构 §5.4 / §8.1 T07）。
 *
 * 数值口径严格对齐架构文档 §5.4：
 * - 等级阈值表 LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 15000]（Lv1 Beginner … Lv6 Master）
 * - XP 来源表：learn=2 / review=1 / task=5 / exam=80，复习正确 XP 每日上限 100（防刷）
 */

/** 等级名称（与 §5.4 阈值表逐行对应） */
export const LEVEL_NAMES: readonly string[] = ['Beginner', 'Learner', 'Explorer', 'Achiever', 'Expert', 'Master']

/** 等级阈值（累计 XP），索引 i 对应 Lv(i+1) */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 500, 1500, 3500, 7000, 15000]

/** 最高等级（阈值表长度） */
export const MAX_LEVEL = LEVEL_THRESHOLDS.length

/** 等级名称（越界自动收敛到最高级） */
export function levelName(level: number): string {
  const idx = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) - 1
  return LEVEL_NAMES[idx] ?? LEVEL_NAMES[0]!
}

/** 达到某等级所需的累计 XP（§5.4 阈值表；超出最高级返回最高阈值） */
export function totalXpForLevel(level: number): number {
  const lv = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  return LEVEL_THRESHOLDS[lv - 1] ?? 0
}

/** 累计 XP → 等级（§5.4 levelOf 语义） */
export function levelFromXp(xp: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= (LEVEL_THRESHOLDS[i] ?? 0)) level = i + 1
  }
  return Math.min(level, MAX_LEVEL)
}

/** 文档别名（§5.4 levelOf） */
export const levelOf = levelFromXp

/** 当前等级内进度（0-100）与距下一级 XP；已满级时 progressPct=100 / xpToNext=0 */
export function levelProgress(xp: number): { level: number; progressPct: number; xpToNext: number } {
  const level = levelFromXp(xp)
  const currentFloor = totalXpForLevel(level)
  if (level >= MAX_LEVEL) {
    return { level, progressPct: 100, xpToNext: 0 }
  }
  const nextFloor = totalXpForLevel(level + 1)
  const span = nextFloor - currentFloor
  const progressPct = span <= 0 ? 100 : Math.round(((xp - currentFloor) / span) * 100)
  return { level, progressPct: Math.min(100, Math.max(0, progressPct)), xpToNext: Math.max(0, nextFloor - xp) }
}

/**
 * 连续天数计算：以用户本地日期字符串（YYYY-MM-DD）序列为准。
 * @param dates 有学习的日期集合（升序去重后传入亦可）
 * @param today 今天（本地日期）
 */
export function calcStreakDays(dates: Set<string>, today: string): number {
  let streak = 0
  const cursor = new Date(`${today}T00:00:00Z`)
  // 今天没学不打断（当天进行中），从昨天往前数
  if (!dates.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  for (let i = 0; i < 3650; i += 1) {
    const key = cursor.toISOString().slice(0, 10)
    if (!dates.has(key)) break
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

/** 单次学习 XP 奖励规则（架构 §5.4 XP 来源表） */
export const XP_REWARDS = {
  /** 学会 1 个新词（首次 learnCount 0→1） */
  learn_word: 2,
  /** 复习正确 1 次（受每日上限约束，见 REVIEW_XP_DAILY_CAP） */
  review_word: 1,
  /** 完成 1 项每日任务 */
  complete_task: 5,
  /** 完成 1 次模拟考 */
  exam_submit: 80,
} as const

export type XpEvent = keyof typeof XP_REWARDS

/** 复习正确 XP 每日上限（§5.4「上限 100/日，防刷」） */
export const REVIEW_XP_DAILY_CAP = 100

/** XP 奖励查询 */
export function xpForEvent(event: XpEvent): number {
  return XP_REWARDS[event]
}

/**
 * 复习 XP 发放量（§5.4 防刷）：仅答对给分，且当日累计答对次数达上限后不再给分。
 * @param correctReviewsToday 今日已答对的复习次数（不含本次）
 * @param isCorrect 本次复习是否答对
 */
export function reviewXpAward(correctReviewsToday: number, isCorrect: boolean): number {
  if (!isCorrect) return 0
  return correctReviewsToday < REVIEW_XP_DAILY_CAP ? XP_REWARDS.review_word : 0
}
