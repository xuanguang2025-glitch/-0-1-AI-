/**
 * 计划重建（架构 §5.2.2 · Phase 2 P0）：三类触发时机的任务重算。
 *
 * 触发时机（关键变更，与 §5.2.1 Phase 1 在 Onboarding 生成不同）：
 *   - PLACEMENT_COMPLETED：Placement 交卷后重算「剩余首周」未完成任务
 *   - DAILY_CRON：每日 06:00（用户本地时区）滚动生成次日任务
 *   - PLAN_ADJUST：计划调整时重算今日起 7 天
 *
 * 关键约束（验收 1/4/6）：
 *   1) 幂等：以 `@@unique([userId, date, taskType])` 为键 upsert，重跑不产生重复行；
 *   2) 已完成任务**绝不改动**（status 保持 COMPLETED），保证 M3 完成率口径稳定；
 *   3) 全程包在 $transaction 内，配合唯一约束消除并发重复（修 QA #10）。
 */
import { prisma } from '@/lib/db'
import { Prisma, TaskSource } from '@prisma/client'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import {
  generateDailyTasks,
  normalizeAbility,
  TASK_PAYLOAD,
  type AbilityVector,
  type PlanInput,
} from './generator'

const log = createLogger('plan.rebuild')

export type PlanRegenerateTrigger =
  | { kind: 'PLACEMENT_COMPLETED' }
  | { kind: 'DAILY_CRON' }
  | { kind: 'PLAN_ADJUST'; reason: string }

export interface RebuildResult {
  trigger: PlanRegenerateTrigger['kind']
  created: number
  updated: number
  skippedCompleted: number
  dates: string[]
}

/** 重算窗口（天）：以今日为起点覆盖的天数 */
const REBUILD_WINDOW_DAYS = 7

/** YYYY-MM-DD 日期偏移（UTC 口径，与 localDate/userToday 一致） */
function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 触发时机 → 目标日期数组 */
function targetDates(trigger: PlanRegenerateTrigger, today: string): string[] {
  switch (trigger.kind) {
    case 'DAILY_CRON':
      // 滚动生成次日任务
      return [dateOffset(today, 1)]
    case 'PLACEMENT_COMPLETED':
    case 'PLAN_ADJUST':
    default:
      // 重算今日起 7 天（含今日）
      return Array.from({ length: REBUILD_WINDOW_DAYS }, (_, i) => dateOffset(today, i))
  }
}

/** 触发时机 → StudyTask.source */
export function sourceForTrigger(kind: PlanRegenerateTrigger['kind']): TaskSource {
  switch (kind) {
    case 'PLACEMENT_COMPLETED':
      return TaskSource.PLACEMENT_COMPLETED
    case 'PLAN_ADJUST':
      return TaskSource.PLAN_ADJUST
    case 'DAILY_CRON':
    default:
      return TaskSource.DAILY_CRON
  }
}

/**
 * 组装生成算法输入：能力向量 / 目标 / 近 7 日完成率 / 到期复习量。
 * 无 Placement 能力数据时回退中性 50（normalizeAbility 已兜底）。
 */
export async function buildPlanInput(userId: string): Promise<PlanInput> {
  const [profile, settings, goal, stats, dueReviewCount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { abilityVector: true } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { dailyGoalMinutes: true, weeklyGoalDays: true } }),
    prisma.learningGoal.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { targetExam: true, targetScore: true, targetDate: true },
    }),
    prisma.dailyLearningStat.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
      select: { tasksCompleted: true, tasksTotal: true },
    }),
    prisma.userVocabulary.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
  ])

  const ability = (profile?.abilityVector as Partial<AbilityVector> | null) ?? null
  const totalTasks = stats.reduce((acc, s) => acc + s.tasksTotal, 0)
  const completedTasks = stats.reduce((acc, s) => acc + s.tasksCompleted, 0)
  const avgCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 1

  return {
    dailyMinutes: settings?.dailyGoalMinutes ?? 30,
    weeklyDays: settings?.weeklyGoalDays ?? 5,
    ability: normalizeAbility(ability),
    goal: {
      examType: goal?.targetExam ?? 'DAILY',
      targetScore: goal?.targetScore ?? null,
      targetDate: goal?.targetDate ?? null,
    },
    history: {
      avgCompletionRate,
      last7Completion: stats.map((s) => (s.tasksTotal > 0 ? s.tasksCompleted / s.tasksTotal : 0)),
    },
    dueReviewCount,
  }
}

/**
 * 重算任务：对目标日期窗口内、**未完成**的任务按权重算法重建。
 * 已 COMPLETED 的任务保持原样（验收 1/6）。
 */
export async function rebuildTasks(userId: string, trigger: PlanRegenerateTrigger): Promise<RebuildResult> {
  const today = await userToday(userId)
  const dates = targetDates(trigger, today)
  const source = sourceForTrigger(trigger.kind)

  const input = await buildPlanInput(userId)
  const tasks = generateDailyTasks(input)
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { id: true },
  })

  const dateFrom = dates[0] ?? today
  const dateTo = dates[dates.length - 1] ?? today

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.studyTask.findMany({
      where: { userId, date: { gte: dateFrom, lte: dateTo } },
      select: { id: true, date: true, taskType: true, status: true },
    })
    const byKey = new Map(existing.map((t) => [`${t.date}:${t.taskType}`, t]))

    let created = 0
    let updated = 0
    let skippedCompleted = 0

    for (const date of dates) {
      for (const task of tasks) {
        const key = `${date}:${task.type}`
        const prev = byKey.get(key)
        // 已完成任务绝不改动（M3 完成率口径稳定）
        if (prev?.status === 'COMPLETED') {
          skippedCompleted += 1
          continue
        }
        const data = {
          title: task.title,
          targetValue: task.target,
          unit: task.unit,
          sortOrder: task.sortOrder,
          source,
          weightSnapshot: task.weightSnapshot as unknown as Prisma.InputJsonValue,
          weakHits: (task.weakHits ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
          payload: TASK_PAYLOAD[task.type],
        }
        await tx.studyTask.upsert({
          where: { userId_date_taskType: { userId, date, taskType: task.type } },
          update: data,
          create: { userId, date, taskType: task.type, planId: plan?.id ?? null, ...data },
        })
        if (prev) updated += 1
        else created += 1
      }
    }
    return { created, updated, skippedCompleted }
  })

  log.info({ msg: 'plan rebuilt', userId, trigger: trigger.kind, dates, ...result })
  return { trigger: trigger.kind, dates, ...result }
}
