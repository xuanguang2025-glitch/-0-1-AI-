/**
 * 每日任务生成（架构 §5.2.2 · Phase 2 P0 权重式算法）。
 *
 * 与 §5.2.1 Phase 1 的线性分配（词汇 0.4 / 复习 0.3 / 阅读 0.3）不同，
 * 本模块按「能力向量 + 考试目标 + 完成率」动态分配各模块权重：
 *   ① 弱项优先：可映射到任务模块的能力维度中，最低的 2 项各 +0.08
 *   ② 强项减权：能力分 ≥ 85 的维度 -0.05
 *   ③ 考试目标加权：CET4/6 → 阅读 +0.05、听力 +0.05、口语 -0.10
 *   ④ 完成率自适应：avgCompletionRate < 0.5 → 总时长 × 0.8
 *   ⑤ 归一化后按模块系数折算为具体任务目标值
 *
 * 纯函数、无 IO：单测覆盖 4 条分支（弱项/强项/CET/完成率降档）。
 *
 * ⚠️ 口径说明：`ability.grammar` 不参与权重加成——`BASE_WEIGHT` 未定义 GRAMMAR 模块
 *    （§5.2.2 保持 BASE_WEIGHT 不变），故弱项选择只在 5 个可映射维度（VOCAB/LISTENING/
 *    READING/WRITING/SPEAKING）内进行；grammar 的能力分仍参与能力画像，但不改变任务权重。
 */

/** 有独立权重的任务模块 */
export type WeightModule = 'VOCAB' | 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING'
/** 全部可生成的任务类型（REVIEW 由 VOCAB 权重派生，不单独参与归一化） */
export type PlanTaskType = WeightModule | 'REVIEW'
export type PlanUnit = 'word' | 'piece' | 'minute'

/** 六维能力向量（0-100，Phase 2 起由 Placement 填充） */
export interface AbilityVector {
  vocabulary: number
  grammar: number
  reading: number
  listening: number
  writing: number
  speaking: number
}

export interface PlanGoal {
  examType: string
  targetScore?: number | null
  targetDate?: Date | null
}

export interface PlanHistory {
  avgCompletionRate: number
  last7Completion: number[]
}

export interface PlanInput {
  dailyMinutes: number
  weeklyDays: number
  ability: AbilityVector
  goal: PlanGoal
  history: PlanHistory
  dueReviewCount: number
}

export interface GeneratedTask {
  type: PlanTaskType
  title: string
  target: number
  unit: PlanUnit
  sortOrder: number
  /** 生成时各模块权重快照（写入 StudyTask.weightSnapshot，供归因分析） */
  weightSnapshot: Record<WeightModule, number>
  /** 弱项优先命中项 {LISTENING: 30}（写入 StudyTask.weakHits），无命中为 null */
  weakHits: Record<string, number> | null
}

export interface PlanWeights {
  /** 归一化后的各模块权重（和为 1） */
  weights: Record<WeightModule, number>
  /** 完成率降档后的基准分钟数 M */
  baseMinutes: number
  /** 命中弱项加权的模块 */
  weakKeys: WeightModule[]
  /** 命中强项减权的模块 */
  strongKeys: WeightModule[]
  /** 弱项命中项 {LISTENING: 30} */
  weakHits: Record<string, number>
  /** 是否施加了 CET 目标加权 */
  cetAdjusted: boolean
}

// ---------------------------------------------------------------------------
// 算法常量（§5.2.2）
// ---------------------------------------------------------------------------

export const BASE_WEIGHT: Record<WeightModule, number> = {
  VOCAB: 0.35,
  LISTENING: 0.25,
  READING: 0.2,
  WRITING: 0.1,
  SPEAKING: 0.1,
}

export const WEAK_BONUS = 0.08
export const STRONG_THRESHOLD = 85
export const STRONG_PENALTY = 0.05
export const CET_EXAM_TYPES: readonly string[] = ['CET4', 'CET6']
export const CARRY_READING_BONUS = 0.05
export const CARRY_LISTENING_BONUS = 0.05
export const CARRY_SPEAKING_PENALTY = 0.1
export const COMPLETION_DOWNGRADE_THRESHOLD = 0.5
export const COMPLETION_DOWNGRADE_FACTOR = 0.8

/** 弱项选择顺序（仅含可映射到任务模块的维度） */
export const WEIGHT_MODULES: readonly WeightModule[] = ['VOCAB', 'LISTENING', 'READING', 'WRITING', 'SPEAKING']

/** 能力维度 → 任务模块（grammar 无对应任务模块） */
const ABILITY_TO_MODULE: ReadonlyArray<{ ability: keyof AbilityVector; module: WeightModule | null }> = [
  { ability: 'vocabulary', module: 'VOCAB' },
  { ability: 'listening', module: 'LISTENING' },
  { ability: 'reading', module: 'READING' },
  { ability: 'writing', module: 'WRITING' },
  { ability: 'speaking', module: 'SPEAKING' },
  { ability: 'grammar', module: null },
]

/** 任务标题文案（中文） */
const TASK_TITLE: Record<PlanTaskType, (target: number) => string> = {
  VOCAB: (t) => `学习新词 ${t} 个`,
  REVIEW: () => '完成到期复习',
  LISTENING: (t) => `听力训练 ${t} 分钟`,
  READING: (t) => `阅读练习 ${t} 篇`,
  WRITING: (t) => `写作练习 ${t} 篇`,
  SPEAKING: (t) => `口语训练 ${t} 分钟`,
}

const TASK_UNIT: Record<PlanTaskType, PlanUnit> = {
  VOCAB: 'word',
  REVIEW: 'word',
  LISTENING: 'minute',
  READING: 'piece',
  WRITING: 'piece',
  SPEAKING: 'minute',
}

const TASK_SORT_ORDER: Record<PlanTaskType, number> = {
  VOCAB: 0,
  REVIEW: 1,
  LISTENING: 2,
  READING: 3,
  WRITING: 4,
  SPEAKING: 5,
}

/** 任务类型 → 深链 payload（点击任务直达对应学习页） */
export const TASK_PAYLOAD: Record<PlanTaskType, { type: string }> = {
  VOCAB: { type: 'vocabulary_learn' },
  REVIEW: { type: 'vocabulary_review' },
  LISTENING: { type: 'listening' },
  READING: { type: 'reading' },
  WRITING: { type: 'writing' },
  SPEAKING: { type: 'speaking' },
}

// ---------------------------------------------------------------------------
// 纯函数
// ---------------------------------------------------------------------------

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** 归一化能力向量：缺失/非法维度回退 50（中性） */
export function normalizeAbility(ability: Partial<AbilityVector> | null | undefined): AbilityVector {
  const pick = (v: number | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 50
  return {
    vocabulary: pick(ability?.vocabulary),
    grammar: pick(ability?.grammar),
    reading: pick(ability?.reading),
    listening: pick(ability?.listening),
    writing: pick(ability?.writing),
    speaking: pick(ability?.speaking),
  }
}

/** 计算权重与基准分钟数（§5.2.2 步骤 ①②③④） */
export function computePlanWeights(input: PlanInput): PlanWeights {
  const ability = normalizeAbility(input.ability)
  const weights: Record<WeightModule, number> = { ...BASE_WEIGHT }

  // ① 弱项优先：可映射维度中能力分最低的 2 项各 +0.08
  const mapped = ABILITY_TO_MODULE.filter((m): m is { ability: keyof AbilityVector; module: WeightModule } =>
    m.module !== null,
  )
    .map((m) => ({ module: m.module, score: ability[m.ability] }))
    .sort((a, b) => a.score - b.score)
  const weakPicks = mapped.slice(0, 2)
  for (const p of weakPicks) weights[p.module] += WEAK_BONUS

  // ② 强项减权：≥ 85 的维度 -0.05
  const strongKeys: WeightModule[] = []
  for (const m of mapped) {
    if (m.score >= STRONG_THRESHOLD) {
      weights[m.module] -= STRONG_PENALTY
      strongKeys.push(m.module)
    }
  }

  // ③ 考试目标加权：CET4/6 → 阅读 +0.05、听力 +0.05、口语 -0.10
  const cetAdjusted = CET_EXAM_TYPES.includes(input.goal.examType)
  if (cetAdjusted) {
    weights.READING += CARRY_READING_BONUS
    weights.LISTENING += CARRY_LISTENING_BONUS
    weights.SPEAKING -= CARRY_SPEAKING_PENALTY
  }

  // 防负权重
  for (const k of WEIGHT_MODULES) if (weights[k] < 0) weights[k] = 0

  // 归一化
  const sum = WEIGHT_MODULES.reduce((acc, k) => acc + weights[k], 0)
  if (sum > 0) for (const k of WEIGHT_MODULES) weights[k] = weights[k] / sum

  // ④ 完成率自适应：< 0.5 → 总时长 × 0.8
  const rate = Number.isFinite(input.history.avgCompletionRate) ? input.history.avgCompletionRate : 1
  const factor = rate < COMPLETION_DOWNGRADE_THRESHOLD ? COMPLETION_DOWNGRADE_FACTOR : 1
  const baseMinutes = Math.max(0, Math.round(input.dailyMinutes * factor))

  const weakHits: Record<string, number> = {}
  for (const p of weakPicks) weakHits[p.module] = p.score

  return {
    weights,
    baseMinutes,
    weakKeys: weakPicks.map((p) => p.module),
    strongKeys,
    weakHits,
    cetAdjusted,
  }
}

/**
 * 生成每日任务（§5.2.2）：纯函数，返回按 `sortOrder` 升序的任务列表。
 * 目标值 ≤ 0 的任务会被过滤（如 CET 目标下 SPEAKING 归零）。
 */
export function generateDailyTasks(input: PlanInput): GeneratedTask[] {
  const { weights, baseMinutes: M, weakHits } = computePlanWeights(input)
  const dueReviewCount = Math.max(0, Math.round(input.dueReviewCount))
  const hasWeakHits = Object.keys(weakHits).length > 0

  const targets: Array<{ type: PlanTaskType; target: number }> = [
    // ~1.2 词/分钟
    { type: 'VOCAB', target: clampInt(M * weights.VOCAB * 1.2, 10, 60) },
    // 复习量受到期池约束
    { type: 'REVIEW', target: Math.min(dueReviewCount, clampInt(M * weights.VOCAB * 0.8, 0, 600) + 10) },
    { type: 'LISTENING', target: Math.max(clampInt(M * weights.LISTENING, 0, 600), 5) },
    // ~8 min/篇
    { type: 'READING', target: clampInt((M * weights.READING) / 8, 1, 5) },
    // ~25 min/篇
    { type: 'WRITING', target: clampInt((M * weights.WRITING) / 25, 0, 2) },
    { type: 'SPEAKING', target: Math.max(clampInt(M * weights.SPEAKING, 0, 600), 0) },
  ]

  return targets
    .filter((t) => t.target > 0)
    .map((t) => ({
      type: t.type,
      title: TASK_TITLE[t.type](t.target),
      target: t.target,
      unit: TASK_UNIT[t.type],
      sortOrder: TASK_SORT_ORDER[t.type],
      weightSnapshot: { ...weights },
      weakHits: hasWeakHits ? { ...weakHits } : null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
