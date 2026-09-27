/**
 * Onboarding 服务（架构 §3.5.1 #17/#18）：8 步采集 → Profile/Settings/Goal 回写。
 * 跳过（skip）也走 submit：仅回写已填部分，标记 onboardingCompletedAt。
 */
import { prisma } from '@/lib/db'
import { errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { localDate } from '@/lib/utils/date'
import { Prisma } from '@prisma/client'

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

  // 首周任务（未跳过时）：按每日时长生成 7 天 × 3 类任务，已有任务的日期跳过（幂等）
  if (!skipped) {
    await generateFirstWeekTasks(userId, steps.dailyTime)
  }

  log.info({ msg: 'onboarding submitted', userId, skipped })
  return {
    profile: { cefrLevel: cefr, onboardingCompletedAt: new Date().toISOString() },
    planId,
  }
}

/** 生成首周任务：VOCAB（新词）+ REVIEW（复习）+ READING（阅读），共 7 天 */
async function generateFirstWeekTasks(userId: string, dailyMinutes: number): Promise<void> {
  const today = localDate()
  const existing = await prisma.studyTask.findMany({
    where: { userId, date: { gte: today, lte: dateOffset(today, 6) } },
    select: { date: true },
  })
  const covered = new Set(existing.map((t) => t.date))
  const vocabCount = Math.max(5, Math.round(dailyMinutes * 0.4))
  const reviewCount = Math.max(10, Math.round(dailyMinutes * 0.3))
  const readingMin = Math.max(5, dailyMinutes - Math.round(dailyMinutes * 0.7))
  const rows: Array<{
    userId: string
    date: string
    taskType: 'VOCAB' | 'REVIEW' | 'READING'
    title: string
    targetValue: number
    unit: string
    sortOrder: number
    payload: Prisma.InputJsonValue
  }> = []
  for (let i = 0; i < 7; i++) {
    const date = dateOffset(today, i)
    if (covered.has(date)) continue
    rows.push(
      {
        userId, date, taskType: 'VOCAB',
        title: `学习新词 ${vocabCount} 个`,
        targetValue: vocabCount, unit: 'word', sortOrder: 0,
        payload: { type: 'vocabulary_learn' } as Prisma.InputJsonValue,
      },
      {
        userId, date, taskType: 'REVIEW',
        title: '完成到期复习',
        targetValue: reviewCount, unit: 'word', sortOrder: 1,
        payload: { type: 'vocabulary_review' } as Prisma.InputJsonValue,
      },
      {
        userId, date, taskType: 'READING',
        title: `阅读练习 ${readingMin} 分钟`,
        targetValue: readingMin, unit: 'minute', sortOrder: 2,
        payload: { type: 'reading' } as Prisma.InputJsonValue,
      },
    )
  }
  if (rows.length > 0) {
    await prisma.studyTask.createMany({ data: rows })
    log.info({ msg: 'first-week tasks created', userId, count: rows.length })
  }
}

/** YYYY-MM-DD 日期偏移（UTC 口径，与 localDate 一致） */
function dateOffset(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
