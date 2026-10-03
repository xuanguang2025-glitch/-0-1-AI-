/**
 * GET /api/dashboard/ai-suggestion — AI 每日建议（独立降级：失败不影响 Dashboard 其余区块）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { prisma } from '@/lib/db'
import { userToday } from '@/lib/utils/user-date'
import { aiService } from '@/services/ai/ai.service'
import { calcStreakDays } from '@/services/gamification/streak'
import type { AiRunContext } from '@/services/ai/types'

export const GET = withAuth(
  async (ctx) => {
    const userId = ctx.auth!.userId
    const today = await userToday(userId)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    // 最近 30 天学习统计 + 用户 XP/最长连胜（与 Dashboard 主聚合口径一致）
    const [stats] = await Promise.all([
      prisma.dailyLearningStat.findMany({
        where: { userId, date: { gte: since } },
        select: { date: true, studySeconds: true, wordsLearned: true, wordsReviewed: true, tasksCompleted: true, tasksTotal: true },
        orderBy: { date: 'asc' },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { stats: { select: { longestStreak: true } } },
      }),
    ])

    const todayStat = stats.find((s) => s.date === today)
    const learnedDates = new Set(stats.filter((s) => s.wordsLearned > 0 || s.wordsReviewed > 0).map((s) => s.date))
    const streakDays = calcStreakDays(learnedDates, today)

    const aiCtx: AiRunContext = { userId, traceId: ctx.traceId, locale: 'zh-CN' }
    const result = await aiService.diagnoseDaily(
      {
        statsJson: {
          minutesStudied: Math.round((todayStat?.studySeconds ?? 0) / 60),
          wordsLearned: todayStat?.wordsLearned ?? 0,
          wordsReviewed: todayStat?.wordsReviewed ?? 0,
          tasksCompleted: todayStat?.tasksCompleted ?? 0,
          tasksTotal: todayStat?.tasksTotal ?? 0,
        },
        streakDays,
      },
      aiCtx,
    )

    const data = result.data as { insights?: Array<{ text?: string }>; tomorrowTip?: string; cheer?: string }
    const text =
      data.insights?.[0]?.text ?? data.tomorrowTip ?? data.cheer ?? '完成今日任务，保持连胜！'

    return ok(
      { text, degraded: result.degraded },
      {
        traceId: ctx.traceId,
        ai: { degraded: result.degraded, provider: result.provider, model: result.model, latencyMs: result.latencyMs },
      },
    )
  },
)
