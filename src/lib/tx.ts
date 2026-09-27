import type { Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/db'

/**
 * 事务包装 + 乐观锁重试（架构 §2.5.4 / §3.3）。
 *
 * - `tx()`：统一事务入口 —— 明细与 `daily_learning_stats` upsert 必须同事务，
 *   失败整体回滚，不允许出现「明细已写汇总未写」的漂移；
 * - `withOptimisticRetry()`：`updateMany({ where: { id, version } })` 返回 0 行时
 *   重读后重算，最多重试 `maxRetries` 次（P2004 / P2034 视为版本冲突）。
 */

/** 交互式事务的客户端类型（与 `prisma.$transaction(async (tx) => …)` 的入参一致）。 */
export type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface TxOptions {
  /** 事务超时（ms），默认 15s */
  timeout?: number
  /** 隔离级别 */
  isolationLevel?: Prisma.TransactionIsolationLevel
  /** 乐观锁最大重试次数（仅 `withOptimisticRetry`） */
  maxRetries?: number
}

const isVersionConflict = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code
  return code === 'P2004' || code === 'P2034'
}

/**
 * 在事务中执行 `fn`；抛错即整体回滚。
 *
 * @example
 * await tx(async (t) => {
 *   await t.learningRecord.create({ data: { … } })
 *   await t.dailyLearningStat.upsert({ … })
 * })
 */
export async function tx<T>(fn: (tx: PrismaTx) => Promise<T>, options: TxOptions = {}): Promise<T> {
  return prisma.$transaction(
    async (transaction) => fn(transaction),
    {
      timeout: options.timeout ?? 15_000,
      maxWait: 5_000,
      ...(options.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
    },
  )
}

/**
 * 带乐观锁重试的事务执行：版本冲突（P2004/P2034）时重读并重算。
 * `fn` 内部**必须**重读最新状态（不要闭包缓存旧值）。
 */
export async function withOptimisticRetry<T>(
  fn: (tx: PrismaTx) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  let lastError: unknown = new Error('withOptimisticRetry: no attempt executed')
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await tx(fn, options)
    } catch (error) {
      lastError = error
      if (!isVersionConflict(error) || attempt === maxRetries) throw error
      // 指数退避：40ms → 80ms → 160ms
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt))
    }
  }
  throw lastError
}

/**
 * 乐观锁更新模板：以 `{ id, version }` 为条件 `updateMany`，命中 0 行即视为冲突。
 * 返回更新行数（1 = 成功，0 = 版本冲突/行不存在），由调用方决定重试策略。
 *
 * @example
 * const hit = await updateGuardedVersion(prisma.userStats, { id, version }, { xp: { increment: 10 } })
 */
export async function updateGuardedVersion<
  T extends { updateMany: (args: { where: object; data: object }) => Promise<{ count: number }> },
>(delegate: T, where: { id: string; version: number }, data: object): Promise<number> {
  const result = await delegate.updateMany({ where, data })
  return result.count
}
