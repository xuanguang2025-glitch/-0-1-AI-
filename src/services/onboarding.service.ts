/**
 * Onboarding 服务（架构 §3.5.1 #17/#18）：8 步采集 → Profile/Settings/Goal 回写。
 * 跳过（skip）也走 submit：仅回写已填部分，标记 onboardingCompletedAt。
 */
import { prisma } from '@/lib/db'
import { errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { generateDailyTasks, normalizeAbility, TASK_PAYLOAD, type PlanInput } from '@/services/plan/generator'
import { Prisma, TaskSource } from '@prisma/client'

const log = createLogger('onboarding.service')

export interface OnboardingSteps {
  /** 目标动机 */
  goal: string
  /** 自评水平 */
  level: string
  /** 每日可学时长（分钟档位） */
  dailyTime: number
  /** 每周天数 */
  weeklyDays: number
  /** 目标考试 */
  targetExam: string | null
  /** 目标日期 YYYY-MM-DD */
  targetDate: string | null
  /** 自认薄弱项（多选） */
  weakest: string[]
  /** 学习风格偏好 */
  style: string
}

/** 读取已填内容（续填）：无记录返回 completed=false, steps=null */
export async function getDraft(userId: string): Promise<{ completed: boolean; steps: OnboardingSteps | null; completedAt: string | null }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { onboardingData: true, onboardingCompletedAt: true },
  })
  if (!profile) throw errNotFound('Profile')
  return {
    completed: profile.onboardingCompletedAt !== null,
    steps: (profile.onboardingData as OnboardingSteps | null) ?? null,
    completedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
  }
}

/** 提交 8 步：写 Profile（CEFR/快照/完成时间）+ Settings（每日/每周目标）+ 建学习目标 */
export async function submit(userId: string, steps: OnboardingSteps, skipped: boolean): Promise<{ profile: Record<string, unknown>; planId: string | null }> {
  const levelToCefr: Record<string, string> = {
    beginner: 'A1',
    elementary: 'A2',
    intermediate: 'B1',
    upper: 'B2',
    advanced: 'C1',
  }
  const cefr = levelToCefr[steps.level] ?? 'A2'

  await prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      update: {
        onboardingData: steps as unknown as Prisma.InputJsonValue,
        onboardingCompletedAt: new Date(),
        cefrLevel: cefr as never,
      },
      create: {
        userId,
        onboardingData: steps as unknown as Prisma.InputJsonValue,
        onboardingCompletedAt: new Date(),
        cefrLevel: cefr as never,
      },
    })
    await tx.userSettings.upsert({
      where: { userId },
      update: { dailyGoalMinutes: steps.dailyTime, weeklyGoalDays: steps.weeklyDays },
      create: { userId, dailyGoalMinutes: steps.dailyTime, weeklyGoalDays: steps.weeklyDays },
    })
  })

  // 学习目标（未跳过且有目标考试时创建）
  let planId: string | null = null
  if (!skipped && steps.targetExam) {
    const goal = await prisma.learningGoal.create({
      data: {
        userId,
        goalType: steps.targetExam as never,
        targetExam: (['CET4', 'CET6', 'KAOYAN', 'IELTS', 'TOEFL'].includes(steps.targetExam) ? steps.targetExam : null) as never,
        targetDate: steps.targetDate ? new Date(steps.targetDate) : null,
        dailyMinutes: steps.dailyTime,
        weeklyDays: steps.weeklyDays,
      },
    })
    planId = goal.id
  }

  // 首周任务（未跳过时）：Phase 2 起改由权重式生成器产出（§5.2.2）；
  // 此阶段尚无 Placement 能力数据 → 传入中性能力向量（normalizeAbility 兜底 50）。
  if (!skipped) {
    await generateFirstWeekTasks(userId, {
      dailyMinutes: steps.dailyTime,
      weeklyDays: steps.weeklyDays,
      examType: steps.targetExam,
    })
  }

  log.info({ msg: 'onboarding submitted', userId, skipped })
  return {
    profile: { cefrLevel: cefr, onboardingCompletedAt: new Date().toISOString() },
    planId,
  }
}

/**
 * 生成首周任务（7 天，权重式生成器 §5.2.2，ONBOARDING 触发）。
 *
 * 幂等 & 并发安全（修 QA P2 #10）：
 *   1) `StudyTask` 已有 `@@unique([userId, date, taskType])`；
 *   2) 整段包在 `$transaction` 内，用 `createMany({ skipDuplicates: true })` 批量写入，
 *      并发双提交时由唯一约束去重——不再依赖「先查后建」（原实现有 TOCTOU 竞态）。
 */
async function generateFirstWeekTasks(
  userId: string,
  opts: { dailyMinutes: number; weeklyDays: number; examType: string | null },
): Promise<void> {
  const today = await userToday(userId)
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { id: true },
  })

  // Onboarding 阶段尚无 Placement 能力数据 → 中性能力向量（normalizeAbility 兜底 50）
  const input: PlanInput = {
    dailyMinutes: opts.dailyMinutes,
    weeklyDays: opts.weeklyDays,
    ability: normalizeAbility(null),
    goal: { examType: opts.examType ?? 'DAILY' },
    history: { avgCompletionRate: 1, last7Completion: [] },
    dueReviewCount: 0,
  }
  const tasks = generateDailyTasks(input)

  const rows: Prisma.StudyTaskCreateManyInput[] = []
  for (let i = 0; i < 7; i++) {
    const date = dateOffset(today, i)
    for (const task of tasks) {
      rows.push({
        userId,
        date,
        taskType: task.type,
        title: task.title,
        targetValue: task.target,
        unit: task.unit,
        sortOrder: task.sortOrder,
        source: TaskSource.ONBOARDING,
        weightSnapshot: task.weightSnapshot as unknown as Prisma.InputJsonValue,
        weakHits: (task.weakHits ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        payload: TASK_PAYLOAD[task.type] as unknown as Prisma.InputJsonValue,
        planId: plan?.id ?? null,
      })
    }
  }
  if (rows.length === 0) return

  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.studyTask.createMany({ data: rows, skipDuplicates: true })
    return result.count
  })

  if (created > 0) {
    log.info({ msg: 'first-week tasks created', userId, count: created })
  }
}

/** YYYY-MM-DD 日期偏移（UTC 口径，与 localDate 一致） */
function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
