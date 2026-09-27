/**
 * 登录防爆破（架构 §1.4.6/§1.4.8）：
 * 连续失败 5 次 → 锁定 15 分钟（users.failedLoginCount / lockedUntil 持久化）。
 */
import { prisma } from '@/lib/db'
import { appConfig } from '@/lib/constants/config'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_MINUTES = 15

export interface LockState {
  locked: boolean
  /** 锁定剩余毫秒；未锁定为 0 */
  remainingMs: number
  /** 本轮还允许尝试几次 */
  remainingAttempts: number
}

/** 读取锁定状态 */
export async function getLockState(userId: string): Promise<LockState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true, failedLoginCount: true },
  })
  if (!user) return { locked: false, remainingMs: 0, remainingAttempts: MAX_FAILED_ATTEMPTS }
  const lockedUntil = user.lockedUntil?.getTime() ?? 0
  if (lockedUntil > Date.now()) {
    return {
      locked: true,
      remainingMs: lockedUntil - Date.now(),
      remainingAttempts: 0,
    }
  }
  return {
    locked: false,
    remainingMs: 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - user.failedLoginCount),
  }
}

/** 登录失败：计数 +1，达到阈值即锁定 */
export async function recordFailure(userId: string): Promise<LockState> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  })
  if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000)
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil } })
    return { locked: true, remainingMs: LOCK_MINUTES * 60_000, remainingAttempts: 0 }
  }
  return {
    locked: false,
    remainingMs: 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - user.failedLoginCount),
  }
}

/** 登录成功：清零计数与锁定 */
export async function resetFailures(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  })
}

/** 锁定时长（毫秒），供 423 响应展示 */
export function lockTtlMs(): number {
  return LOCK_MINUTES * 60_000 + appConfig.auth.accessTtlSeconds // +accessTtl 无业务含义，仅为对齐类型；实际展示用 remainingMs
}
