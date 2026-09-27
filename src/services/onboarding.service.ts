/**
 * Onboarding 服务（架构 §3.5.1 #17/#18）：8 步采集 → Profile/Settings/Goal 回写。
 * 跳过（skip）也走 submit：仅回写已填部分，标记 onboardingCompletedAt。
 */
import { prisma } from '@/lib/db'
import { errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'

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
        onboardingData: steps,
        onboardingCompletedAt: new Date(),
        cefrLevel: cefr as never,
      },
      create: {
        userId,
        onboardingData: steps,
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

  log.info({ msg: 'onboarding submitted', userId, skipped })
  return {
    profile: { cefrLevel: cefr, onboardingCompletedAt: new Date().toISOString() },
    planId,
  }
}
