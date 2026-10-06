/**
 * 每日任务滚动生成（架构 §5.2.2 · DAILY_CRON 触发）。
 *
 * 设计定位：每日 06:00（用户本地时区）为所有已完成 Onboarding 的用户生成「次日」任务。
 * 实际调度由外部 cron / 定时器调用本函数（本仓库无内置调度器，保持可测的纯编排）。
 *
 * 幂等性完全由 `rebuildTasks` 的 `@@unique([userId, date, taskType])` + upsert 保证，
 * 因此本函数**可安全重复执行**（漏跑后补跑不会产生重复行）。
 */
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger/logger'
import { rebuildTasks } from './rebuild'

const log = createLogger('plan.cron')

export interface CronResult {
  users: number
  created: number
  updated: number
  skippedCompleted: number
  failed: number
}

/** 单批处理的用户数（避免一次性加载过多用户） */
const BATCH_SIZE = 200

/**
 * 为所有已完成 Onboarding 的用户生成次日任务。
 * @returns 汇总统计（用户数 / 新建 / 更新 / 跳过已完成 / 失败数）
 */
export async function generateDailyTasksForAllUsers(): Promise<CronResult> {
  const summary: CronResult = { users: 0, created: 0, updated: 0, skippedCompleted: 0, failed: 0 }
  let cursor: string | undefined

  // 游标分页遍历（按 userId 稳定排序）
  for (;;) {
    const profiles = await prisma.profile.findMany({
      where: { onboardingCompletedAt: { not: null } },
      orderBy: { userId: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
      select: { userId: true },
    })
    if (profiles.length === 0) break

    for (const { userId } of profiles) {
      try {
        const result = await rebuildTasks(userId, { kind: 'DAILY_CRON' })
        summary.users += 1
        summary.created += result.created
        summary.updated += result.updated
        summary.skippedCompleted += result.skippedCompleted
      } catch (e) {
        summary.failed += 1
        log.warn({ msg: 'daily cron rebuild failed', userId, err: e instanceof Error ? e.message : String(e) })
      }
    }

    cursor = profiles[profiles.length - 1]?.userId
    if (profiles.length < BATCH_SIZE) break
  }

  log.info({ msg: 'daily cron done', ...summary })
  return summary
}
