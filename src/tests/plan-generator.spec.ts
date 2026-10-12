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
  WEAK_MINUTE_FLOOR,
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

describe('★ 验收 2（R2-3 裁决 · §5.2.3-(4)）：弱项用户听力分钟数显著高于强项', () => {
  /**
   * 口径变更（架构 docs/02-architecture.md §5.2.3-(4)）：
   * 原验收「≥ 2×」只在取整上界 2.000 恰好成立、零裕量，已**废弃**（架构师明确否决调 BASE_WEIGHT/WEAK_BONUS：
   * `+0.12` 时 round(30×0.2984)=9 与 `+0.08` 完全相同，调权重只会再造一个零裕量巧合）。
   * 新口径三件套：**(a) 严格单调 + (b) 比值 ≥ 1.5×（实测 1.8，留 ~20% 裕量）+ (c) 弱项维度绝对下限 8 分钟/日**。
   *
   * 受控单变量：其余维度全部固定为 50，**只翻转 listening 30 ↔ 90**。
   * （原实现连同其余维度一起改来凑 2.0×，属跨画像比较，已删除。）
   */
  it('(a)(b) 受控单变量 listening 30 ↔ 90：弱项 9 > 强项 5，比值 1.8 ≥ 1.5×', () => {
    const weak = generateDailyTasks(planInput({ ability: ability({ listening: 30 }) }))
    const strong = generateDailyTasks(planInput({ ability: ability({ listening: 90 }) }))

    const weakListening = taskOf(weak, 'LISTENING')?.target ?? 0
    const strongListening = taskOf(strong, 'LISTENING')?.target ?? 0

    // 受控推导：弱项 → LISTENING 0.33/1.16 → round(30×0.28448)=9
    //           强项 → LISTENING (0.25-0.05)/1.11=0.18018 → round(30×0.18018)=5
    expect(weakListening).toBe(9)
    expect(strongListening).toBe(5)

    // (a) 严格单调
    expect(weakListening).toBeGreaterThan(strongListening)
    // (b) 比值 ≥ 1.5×（实测 9/5 = 1.8）
    expect(weakListening / strongListening).toBeGreaterThanOrEqual(1.5)
  })

  it('(c) 独立不变量：弱项画像下 LISTENING 每日目标 ≥ WEAK_MINUTE_FLOOR 分钟', () => {
    const listening = taskOf(generateDailyTasks(planInput({ ability: ability({ listening: 30 }) })), 'LISTENING')
    expect(listening?.target).toBeGreaterThanOrEqual(WEAK_MINUTE_FLOOR)
    // 反证该下限是「弱项专属」而非全局地板：强项画像下不施加（实测 5 < 8），
    // 否则会把强项也拉平、抹掉 (a) 的单调性。
    const strongListening = taskOf(generateDailyTasks(planInput({ ability: ability({ listening: 90 }) })), 'LISTENING')?.target ?? 0
    expect(strongListening).toBeLessThan(WEAK_MINUTE_FLOOR)
  })

  it('(c) 护栏对所有 M 成立：小 M=20 下弱项听力仍被拉到 8 分钟', () => {
    // 无护栏时 round(20×0.28448)=6 < 8 → 由 WEAK_MINUTE_FLOOR 拉起
    const listening = taskOf(generateDailyTasks(planInput({ dailyMinutes: 20, ability: ability({ listening: 30 }) })), 'LISTENING')
    expect(listening?.target).toBe(WEAK_MINUTE_FLOOR)
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
