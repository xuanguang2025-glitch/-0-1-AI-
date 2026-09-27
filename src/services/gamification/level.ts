/**
 * 游戏化纯函数：等级曲线 + 连续天数（无 IO，架构 §8.1 T07）。
 */

/** 等级曲线：Lv.n 所需累计 XP = 100 * n * (n+1) / 2（1 级 100，2 级 300，3 级 600…） */
export function totalXpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  return (100 * n * (n + 1)) / 2
}

/** XP → 当前等级 */
export function levelFromXp(xp: number): number {
  let level = 1
  while (totalXpForLevel(level + 1) <= xp && level < 100) level += 1
  return level
}

/** 当前等级内进度（0-100）与距下一级 XP */
export function levelProgress(xp: number): { level: number; progressPct: number; xpToNext: number } {
  const level = levelFromXp(xp)
  const currentFloor = totalXpForLevel(level)
  const nextFloor = totalXpForLevel(level + 1)
  const progressPct = Math.round(((xp - currentFloor) / (nextFloor - currentFloor)) * 100)
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

/** 单次学习 XP 奖励规则 */
export function xpForEvent(event: 'learn_word' | 'review_word' | 'complete_task' | 'exam_submit'): number {
  switch (event) {
    case 'learn_word':
      return 4
    case 'review_word':
      return 2
    case 'complete_task':
      return 10
    case 'exam_submit':
      return 50
  }
}
