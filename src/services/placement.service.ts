/**
 * Placement Test 服务（架构 §8.1 T07）：
 * start（按维度抽 30 题）→ answer（暂存）→ submit（规则评分 → CEFR → CET 估算）→ report。
 * AI 报告独立降级。
 *
 * 评分纯函数已抽离到 `./placement/scoring`（无 IO，可独立单测并纳入覆盖率门禁）；
 * 本文件只保留 DB 编排。为兼容既有调用方，纯函数在此原样 re-export。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { Prisma } from '@prisma/client'
import {
  DIMENSIONS,
  PLACEMENT_QUESTION_COUNT,
  allocateQuestionCounts,
  dimensionScore,
  estimateCet,
  overallScore,
  scoreToCefr,
  type Dimension,
  type PlacementAnswer,
  type PlacementScores,
} from './placement/scoring'

const log = createLogger('placement.service')

// 兼容出口：既有 import 路径（@/services/placement.service）保持可用
export {
  DIMENSIONS,
  PLACEMENT_QUESTION_COUNT,
  allocateQuestionCounts,
  dimensionScore,
  estimateCet,
  estimateCetFor,
  mapCefr,
  overallScore,
  scoreToCefr,
  CET_BASE,
  BAND_CENTER,
  CET_MIN,
  CET_MAX,
  DIMENSION_WEIGHTS,
  type CefrLevel,
  type Dimension,
  type PlacementAnswer,
  type PlacementScores,
} from './placement/scoring'

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
