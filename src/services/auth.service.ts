/**
 * 认证服务（架构 §1.4.2）：注册 / 登录 / 刷新 / 登出 / 找回密码。
 * 纯业务层：不感知 HTTP，只操作 prisma 与 lib/auth 原语。
 */
import { randomUUID } from 'node:crypto'

import { prisma } from '@/lib/db'
import { AppError } from '@/lib/api/errors'
import { appConfig } from '@/lib/constants/config'
import { createLogger } from '@/lib/logger/logger'
import { currentTraceId } from '@/lib/logger/request-context'
import { assertStrongPassword, hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, revokeAllSessions, revokeSession, rotateSession, sha256, type SessionMeta } from '@/lib/auth/session'
import { getLockState, recordFailure, resetFailures } from '@/lib/auth/login-guard'
import type { AuthUserDto, ForgotPasswordResultDto, LoginResultDto, RefreshResultDto, RegisterResultDto, ResetPasswordResultDto } from '@/types/dto/auth.dto'

const log = createLogger('auth.service')

/** User → DTO（禁止泄漏 passwordHash） */
function toUserDto(user: {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  role: string
  status: string
  locale: string
  timezone: string
  emailVerifiedAt: Date | null
  createdAt: Date
}): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    locale: user.locale,
    timezone: user.timezone,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  }
}

/** 注册：邮箱唯一 + 强密码 + 建会话（201 由 route 决定） */
export async function register(
  input: { email: string; password: string; nickname: string },
  meta: SessionMeta,
): Promise<RegisterResultDto> {
  assertStrongPassword(input.password)
  const email = input.email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw new AppError('AUTH_EMAIL_TAKEN')

  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      nickname: input.nickname.trim() || (email.split('@')[0] ?? 'learner'),
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      lastLoginIp: meta.ip,
    },
  })

  // 初始化默认 profile / stats / settings（注册一次性）
  await prisma.$transaction([
    prisma.profile.create({ data: { userId: user.id } }),
    prisma.userStats.create({ data: { userId: user.id } }),
    prisma.userSettings.create({ data: { userId: user.id } }),
  ])

  const tokens = await createSession(user.id, user.role, meta)
  log.info({ msg: 'register', userId: user.id, traceId: currentTraceId() })
  return { user: toUserDto(user), ...tokens }
}

/** 登录：锁定检查 → 密码校验 → 失败计数 → 会话 */
export async function login(
  input: { email: string; password: string },
  meta: SessionMeta,
): Promise<LoginResultDto> {
  const email = input.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.deletedAt) throw new AppError('AUTH_BAD_CREDENTIALS')
  if (user.status === 'DISABLED') throw new AppError('AUTH_ACCOUNT_DISABLED')

  // 锁定检查（持久化在 users.lockedUntil）
  const lock = await getLockState(user.id)
  if (lock.locked) throw new AppError('AUTH_ACCOUNT_LOCKED')

  const passwordOk = await verifyPassword(input.password, user.passwordHash)
  if (!passwordOk) {
    const state = await recordFailure(user.id)
    if (state.locked) throw new AppError('AUTH_ACCOUNT_LOCKED')
    throw new AppError('AUTH_BAD_CREDENTIALS', `邮箱或密码错误（还可尝试 ${state.remainingAttempts} 次）`)
  }

  await resetFailures(user.id)
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: meta.ip },
  })

  const tokens = await createSession(user.id, user.role, meta)
  log.info({ msg: 'login', userId: user.id, traceId: currentTraceId() })
  return { user: toUserDto(user), ...tokens }
}

/** 刷新：轮换 + 重放检测（session.ts 内实现） */
export async function refresh(refreshToken: string, meta: SessionMeta): Promise<RefreshResultDto> {
  const result = await rotateSession(refreshToken, meta)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } })
  return { user: toUserDto(user), accessToken: result.accessToken, refreshToken: result.refreshToken }
}

/** 登出：撤销当前设备会话 */
export async function logout(refreshToken: string | undefined): Promise<void> {
  await revokeSession(refreshToken)
}

/** 当前用户信息（withAuth 已解出 userId） */
export async function me(userId: string): Promise<AuthUserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new AppError('AUTH_TOKEN_INVALID')
  return toUserDto(user)
}

/** 忘记密码：签发一次性 token（Phase 1 不发邮件，dev 下日志输出链接） */
export async function forgotPassword(email: string): Promise<ForgotPasswordResultDto> {
  const normalized = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })
  // 防枚举：邮箱不存在也返回成功
  if (!user) return { devHint: null }

  // 速率：1 小时内最多 3 个有效 token
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  })
  if (recent >= 3) return { devHint: null }

  const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60_000), // 30 分钟有效
    },
  })

  // Phase 1 决策（架构 Q15）：不发真实邮件，仅服务端日志输出（生产不打）
  const devHint = appConfig.app.isProd ? null : `重置链接: /reset-password?token=${rawToken}`
  if (devHint) log.info({ msg: devHint, userId: user.id })
  return { devHint }
}

/** 重置密码：校验 token → 改密 → 撤销全部会话 */
export async function resetPassword(input: { token: string; password: string }): Promise<ResetPasswordResultDto> {
  assertStrongPassword(input.password)
  const tokenHash = sha256(input.token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new AppError('AUTH_TOKEN_INVALID', '重置链接无效或已过期')
  }

  const passwordHash = await hashPassword(input.password)
  const revoked = await revokeAllSessions(record.userId)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  log.info({ msg: 'password reset', userId: record.userId, traceId: currentTraceId() })
  return { revokedSessions: revoked }
}
