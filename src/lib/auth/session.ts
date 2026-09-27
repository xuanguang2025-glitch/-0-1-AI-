/**
 * 会话（架构 §1.4.2）：refresh 轮换 + 重放检测。
 * - AuthSession 存 refresh token 的 sha256（tokenHash），明文不下库
 * - 同一登录批次共享 familyId；检测到已撤销 token 被复用 → 整个 family 撤销
 */
import { createHash, randomUUID } from 'node:crypto'

import { prisma } from '@/lib/db'
import { AppError } from '@/lib/api/errors'
import { appConfig } from '@/lib/constants/config'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface SessionMeta {
  ip?: string
  userAgent?: string
}

/** sha256 摘要（hex） */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * 建立新会话：签发 access + refresh，并写 auth_sessions。
 * @param userId  用户 id
 * @param role    用户角色（写入 access token 冗余）
 */
export async function createSession(userId: string, role: string, meta: SessionMeta): Promise<TokenPair> {
  const familyId = randomUUID()
  const jti = randomUUID()
  const refreshToken = await signRefreshToken({ sub: userId, fid: familyId, jti })
  const accessToken = await signAccessToken({ sub: userId, role, fid: familyId })
  const expiresAt = new Date(Date.now() + appConfig.auth.refreshTtlDays * 24 * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      familyId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  })
  return { accessToken, refreshToken }
}

/** 轮换 refresh：旧 token 置 revoked，签发新 token 对（同 family） */
export async function rotateSession(refreshToken: string, meta: SessionMeta): Promise<TokenPair & { userId: string; role: string }> {
  await verifyRefreshToken(refreshToken) // 签名/过期校验，载荷细节不需要
  const tokenHash = sha256(refreshToken)

  const session = await prisma.authSession.findUnique({ where: { tokenHash } })
  if (!session) {
    // 不在册的 refresh token → 伪造
    throw new AppError('AUTH_TOKEN_INVALID')
  }

  if (session.revokedAt) {
    // ★ 重放检测：已撤销 token 被复用 → 撤销整个 family
    await prisma.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    throw new AppError('AUTH_SESSION_REVOKED')
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new AppError('AUTH_TOKEN_EXPIRED')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, status: true, deletedAt: true },
  })
  if (!user || user.deletedAt) throw new AppError('AUTH_TOKEN_INVALID')
  if (user.status === 'DISABLED') throw new AppError('AUTH_ACCOUNT_DISABLED')

  const newJti = randomUUID()
  const newRefreshToken = await signRefreshToken({ sub: user.id, fid: session.familyId, jti: newJti })
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, fid: session.familyId })

  await prisma.$transaction([
    prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: sha256(newRefreshToken),
        familyId: session.familyId,
        expiresAt: new Date(Date.now() + appConfig.auth.refreshTtlDays * 24 * 60 * 60 * 1000),
        rotateCount: session.rotateCount + 1,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ])

  return { accessToken, refreshToken: newRefreshToken, userId: user.id, role: user.role }
}

/** 登出：撤销当前 refresh 所在 session（不整族撤销，只登出本设备） */
export async function revokeSession(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return
  const tokenHash = sha256(refreshToken)
  await prisma.authSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** 强制登出某用户全部设备（改密/重置密码后调用） */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

/** 撤销整个 family（安全事件时使用） */
export async function revokeFamily(familyId: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}
