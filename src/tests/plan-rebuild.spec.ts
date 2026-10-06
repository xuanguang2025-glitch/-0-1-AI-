/**
 * plan-rebuild.spec.ts — 计划重建逻辑（架构 §5.2.2 验收 4/6）。
 *
 * 用 mock 替换 Prisma 与用户时区解析，验证 `rebuildTasks` 的两条承重行为：
 *   1) 幂等：以 `(userId, date, taskType)` 复合唯一键 upsert（验收 4）；
 *   2) 已完成任务绝不改动、只重算未完成任务（验收 1/6）；
 * 以及触发窗口：DAILY_CRON 只生成次日、PLACEMENT_COMPLETED 覆盖 7 天。
 *
 * 说明：真实 DB 的 `@@unique` 约束由 schema 保证，此处验证**编排逻辑**与键的选择。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  existing: [] as Array<{ id: string; date: string; taskType: string; status: string }>,
  upserts: [] as Array<{
    where: { userId_date_taskType: { userId: string; date: string; taskType: string } }
    create: Record<string, unknown>
    update: Record<string, unknown>
  }>,
}))

vi.mock('@/lib/db', () => {
  const tx = {
    studyTask: {
      findMany: vi.fn(async () => h.existing),
      upsert: vi.fn(async (args: (typeof h.upserts)[number]) => {
        h.upserts.push(args)
        return { id: 'x' }
      }),
    },
  }
  const prisma = {
    profile: { findUnique: vi.fn(async () => ({ abilityVector: null })) },
    userSettings: { findUnique: vi.fn(async () => ({ dailyGoalMinutes: 30, weeklyGoalDays: 5 })) },
    learningGoal: { findFirst: vi.fn(async () => null) },
    dailyLearningStat: { findMany: vi.fn(async () => []) },
    userVocabulary: { count: vi.fn(async () => 12) },
    studyPlan: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  }
  return { prisma }
})

vi.mock('@/lib/utils/user-date', () => ({ userToday: vi.fn(async () => '2026-01-01') }))

import { rebuildTasks } from '@/services/plan/rebuild'

const keyOf = (u: (typeof h.upserts)[number]) =>
  `${u.where.userId_date_taskType.date}:${u.where.userId_date_taskType.taskType}`

describe('rebuildTasks（§5.2.2 计划重建）', () => {
  beforeEach(() => {
    h.existing.length = 0
    h.upserts.length = 0
  })

  it('已完成任务被跳过：不产生 upsert，且 status 不被改动（验收 6）', async () => {
    h.existing.push({ id: 't1', date: '2026-01-01', taskType: 'VOCAB', status: 'COMPLETED' })
    const res = await rebuildTasks('u1', { kind: 'PLACEMENT_COMPLETED' })

    const keys = h.upserts.map(keyOf)
    expect(keys).not.toContain('2026-01-01:VOCAB')
    expect(res.skippedCompleted).toBe(1)
    // 生成的其它任务与其它日期仍被写入
    expect(res.created).toBeGreaterThan(0)
    // 已完成的 VOCAB 未出现在任何 upsert 的 where 中（未被 update 覆盖）
    expect(h.upserts.every((u) => keyOf(u) !== '2026-01-01:VOCAB')).toBe(true)
  })

  it('幂等：每个写入都使用 (userId,date,taskType) 复合唯一键（验收 4）', async () => {
    await rebuildTasks('u1', { kind: 'PLACEMENT_COMPLETED' })
    expect(h.upserts.length).toBeGreaterThan(0)
    for (const u of h.upserts) {
      expect(u.where.userId_date_taskType.userId).toBe('u1')
      expect(typeof u.where.userId_date_taskType.date).toBe('string')
      expect(typeof u.where.userId_date_taskType.taskType).toBe('string')
      // update 分支（重算未完成任务）与 create 分支都带 weightSnapshot
      expect(u.create.weightSnapshot).toBeDefined()
    }
    // 去重：同一 (date,taskType) 不重复
    const keys = h.upserts.map(keyOf)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('触发窗口：PLACEMENT_COMPLETED 覆盖今日起 7 天，DAILY_CRON 只生成次日', async () => {
    await rebuildTasks('u1', { kind: 'PLACEMENT_COMPLETED' })
    const week = new Set(h.upserts.map((u) => u.where.userId_date_taskType.date))
    expect([...week].sort()).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
    ])

    h.upserts.length = 0
    await rebuildTasks('u1', { kind: 'DAILY_CRON' })
    const nextDay = new Set(h.upserts.map((u) => u.where.userId_date_taskType.date))
    expect([...nextDay]).toEqual(['2026-01-02'])
    // 来源标记正确
    expect(h.upserts.every((u) => u.create.source === 'DAILY_CRON')).toBe(true)
  })
})
