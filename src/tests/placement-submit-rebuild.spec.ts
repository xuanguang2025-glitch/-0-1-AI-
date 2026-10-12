/**
 * placement-submit-rebuild.spec.ts — R2-1（QA 第四轮 P1）M1 触发链路回归。
 *
 * 背景：T12 声称「Placement 交卷后由前端调用 rebuild」，但实际**无任何调用方**
 * 访问 `/api/study-plan/rebuild`（前端 submit 只调 `/api/placement/${id}/submit`），
 * 导致 M1（交卷 → 能力向量落库 → 计划重算）闭环断裂。
 *
 * 修复：在服务端 `submitTest` 的事务提交之后**直接**触发 `rebuildTasks`。
 * 本用例不做「rebuild 函数本身」的黑盒测试（那由 plan-rebuild.spec.ts 覆盖），
 * 而是验证**真实触发链路**：
 *   1) 交卷成功后 rebuildTasks 确实被调用，且参数为 PLACEMENT_COMPLETED；
 *   2) 调用发生在评测事务提交**之后**（时序正确）；
 *   3) rebuild 失败不阻断交卷、不回滚已落库评测（尽力而为副作用）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface AnswerSlot {
  questionId: string
  userAnswer: string | null
  isCorrect: boolean
  dimension: string
  responseMs: number
}

const h = vi.hoisted(() => ({
  /** 调用时序（tx / rebuild），用于断言 rebuild 在事务提交之后 */
  order: [] as string[],
  rebuildCalls: [] as Array<{ userId: string; trigger: unknown }>,
  /** 可切换的 rebuild 行为：正常返回 / 抛错 */
  rebuildThrow: false,
  /** placementTest.findFirst 的返回：null 表示测试不存在/已完成 */
  findFirstResult: null as { id: string; status: string; answers: AnswerSlot[] } | null,
  updateManyCalled: false,
}))

vi.mock('@/lib/db', () => {
  const prisma = {
    placementTest: {
      findFirst: vi.fn(async () => h.findFirstResult),
      update: vi.fn(async () => ({})),
    },
    profile: {
      updateMany: vi.fn(async () => {
        h.updateManyCalled = true
        return {}
      }),
    },
    dailyLearningStat: { upsert: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (arg: unknown) => {
      h.order.push('tx')
      if (Array.isArray(arg)) return Promise.all(arg)
      return (arg as (t: unknown) => Promise<unknown>)({})
    }),
  }
  return { prisma }
})

vi.mock('@/lib/utils/user-date', () => ({ userToday: vi.fn(async () => '2026-01-01') }))

// AI 报告独立降级：本用例不关心，mock 成 degraded。
vi.mock('@/services/ai/ai.service', () => ({
  aiService: { cetAdvice: vi.fn(async () => ({ data: null, degraded: true })) },
}))

// 关键：拦截计划重建模块，记录调用（动态 import 亦被拦截）。
vi.mock('@/services/plan/rebuild', () => ({
  rebuildTasks: vi.fn(async (userId: string, trigger: unknown) => {
    h.order.push('rebuild')
    h.rebuildCalls.push({ userId, trigger })
    if (h.rebuildThrow) throw new Error('rebuild boom')
    return { trigger: 'PLACEMENT_COMPLETED', created: 3, updated: 1, skippedCompleted: 0, dates: [] }
  }),
}))

import { submitTest } from '@/services/placement.service'

const ANSWERS: AnswerSlot[] = [
  { questionId: 'q1', userAnswer: 'A', isCorrect: true, dimension: 'vocabulary', responseMs: 1500 },
  { questionId: 'q2', userAnswer: 'B', isCorrect: false, dimension: 'grammar', responseMs: 1500 },
]

describe('submitTest → 计划重算触发链路（R2-1 / M1）', () => {
  beforeEach(() => {
    h.order.length = 0
    h.rebuildCalls.length = 0
    h.rebuildThrow = false
    h.updateManyCalled = false
    h.findFirstResult = { id: 't1', status: 'IN_PROGRESS', answers: ANSWERS }
  })

  it('交卷成功后服务端触发 rebuildTasks(PLACEMENT_COMPLETED)，且发生在事务提交之后', async () => {
    const result = await submitTest('u1', 't1')

    // ① 确实触发了重建，参数正确
    expect(h.rebuildCalls).toHaveLength(1)
    expect(h.rebuildCalls[0]?.userId).toBe('u1')
    expect(h.rebuildCalls[0]?.trigger).toEqual({ kind: 'PLACEMENT_COMPLETED' })

    // ② 时序：先提交评测事务，再重建计划
    expect(h.order).toEqual(['tx', 'rebuild'])

    // ③ 返回体标记重建成功，且评分结果可用
    expect(result.planRegenerated).toBe(true)
    expect(result.cefr).toBeTruthy()
    expect(result.scores.overall).toBeGreaterThanOrEqual(0)
  })

  it('rebuild 抛错不阻断交卷、不回滚评测（planRegenerated=false）', async () => {
    h.rebuildThrow = true

    const result = await submitTest('u1', 't1')

    // 交卷正常返回、评测已提交（成绩与能力向量落库）
    expect(result.planRegenerated).toBe(false)
    expect(result.testId).toBe('t1')
    expect(result.scores).toBeDefined()
    expect(h.updateManyCalled).toBe(true) // Profile 能力向量已写入
    expect(h.rebuildCalls).toHaveLength(1) // 触发过重建（只是失败了）
  })

  it('测试不存在/已交卷（无 IN_PROGRESS）：抛错且不触发 rebuild', async () => {
    h.findFirstResult = null
    await expect(submitTest('u1', 't1')).rejects.toThrow()
    expect(h.rebuildCalls).toHaveLength(0)
  })
})
