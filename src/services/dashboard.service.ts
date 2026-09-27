/**
 * Dashboard 服务（架构 §8.1 T07）：9 Block 数据聚合（SSR 直出）。
 * AI 建议区块独立降级：失败返回 degraded 提示，不影响其余区块。
 */
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger/logger'
import { localDate } from './onboarding.service'
import { levelProgress, calcStreakDays, xpForEvent } from './gamification/level'
import type { AiRunContext } from './ai/types'
import type { AiResult } from './ai/types'

const log = createLogger('dashboard.service')

export interface DashboardData {
  user: { nickname: string; avatarUrl: string | null; level: number; levelPct: number; xpToNext: number }
  streak: { days: number; todayDone: boolean; longest: number }
  today: { date: string; tasksTotal: number; tasksCompleted: number; minutesGoal: number; minutesDone: number }
  tasks: Array<{ id: string; taskType: string; title: string; targetValue: number; completedValue: number; status: string; unit: string; payload: unknown }>
  vocabulary: { dueReview: number; learnedTotal: number; masteredTotal: number }
  ability: Record<string, number> | null
  aiSuggestion: { text: string; degraded: boolean }
  continueLearning: { lastBookSlug: string | null; lastBookName: string | null }
  recentStats: Array<{ date: string; minutes: number; wordsLearned: number; wordsReviewed: number }>
}

/** 聚合（8 个并行查询 + AI 1 次独立降级） */
export async function getDashboard(userId: string, aiCtx: AiRunContext): Promise<DashboardData> {
  const today = localDate()

  const [stats, settings, tasks, vocabAgg, dueCount, bookItem, profile, userRow] = await Promise.all([
    prisma.dailyLearningStat.findMany({
      where: { userId, date: { gte: dateOffset(today, -30) } },
      orderBy: { date: 'asc' },
    }),
    prisma.userSettings.findUnique({ where: { userId }, select: { dailyGoalMinutes: true } }),
    prisma.studyTask.findMany({
      where: { userId, date: today, status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] } },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    prisma.userVocabulary.aggregate({
      where: { userId },
      _count: { id: true },
    }),
    prisma.userVocabulary.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
    prisma.vocabularyBookItem.findFirst({
      orderBy: { addedAt: 'desc' },
      select: { book: { select: { slug: true, name: true } } },
    }).catch(() => null),
    prisma.profile.findUnique({ where: { userId }, select: { abilityVector: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nickname: true, avatarUrl: true, userStats: { select: { xp: true, longestStreak: true } } } }),
  ])

  const xp = userRow.userStats?.xp ?? 0
  const lv = levelProgress(xp)

  const learnedDates = new Set(stats.filter((s) => s.wordsLearned > 0 || s.wordsReviewed > 0).map((s) => s.date))
  const todayStat = stats.find((s) => s.date === today)
  const streakDays = calcStreakDays(learnedDates, today)
  const tasksCompleted = tasks.filter((t) => t.status === 'COMPLETED').length

  // mastered 统计
  const masteredTotal = await prisma.userVocabulary.count({ where: { userId, masteryStage: 'MASTERED' } })

  // ---- AI 建议（独立降级）----
  let aiSuggestion: DashboardData['aiSuggestion']
  try {
    const { aiService } = await import('./ai/ai.service')
    const result: AiResult<unknown> = await aiService.diagnoseDaily(
      {
        statsJson: {
          minutesStudied: Math.round((todayStat?.studySeconds ?? 0) / 60),
          wordsLearned: todayStat?.wordsLearned ?? 0,
          wordsReviewed: todayStat?.wordsReviewed ?? 0,
          tasksCompleted,
          tasksTotal: tasks.length,
        },
        streakDays,
      },
      aiCtx,
    )
    const data = result.data as { insights?: Array<{ text?: string }>; tomorrowTip?: string; cheer?: string }
    const first = data.insights?.[0]?.text ?? data.tomorrowTip ?? data.cheer ?? '保持今天的节奏！'
    aiSuggestion = { text: first, degraded: result.degraded }
  } catch (e) {
    log.warn({ msg: 'ai suggestion degraded', err: e instanceof Error ? e.message : String(e) })
    aiSuggestion = { text: '完成今日任务，保持连胜！', degraded: true }
  }

  return {
    user: { nickname: userRow.nickname, avatarUrl: userRow.avatarUrl, level: lv.level, levelPct: lv.progressPct, xpToNext: lv.xpToNext },
    streak: { days: streakDays, todayDone: learnedDates.has(today), longest: userRow.userStats?.longestStreak ?? 0 },
    today: {
      date: today,
      tasksTotal: tasks.length,
      tasksCompleted,
      minutesGoal: settings?.dailyGoalMinutes ?? 30,
      minutesDone: Math.round((todayStat?.studySeconds ?? 0) / 60),
    },
    tasks: tasks.map((t) => ({
      id: t.id, taskType: t.taskType, title: t.title,
      targetValue: t.targetValue, completedValue: t.completedValue,
      status: t.status, unit: t.unit, payload: t.payload,
    })),
    vocabulary: { dueReview: dueCount, learnedTotal: vocabAgg._count.id, masteredTotal },
    ability: (profile?.abilityVector as Record<string, number> | null) ?? null,
    aiSuggestion,
    continueLearning: { lastBookSlug: bookItem?.book.slug ?? null, lastBookName: bookItem?.book.name ?? null },
    recentStats: stats.slice(-14).map((s) => ({ date: s.date, minutes: Math.round(s.studySeconds / 60), wordsLearned: s.wordsLearned, wordsReviewed: s.wordsReviewed })),
  }
}

/** 完成任务：状态机 + XP/统计落库（幂等：已 COMPLETED 直接返回） */
export async function completeTask(userId: string, taskId: string): Promise<{ status: string; xpEarned: number }> {
  const task = await prisma.studyTask.findFirst({ where: { id: taskId, userId } })
  if (!task) {
    const { errNotFound } = await import('@/lib/api/errors')
    throw errNotFound('任务不存在')
  }
  if (task.status === 'COMPLETED') return { status: task.status, xpEarned: 0 }

  const today = localDate()
  const xp = xpForEvent('complete_task')
  await prisma.$transaction([
    prisma.studyTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedValue: task.targetValue, completedAt: new Date() } }),
    prisma.userStats.updateMany({ where: { userId }, data: { xp: { increment: xp }, challengeCompleted: { increment: 0 } } }),
    prisma.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: { tasksCompleted: { increment: 1 }, xpEarned: { increment: xp } },
      create: { userId, date: today, tasksTotal: 1, tasksCompleted: 1, xpEarned: xp },
    }),
  ])
  return { status: 'COMPLETED', xpEarned: xp }
}

function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
