/**
 * plan-generator.spec.ts — 权重式任务生成（架构 §5.2.2 · Phase 2 P0）。
 *
 * 覆盖 4 条分支：弱项加权 / 强项减权 / CET 目标加权 / 完成率降档（<0.5 → ×0.8）。
 * 纯函数测试：不触 DB、不调 AI。
 */
import { describe, expect, it } from 'vitest'

import {
  BASE_WEIGHT,
  CET_EXAM_TYPES,
  COMPLETION_DOWNGRADE_FACTOR,
  COMPLETION_DOWNGRADE_THRESHOLD,
  STRONG_THRESHOLD,
  WEAK_BONUS,
  computePlanWeights,
  generateDailyTasks,
  normalizeAbility,
  type AbilityVector,
  type PlanInput,
} from '@/services/plan/generator'

/** 中性能力（50）→ 便于构造对照 */
function ability(over: Partial<AbilityVector> = {}): AbilityVector {
  return { vocabulary: 50, grammar: 50, reading: 50, listening: 50, writing: 50, speaking: 50, ...over }
}

function planInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    dailyMinutes: 30,
    weeklyDays: 5,
    ability: ability(),
    goal: { examType: 'DAILY' },
    history: { avgCompletionRate: 0.8, last7Completion: [] },
    dueReviewCount: 20,
    ...over,
  }
}

const taskOf = (tasks: ReturnType<typeof generateDailyTasks>, type: string) =>
  tasks.find((t) => t.type === type)

describe('§5.2.2 四条分支', () => {
  // ---- ① 弱项加权 ----
  it('弱项加权：能力分最低的 2 项各 +0.08', () => {
    expect(WEAK_BONUS).toBe(0.08)
    // listening=30 为唯一弱项，vocabulary=90 次弱（在 90 组中稳定排序第一个）
    const p = computePlanWeights(planInput({ ability: ability({ listening: 30, vocabulary: 90, reading: 90, writing: 90, speaking: 90 }) }))
    expect(p.weakKeys).toContain('LISTENING')
    expect(p.weakHits.LISTENING).toBe(30)
    // 弱项权重高于强项减权后的同基线模块
    expect(p.weights.LISTENING).toBeGreaterThan(BASE_WEIGHT.LISTENING)
  })

  // ---- ② 强项减权 ----
  it('强项减权：能力分 ≥ 85 的维度 -0.05（净权重下降）', () => {
    expect(STRONG_THRESHOLD).toBe(85)
    const neutral = computePlanWeights(planInput({ ability: ability() }))
    const strongReading = computePlanWeights(planInput({ ability: ability({ reading: 90 }) }))
    expect(strongReading.strongKeys).toContain('READING')
    // reading=90 不是弱项命中 → 仅承受 -0.05，归一化后权重低于中性场景
    expect(strongReading.weights.READING).toBeLessThan(neutral.weights.READING)
    // 中性场景无任何 ≥85 维度
    expect(neutral.strongKeys).toHaveLength(0)
  })

  // ---- ③ CET 目标加权 ----
  it('CET 目标加权：阅读+听力 ≥45%、口语 ≤5%（口语任务被过滤）', () => {
    expect(CET_EXAM_TYPES).toEqual(['CET4', 'CET6'])
    const cet = computePlanWeights(planInput({ goal: { examType: 'CET4' } }))
    expect(cet.cetAdjusted).toBe(true)
    expect(cet.weights.SPEAKING).toBeLessThanOrEqual(0.05)
    expect(cet.weights.READING + cet.weights.LISTENING).toBeGreaterThanOrEqual(0.45)
    // 生成结果中不再出现 SPEAKING 任务
    const tasks = generateDailyTasks(planInput({ goal: { examType: 'CET4' } }))
    expect(taskOf(tasks, 'SPEAKING')).toBeUndefined()
    // 非 CET 目标不加权
    expect(computePlanWeights(planInput({ goal: { examType: 'DAILY' } })).cetAdjusted).toBe(false)
  })

  // ---- ④ 完成率降档 ----
  it('完成率降档：avgCompletionRate < 0.5 → 总时长 ×0.8', () => {
    expect(COMPLETION_DOWNGRADE_THRESHOLD).toBe(0.5)
    expect(COMPLETION_DOWNGRADE_FACTOR).toBe(0.8)
    expect(computePlanWeights(planInput({ dailyMinutes: 30, history: { avgCompletionRate: 0.4, last7Completion: [] } })).baseMinutes).toBe(24)
    // 0.5 恰好不降档（阈值严格小于）
    expect(computePlanWeights(planInput({ dailyMinutes: 30, history: { avgCompletionRate: 0.5, last7Completion: [] } })).baseMinutes).toBe(30)
    expect(computePlanWeights(planInput({ dailyMinutes: 60, history: { avgCompletionRate: 0.2, last7Completion: [] } })).baseMinutes).toBe(48)
  })
})

describe('★ 验收 2：弱项用户听力分钟数 ≥ 2 倍于强项用户', () => {
  it('listening=30（弱项）vs listening=90（强项）：听力目标值差异 ≥2×', () => {
    const weak = generateDailyTasks(
      planInput({ ability: ability({ listening: 30, vocabulary: 90, reading: 90, writing: 90, speaking: 90 }) }),
    )
    const strong = generateDailyTasks(
      planInput({ ability: ability({ listening: 90, vocabulary: 60, reading: 60, writing: 60, speaking: 60 }) }),
    )
    const weakListening = taskOf(weak, 'LISTENING')?.target ?? 0
    const strongListening = taskOf(strong, 'LISTENING')?.target ?? 0
    // 弱项 10 分钟 vs 强项 5 分钟
    expect(weakListening).toBe(10)
    expect(strongListening).toBe(5)
    expect(weakListening).toBeGreaterThanOrEqual(strongListening * 2)
  })
})

describe('生成结果结构', () => {
  it('按 sortOrder 升序、含 weightSnapshot 与 weakHits、payload 深链齐全', () => {
    const tasks = generateDailyTasks(planInput({ ability: ability({ listening: 30 }) }))
    const orders = tasks.map((t) => t.sortOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    for (const t of tasks) {
      expect(t.target).toBeGreaterThan(0)
      expect(Object.keys(t.weightSnapshot).sort()).toEqual(['LISTENING', 'READING', 'SPEAKING', 'VOCAB', 'WRITING'])
      expect(t.title.length).toBeGreaterThan(0)
    }
    // 命中弱项时每个任务都带 weakHits 快照
    expect(tasks[0]?.weakHits).not.toBeNull()
    expect(taskOf(tasks, 'LISTENING')?.weakHits?.LISTENING).toBe(30)
  })

  it('VOCAB 目标钳制在 [10,60]、归一化权重和为 1', () => {
    const p = computePlanWeights(planInput({ dailyMinutes: 15 }))
    expect(p.weights.VOCAB + p.weights.LISTENING + p.weights.READING + p.weights.WRITING + p.weights.SPEAKING).toBeCloseTo(1, 6)
    const tasks = generateDailyTasks(planInput({ dailyMinutes: 500 }))
    const vocab = taskOf(tasks, 'VOCAB')
    expect(vocab?.target).toBeLessThanOrEqual(60)
    expect(vocab?.target).toBeGreaterThanOrEqual(10)
  })

  it('REVIEW 目标不超到期池；无到期词时不生成 REVIEW 任务', () => {
    const tasks = generateDailyTasks(planInput({ dueReviewCount: 3 }))
    expect(taskOf(tasks, 'REVIEW')?.target).toBe(3)
    // dueReviewCount=0 → REVIEW 目标为 0 → 被过滤（无词可复习）
    expect(taskOf(generateDailyTasks(planInput({ dueReviewCount: 0 })), 'REVIEW')).toBeUndefined()
  })
})

describe('normalizeAbility（缺数据兜底）', () => {
  it('null / 缺失维度 → 50；越界值 clamp 到 [0,100]', () => {
    expect(normalizeAbility(null)).toEqual(ability())
    expect(normalizeAbility({ listening: 120, vocabulary: -10 }).listening).toBe(100)
    expect(normalizeAbility({ listening: 120, vocabulary: -10 }).vocabulary).toBe(0)
    expect(normalizeAbility({ listening: 120, vocabulary: -10 }).reading).toBe(50)
  })
})
