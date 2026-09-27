/**
 * 用户服务：profile / settings / avatar / goals。
 * 纯业务层：userId 一律从 session 注入，禁止信任 query/body。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import type { LearningGoalDto, UserProfileDto, UserSettingsDto, UserStatsDto } from '@/types/dto/user.dto'

const log = createLogger('user.service')

/** 获取/兜底 profile（注册时已建，理论必存在） */
export async function getProfile(userId: string): Promise<UserProfileDto> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { user: { select: { nickname: true } } },
  })
  if (!profile) throw errNotFound('Profile')
  const settings = await prisma.userSettings.findUnique({ where: { userId } })
  return {
    userId: profile.userId,
    nickname: profile.user.nickname,
    bio: profile.bio,
    gradeBand: profile.cefrLevel ?? null,
    targetExam: null,
    dailyGoalMinutes: settings?.dailyGoalMinutes ?? 30,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

/** 更新 profile（白名单字段） */
export async function updateProfile(
  userId: string,
  input: { nickname?: string; bio?: string; realName?: string; gender?: string; targetScore?: number },
): Promise<UserProfileDto> {
  const { nickname, ...profileFields } = input
  if (nickname !== undefined && nickname.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', undefined, { details: [{ field: 'nickname', message: '昵称不能为空' }] })
  }
  await prisma.$transaction(async (tx) => {
    if (nickname !== undefined) {
      await tx.user.update({ where: { id: userId }, data: { nickname: nickname.trim() } })
    }
    const data = Object.fromEntries(
      Object.entries(profileFields).filter(([, v]) => v !== undefined),
    )
    if (Object.keys(data).length > 0) {
      await tx.profile.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      })
    }
  })
  log.info({ msg: 'profile updated', userId })
  return getProfile(userId)
}

/** 获取 settings */
export async function getSettings(userId: string): Promise<UserSettingsDto> {
  const s = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true, timezone: true } })
  return {
    userId: s.userId,
    locale: user.locale,
    timezone: user.timezone,
    theme: s.theme,
    notificationPrefs: (s.notificationPrefs ?? {}) as Record<string, unknown>,
    updatedAt: s.updatedAt.toISOString(),
  }
}

/** 更新 settings（部分更新） */
export async function updateSettings(
  userId: string,
  input: { theme?: string; locale?: string; timezone?: string; dailyGoalMinutes?: number; notificationPrefs?: Record<string, unknown> },
): Promise<UserSettingsDto> {
  const { locale, timezone, ...settingsData } = input
  await prisma.$transaction(async (tx) => {
    const filtered = Object.fromEntries(
      Object.entries(settingsData).filter(([, v]) => v !== undefined),
    )
    if (Object.keys(filtered).length > 0) {
      await tx.userSettings.upsert({ where: { userId }, update: filtered, create: { userId, ...filtered } })
    }
    const userUpdate = Object.fromEntries(
      Object.entries({ locale, timezone }).filter(([, v]) => v !== undefined),
    )
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({ where: { id: userId }, data: userUpdate })
    }
  })
  log.info({ msg: 'settings updated', userId })
  return getSettings(userId)
}

/** 获取学习统计 */
export async function getStats(userId: string): Promise<UserStatsDto> {
  const stats = await prisma.userStats.upsert({ where: { userId }, update: {}, create: { userId } })
  return {
    userId: stats.userId,
    xp: stats.xp,
    level: stats.level,
    streakDays: stats.streakDays,
    totalStudyMinutes: Math.floor(stats.totalStudySeconds / 60),
    masteredWords: stats.wordsMastered,
    updatedAt: stats.updatedAt.toISOString(),
  }
}

/** 更新头像（URL 由上传接口产出，此处仅写引用；白名单校验 https 且为图片路径） */
export async function updateAvatar(userId: string, avatarUrl: string): Promise<{ avatarUrl: string }> {
  if (!/^https?:\/\/.+\.(png|jpe?g|webp|gif)$/i.test(avatarUrl) && !avatarUrl.startsWith('/storage/')) {
    throw new AppError('VALIDATION_ERROR', undefined, {
      details: [{ field: 'avatarUrl', message: '仅支持 png/jpg/webp/gif 图片地址' }],
    })
  }
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } })
  log.info({ msg: 'avatar updated', userId })
  return { avatarUrl }
}

/** 学习目标列表 */
export async function listGoals(userId: string): Promise<LearningGoalDto[]> {
  const goals = await prisma.learningGoal.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: { priority: 'desc' },
  })
  return goals.map((g) => ({
    id: g.id,
    userId: g.userId,
    type: g.goalType,
    targetExam: g.targetExam ?? null,
    targetDate: g.targetDate?.toISOString() ?? null,
    dailyMinutes: g.dailyMinutes,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
  }))
}

/** 创建学习目标 */
export async function createGoal(
  userId: string,
  input: { type: string; targetExam?: string | null; targetDate?: string | null; dailyMinutes?: number; targetScore?: number },
): Promise<LearningGoalDto> {
  const goal = await prisma.learningGoal.create({
    data: {
      userId,
      goalType: input.type as never,
      targetExam: (input.targetExam ?? undefined) as never,
      targetScore: input.targetScore,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      dailyMinutes: input.dailyMinutes ?? 30,
    },
  })
  log.info({ msg: 'goal created', userId, goalId: goal.id })
  return {
    id: goal.id,
    userId: goal.userId,
    type: goal.goalType,
    targetExam: goal.targetExam ?? null,
    targetDate: goal.targetDate?.toISOString() ?? null,
    dailyMinutes: goal.dailyMinutes,
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
  }
}

/** 放弃/达成目标（软状态机，不做物理删除） */
export async function closeGoal(userId: string, goalId: string, status: 'ACHIEVED' | 'ABANDONED'): Promise<void> {
  const goal = await prisma.learningGoal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== userId) throw errNotFound('LearningGoal')
  await prisma.learningGoal.update({ where: { id: goalId }, data: { status } })
}
