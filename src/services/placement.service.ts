/**
 * Placement Test 服务（架构 §8.1 T07）：
 * start（按维度抽 30 题）→ answer（暂存）→ submit（规则评分 → CEFR → CET 估算）→ report。
 * 评分纯函数与 DB 写分离；AI 报告独立降级。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { localDate } from './onboarding.service'

export const PLACEMENT_QUESTION_COUNT = 30

const DIMENSIONS = ['vocabulary', 'grammar', 'reading', 'listening'] as const
type Dimension = (typeof DIMENSIONS)[number]

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

/** 维度得分：正确率 0-100；维度 0 题时给 40（保守中位） */
export function dimensionScore(correct: number, total: number): number {
  if (total <= 0) return 40
  return Math.round((correct / total) * 100)
}

/** 总分 = 四维加权（词汇 30% / 语法 25% / 阅读 25% / 听力 20%） */
export function overallScore(scores: Omit<PlacementScores, 'overall'>): number {
  return Math.round(
    scores.vocabulary * 0.3 + scores.grammar * 0.25 + scores.reading * 0.25 + scores.listening * 0.2,
  )
}

/** 分数 → CEFR（§5.10 映射） */
export function scoreToCefr(overall: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (overall >= 85) return 'C1'
  if (overall >= 70) return 'B2'
  if (overall >= 55) return 'B1'
  if (overall >= 40) return 'A2'
  return 'A1'
}

/** CEFR + 分数 → CET 估算分（0-710） */
export function estimateCet(overall: number, cefr: string): { cet4: number; cet6: number } {
  const base = 250 + Math.round((overall / 100) * 380) // 250-630 区间
  const bump = cefr === 'B2' || cefr === 'C1' ? 30 : 0
  return {
    cet4: Math.min(710, base + 10 + bump),
    cet6: Math.min(710, Math.max(0, base - 60 + bump)),
  }
}

// ---------------------------------------------------------------------------
// DB 流程
// ---------------------------------------------------------------------------

/** 开始测试：按维度配比抽题（词汇 12 / 语法 7 / 阅读 6 / 听力 5），复用进行中的 attempt */
export async function startTest(userId: string): Promise<{ testId: string; questionCount: number }> {
  const existing = await prisma.placementTest.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (existing) return { testId: existing.id, questionCount: PLACEMENT_QUESTION_COUNT }

  const plan: Array<[Dimension, number]> = [
    ['vocabulary', 12],
    ['grammar', 7],
    ['reading', 6],
    ['listening', 5],
  ]
  const pickedIds: string[] = []
  for (const [dim, count] of plan) {
    const rows = await prisma.question.findMany({
      where: { category: dim, status: 'PUBLISHED', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: count * 4, // 池子抽样，避免每次同题
    })
    const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, count)
    pickedIds.push(...shuffled.map((r) => r.id))
  }
  if (pickedIds.length === 0) throw new AppError('RESOURCE_NOT_FOUND', '题库为空，请先执行 seed')

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

/** 读取测试题目（去答案） */
export async function getTestQuestions(userId: string, testId: string): Promise<Array<{ id: string; type: string; category: string; stem: string; options: unknown }>> {
  const test = await prisma.placementTest.findFirst({ where: { id: testId, userId }, select: { answers: true, status: true } })
  if (!test) throw errNotFound('测试不存在')
  const slots = (test.answers as Array<{ questionId: string }> | null) ?? []
  const ids = slots.map((s) => s.questionId)
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, category: true, stem: true, options: true },
  })
  // 保持出题顺序
  const byId = new Map(questions.map((q) => [q.id, q]))
  return ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => q != null)
}

/** 记录单题答案（幂等：同题覆盖） */
export async function saveAnswer(userId: string, testId: string, questionId: string, userAnswer: string, responseMs: number): Promise<void> {
  const test = await prisma.placementTest.findFirst({ where: { id: testId, userId, status: 'IN_PROGRESS' } })
  if (!test) throw errNotFound('进行中的测试不存在')
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { answer: true, category: true, answerAliases: true } })
  if (!question) throw errNotFound('题目不存在')

  const aliases = Array.isArray(question.answerAliases) ? (question.answerAliases as string[]) : []
  const normalized = userAnswer.trim().toUpperCase()
  const isCorrect = [question.answer, ...aliases].some((a) => String(a).trim().toUpperCase() === normalized)

  const slots = ((test.answers as Array<Record<string, unknown>> | null) ?? []).slice()
  const idx = slots.findIndex((s) => s.questionId === questionId)
  const entry = { questionId, userAnswer, isCorrect, dimension: question.category, responseMs }
  if (idx >= 0) slots[idx] = entry
  else slots.push(entry)

  await prisma.placementTest.update({ where: { id: testId }, data: { answers: slots } })
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
        scores,
        cefrLevel: cefr as never,
        cetEstimate: cet,
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

  // 当日统计
  const today = localDate()
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
