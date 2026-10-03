/**
 * Placement Test 服务（架构 §8.1 T07）：
 * start（按维度抽 30 题）→ answer（暂存）→ submit（规则评分 → CEFR → CET 估算）→ report。
 * 评分纯函数与 DB 写分离；AI 报告独立降级。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { Prisma } from '@prisma/client'

const log = createLogger('placement.service')

export const PLACEMENT_QUESTION_COUNT = 30

type Dimension = 'vocabulary' | 'grammar' | 'reading' | 'listening'
const DIMENSIONS: readonly string[] = ['vocabulary', 'grammar', 'reading', 'listening']

export interface PlacementAnswer {
  questionId: string
  userAnswer: string
  isCorrect: boolean
  dimension: string
  responseMs: number
}

export interface PlacementScores {
  vocabulary: number
  grammar: number
  reading: number
  listening: number
  overall: number
}

// ---------------------------------------------------------------------------
// 评分纯函数（可单测）
// ---------------------------------------------------------------------------

/**
 * 维度权重（PRD Q9 / §十一）：词汇 30% / 语法 30% / 阅读 25% / 听力 15%。
 * 评分与抽题配比共用同一份权重常量，保证「怎么算分」与「出几道题」口径一致。
 */
export const DIMENSION_WEIGHTS: Readonly<Record<Dimension, number>> = {
  vocabulary: 0.3,
  grammar: 0.3,
  reading: 0.25,
  listening: 0.15,
}

/** 维度得分：正确率 0-100；维度 0 题时给 40（保守中位） */
export function dimensionScore(correct: number, total: number): number {
  if (total <= 0) return 40
  return Math.round((correct / total) * 100)
}

/** 总分 = 四维加权（词汇 30% / 语法 30% / 阅读 25% / 听力 15%，PRD Q9） */
export function overallScore(scores: Omit<PlacementScores, 'overall'>): number {
  return Math.round(
    scores.vocabulary * DIMENSION_WEIGHTS.vocabulary +
      scores.grammar * DIMENSION_WEIGHTS.grammar +
      scores.reading * DIMENSION_WEIGHTS.reading +
      scores.listening * DIMENSION_WEIGHTS.listening,
  )
}

/** CEFR 档位（与 prisma CEFRLevel 枚举一致） */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** 分数 → CEFR（架构 §5.5 mapCefr：88/78/65/50/33 五段 + C2 顶档） */
export function scoreToCefr(overall: number): CefrLevel {
  if (overall >= 88) return 'C2'
  if (overall >= 78) return 'C1'
  if (overall >= 65) return 'B2'
  if (overall >= 50) return 'B1'
  if (overall >= 33) return 'A2'
  return 'A1'
}

/** 文档别名（§5.5 mapCefr） */
export const mapCefr = scoreToCefr

/** CET 基准分（§5.5 CET_BASE，710 分制） */
export const CET_BASE: Readonly<Record<CefrLevel, number>> = {
  A1: 220,
  A2: 330,
  B1: 420,
  B2: 520,
  C1: 600,
  C2: 660,
}

/** 各档位在 0-100 综合分区间内的中心点（§5.5 BAND_CENTER，用于档内线性微调） */
export const BAND_CENTER: Readonly<Record<CefrLevel, number>> = {
  A1: 20,
  A2: 42,
  B1: 58,
  B2: 72,
  C1: 84,
  C2: 94,
}

/** CET 估算上下限（§5.5 clamp 区间） */
export const CET_MIN = 220
export const CET_MAX = 700

/** 数值夹取 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 单科 CET 估算（§5.5 estimateCet）：
 * base = CET_BASE[level]；adjust = round(0.5 × (overall − BAND_CENTER[level]))；
 * CET-6 同水平略低（×0.92）；结果 clamp 到 [220, 700]。
 */
export function estimateCetFor(overall: number, level: CefrLevel, exam: 'CET4' | 'CET6'): number {
  const base = CET_BASE[level]
  const adjust = Math.round(0.5 * (overall - BAND_CENTER[level]))
  const raw = exam === 'CET4' ? base + adjust : (base + adjust) * 0.92
  return clamp(Math.round(raw), CET_MIN, CET_MAX)
}

/** CET-4 / CET-6 双科估算（落库到 placement_tests.cetEstimate） */
export function estimateCet(overall: number, level: CefrLevel): { cet4: number; cet6: number } {
  return {
    cet4: estimateCetFor(overall, level, 'CET4'),
    cet6: estimateCetFor(overall, level, 'CET6'),
  }
}

/**
 * 按维度权重把总题量分配到四个维度（最大余额法，整数且总和守恒）。
 * PRD Q9 固定 30 题 → 词汇 9 / 语法 9 / 阅读 8 / 听力 4。
 */
export function allocateQuestionCounts(total: number): Record<Dimension, number> {
  const dims: Dimension[] = ['vocabulary', 'grammar', 'reading', 'listening']
  const exact = dims.map((d) => ({ dim: d, value: total * DIMENSION_WEIGHTS[d] }))
  const counts = Object.fromEntries(dims.map((d) => [d, 0])) as Record<Dimension, number>
  let assigned = 0
  for (const item of exact) {
    const floor = Math.floor(item.value)
    counts[item.dim] = floor
    assigned += floor
  }
  // 余数按小数部分从大到小补齐
  const remainders = exact
    .map((item) => ({ dim: item.dim, frac: item.value - Math.floor(item.value) }))
    .sort((a, b) => b.frac - a.frac)
  for (let i = 0; assigned < total && i < remainders.length; i += 1) {
    const target = remainders[i]!
    counts[target.dim] += 1
    assigned += 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// DB 流程
// ---------------------------------------------------------------------------

/**
 * 开始测试：按维度权重配比抽题（PRD Q9：30 题 → 词汇 9 / 语法 9 / 阅读 8 / 听力 4），
 * 复用进行中的 attempt；题池不足时显式告警并按实际题量建卷（不静默缩水）。
 */
export async function startTest(userId: string): Promise<{ testId: string; questionCount: number }> {
  const existing = await prisma.placementTest.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (existing) return { testId: existing.id, questionCount: PLACEMENT_QUESTION_COUNT }

  const plan = allocateQuestionCounts(PLACEMENT_QUESTION_COUNT)
  const pickedIds: string[] = []
  const shortages: string[] = []
  for (const dim of DIMENSIONS as readonly Dimension[]) {
    const want = plan[dim]
    const rows = await prisma.question.findMany({
      where: {
        OR: [{ tags: { array_contains: dim } }, { category: dim }],
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: want * 4, // 池子抽样，避免每次同题
    })
    if (rows.length < want) {
      shortages.push(`${dim}: 需 ${want} 题，题池仅 ${rows.length} 题`)
    }
    const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, want)
    pickedIds.push(...shuffled.map((r) => r.id))
  }
  if (pickedIds.length === 0) throw new AppError('RESOURCE_NOT_FOUND', '题库为空，请先执行 seed')
  if (shortages.length > 0) {
    log.warn({ msg: 'placement question pool insufficient', userId, picked: pickedIds.length, shortages })
  }

  const test = await prisma.placementTest.create({
    data: { userId, questionCount: pickedIds.length },
  })
  // 题目顺序存 answers 槽位（answer 阶段填充）
  await prisma.placementTest.update({
    where: { id: test.id },
    data: { answers: pickedIds.map((qid) => ({ questionId: qid, userAnswer: null, isCorrect: false, dimension: '', responseMs: 0 })) },
  })
  return { testId: test.id, questionCount: pickedIds.length }
}

/** 从 tags/category 归一化维度（seed 把维度写在 tags[0]） */
export function questionDimension(q: { tags: unknown; category: string }): string {
  const tags = Array.isArray(q.tags) ? (q.tags as unknown[]) : []
  for (const t of tags) {
    const s = String(t).toLowerCase()
    if ((DIMENSIONS as readonly string[]).includes(s)) return s
  }
  return q.category
}

/** 读取测试题目（去答案，含归一化维度） */
export async function getTestQuestions(userId: string, testId: string): Promise<Array<{ id: string; type: string; category: string; dimension: string; stem: string; options: unknown }>> {
  const test = await prisma.placementTest.findFirst({ where: { id: testId, userId }, select: { answers: true, status: true } })
  if (!test) throw errNotFound('测试不存在')
  const slots = (test.answers as Array<{ questionId: string }> | null) ?? []
  const ids = slots.map((s) => s.questionId)
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, category: true, tags: true, stem: true, options: true },
  })
  // 保持出题顺序
  const byId = new Map(questions.map((q) => [q.id, q]))
  return ids
    .map((id) => byId.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null)
    .map((q) => ({ ...q, dimension: questionDimension(q) }))
}

/** 记录单题答案（幂等：同题覆盖） */
export async function saveAnswer(userId: string, testId: string, questionId: string, userAnswer: string, responseMs: number): Promise<void> {
  const test = await prisma.placementTest.findFirst({ where: { id: testId, userId, status: 'IN_PROGRESS' } })
  if (!test) throw errNotFound('进行中的测试不存在')
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { answer: true, category: true, tags: true, answerAliases: true } })
  if (!question) throw errNotFound('题目不存在')
  const dimension = questionDimension(question)

  const aliases = Array.isArray(question.answerAliases) ? (question.answerAliases as string[]) : []
  const normalized = userAnswer.trim().toUpperCase()
  const isCorrect = [question.answer, ...aliases].some((a) => String(a).trim().toUpperCase() === normalized)

  const slots = ((test.answers as Array<Record<string, unknown>> | null) ?? []).slice()
  const idx = slots.findIndex((s) => s.questionId === questionId)
  const entry = { questionId, userAnswer, isCorrect, dimension, responseMs }
  if (idx >= 0) slots[idx] = entry
  else slots.push(entry)

  await prisma.placementTest.update({ where: { id: testId }, data: { answers: slots as unknown as Prisma.InputJsonValue } })
}

/** 提交：规则评分 → CEFR → CET 估算 → 写 Profile 能力向量 + DailyStat；AI 报告独立降级 */
export async function submitTest(userId: string, testId: string): Promise<{ scores: PlacementScores; cefr: string; cet: { cet4: number; cet6: number }; testId: string }> {
  const test = await prisma.placementTest.findFirst({ where: { id: testId, userId, status: 'IN_PROGRESS' } })
  if (!test) throw errNotFound('进行中的测试不存在')

  const slots = (test.answers as PlacementAnswer[] | null) ?? []
  const answered = slots.filter((s) => s.userAnswer !== null && s.userAnswer !== '')

  const dimStats = new Map<string, { correct: number; total: number }>()
  for (const a of answered) {
    const stat = dimStats.get(a.dimension) ?? { correct: 0, total: 0 }
    stat.total += 1
    if (a.isCorrect) stat.correct += 1
    dimStats.set(a.dimension, stat)
  }
  const partial = {
    vocabulary: dimensionScore(dimStats.get('vocabulary')?.correct ?? 0, dimStats.get('vocabulary')?.total ?? 0),
    grammar: dimensionScore(dimStats.get('grammar')?.correct ?? 0, dimStats.get('grammar')?.total ?? 0),
    reading: dimensionScore(dimStats.get('reading')?.correct ?? 0, dimStats.get('reading')?.total ?? 0),
    listening: dimensionScore(dimStats.get('listening')?.correct ?? 0, dimStats.get('listening')?.total ?? 0),
  }
  const overall = overallScore(partial)
  const cefr = scoreToCefr(overall)
  const cet = estimateCet(overall, cefr)
  const scores: PlacementScores = { ...partial, overall }

  // AI 报告（独立降级：失败不影响成绩落库）
  let aiReport: unknown = null
  let aiDegraded = false
  try {
    const { aiService } = await import('./ai/ai.service')
    const result = await aiService.cetAdvice(
      { scoresJson: scores, targetExam: 'PLACEMENT' },
      { userId, traceId: `placement-${testId}`, locale: 'zh-CN' },
    )
    aiReport = result.data
    aiDegraded = result.degraded
  } catch {
    aiDegraded = true
  }

  await prisma.$transaction([
    prisma.placementTest.update({
      where: { id: testId },
      data: {
        status: 'GRADED',
        completedAt: new Date(),
        scores: scores as unknown as Prisma.InputJsonValue,
        cefrLevel: cefr as never,
        cetEstimate: cet as unknown as Prisma.InputJsonValue,
        aiReport: aiReport as never,
        aiDegraded,
      },
    }),
    // 回写 Profile 能力向量 + CEFR
    prisma.profile.updateMany({
      where: { userId },
      data: {
        cefrLevel: cefr as never,
        cetEstimatedScore: cet.cet4,
        currentScore: cet.cet4,
        abilityVector: {
          vocabulary: partial.vocabulary,
          grammar: partial.grammar,
          reading: partial.reading,
          listening: partial.listening,
          writing: 40,
          speaking: 40,
        },
      },
    }),
  ])

  // 当日统计（按用户时区口径）
  const today = await userToday(userId)
  await prisma.dailyLearningStat.upsert({
    where: { userId_date: { userId, date: today } },
    update: { examCount: { increment: 1 }, correctCount: { increment: answered.filter((a) => a.isCorrect).length }, wrongCount: { increment: answered.filter((a) => !a.isCorrect).length }, xpEarned: { increment: 50 } },
    create: { userId, date: today, examCount: 1, correctCount: answered.filter((a) => a.isCorrect).length, wrongCount: answered.filter((a) => !a.isCorrect).length, xpEarned: 50 },
  })

  return { scores, cefr, cet, testId }
}

/** 报告：测试 + 题目明细 */
export async function getReport(userId: string, testId: string) {
  const test = await prisma.placementTest.findFirst({
    where: { id: testId, userId, status: { in: ['GRADED', 'SUBMITTED'] } },
  })
  if (!test) throw errNotFound('报告不存在')

  const slots = (test.answers as PlacementAnswer[] | null) ?? []
  const ids = slots.map((s) => s.questionId)
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, stem: true, answer: true, explanation: true, category: true },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))
  const problems = slots
    .filter((s) => !s.isCorrect)
    .map((s) => ({
      stem: byId.get(s.questionId)?.stem ?? '',
      userAnswer: s.userAnswer,
      correctAnswer: byId.get(s.questionId)?.answer ?? '',
      explanation: byId.get(s.questionId)?.explanation ?? '',
      dimension: s.dimension,
    }))

  return {
    testId: test.id,
    scores: test.scores as PlacementScores | null,
    cefr: test.cefrLevel,
    cet: test.cetEstimate as { cet4: number; cet6: number } | null,
    aiReport: test.aiReport,
    aiDegraded: test.aiDegraded,
    completedAt: test.completedAt?.toISOString() ?? null,
    problems,
  }
}
