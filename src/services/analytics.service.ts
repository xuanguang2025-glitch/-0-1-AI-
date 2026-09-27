/**
 * 学习分析服务（架构 §8.1 T08）：指标卡 / 30 天趋势 / 日历热力。
 */
import { prisma } from '@/lib/db'
import { localDate } from '@/lib/utils/date'

export interface TrendPoint {
  date: string
  minutes: number
  wordsLearned: number
  wordsReviewed: number
  correctRate: number | null
}

/** 近 N 天趋势（补零对齐日期轴） */
export async function getTrend(userId: string, days = 30): Promise<TrendPoint[]> {
  const today = localDate()
  const start = dateOffset(today, -(days - 1))
  const rows = await prisma.dailyLearningStat.findMany({
    where: { userId, date: { gte: start } },
    orderBy: { date: 'asc' },
  })
  const byDate = new Map(rows.map((r) => [r.date, r]))

  const out: TrendPoint[] = []
  for (let i = 0; i < days; i += 1) {
    const date = dateOffset(start, i)
    const r = byDate.get(date)
    const correct = r?.correctCount ?? 0
    const wrong = r?.wrongCount ?? 0
    out.push({
      date,
      minutes: Math.round((r?.studySeconds ?? 0) / 60),
      wordsLearned: r?.wordsLearned ?? 0,
      wordsReviewed: r?.wordsReviewed ?? 0,
      correctRate: correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null,
    })
  }
  return out
}

/** 指标卡（今日 + 累计） */
export async function getOverview(userId: string) {
  const today = localDate()
  const [todayStat, agg, userStats] = await Promise.all([
    prisma.dailyLearningStat.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.dailyLearningStat.aggregate({
      where: { userId },
      _sum: { studySeconds: true, wordsLearned: true, wordsReviewed: true, xpEarned: true, examCount: true },
    }),
    prisma.userStats.findUnique({ where: { userId }, select: { streakDays: true, longestStreak: true } }),
  ])
  return {
    today: {
      minutes: Math.round((todayStat?.studySeconds ?? 0) / 60),
      wordsLearned: todayStat?.wordsLearned ?? 0,
      wordsReviewed: todayStat?.wordsReviewed ?? 0,
      xp: todayStat?.xpEarned ?? 0,
    },
    total: {
      minutes: Math.round((agg._sum.studySeconds ?? 0) / 60),
      wordsLearned: agg._sum.wordsLearned ?? 0,
      wordsReviewed: agg._sum.wordsReviewed ?? 0,
      xp: agg._sum.xpEarned ?? 0,
      exams: agg._sum.examCount ?? 0,
    },
    streak: { days: userStats?.streakDays ?? 0, longest: userStats?.longestStreak ?? 0 },
  }
}

/** 热力日历数据（按周组织由前端完成；此处给日期连续数组） */
export async function getCalendar(userId: string, days = 140): Promise<Array<{ date: string; minutes: number }>> {
  const today = localDate()
  const start = dateOffset(today, -(days - 1))
  const rows = await prisma.dailyLearningStat.findMany({
    where: { userId, date: { gte: start } },
    select: { date: true, studySeconds: true },
  })
  const byDate = new Map(rows.map((r) => [r.date, r.studySeconds]))
  const out: Array<{ date: string; minutes: number }> = []
  for (let i = 0; i < days; i += 1) {
    const date = dateOffset(start, i)
    out.push({ date, minutes: Math.round((byDate.get(date) ?? 0) / 60) })
  }
  return out
}

function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
