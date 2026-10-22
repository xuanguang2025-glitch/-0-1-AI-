/**
 * 专项训练卷服务（架构 §3.1 E1-E3 / Phase 2 设计 T20）。
 *
 * 关键决策：
 *   - **交卷幂等**（验收 2）：已 SUBMITTED 的 attempt 直接返回现态，不重复判分；
 *   - **确定性判分**：全部客观题（needsAiGrading=false），字母比对，0 AI；
 *   - **不写 cetEstimate**（验收 4）：710 分制缺标定样本，架构师裁决 Phase 2 禁用——
 *     sectionScores 记录各 section 的原始正确数/得分，不做 CET 换算；
 *   - **错题入库**：答错写 `wrong_questions`（source='exam'），与阅读/语法/听力同构；
 *   - 报告描述显式标注「专项训练卷，非 CET 全真模考」（验收 3 由前端 practice-scope-notice 呈现）。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { Prisma, type ExamSection } from '@prisma/client'

import { userToday } from '@/lib/utils/user-date'

const log = createLogger('exam.service')

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface ExamPaperListItem {
  id: string
  title: string
  examType: string
  section: string
  difficulty: string
  description: string | null
  durationMin: number
  questionCount: number
  myAttemptCount: number
}

export interface ExamPaperListResult {
  papers: ExamPaperListItem[]
  total: number
}

/** 开始作答（试卷 + 题目，**不含答案**） */
export interface ExamStartResult {
  attemptId: string
  paperId: string
  title: string
  description: string | null
  durationMin: number
  deadlineAt: string
  questions: Array<{
    id: string
    section: string
    type: string
    stem: string
    options: string[] | null
    score: number
  }>
}

export interface ExamAnswerItem {
  examQuestionId: string
  userAnswer: string
}

export interface ExamSubmitResult {
  attemptId: string
  status: string
  objectiveScore: number
  totalScore: number
  totalQuestions: number
  correctCount: number
  accuracy: number
  /** 各 section 分项：{section: {correct, total, score}}（**非 CET 换算**） */
  sectionScores: Record<string, { correct: number; total: number; score: number }>
  wrongCount: number
  /** idempotent = 重复交卷返回现态 */
  idempotent: boolean
}

// ---------------------------------------------------------------------------
// E1 · 试卷列表
// ---------------------------------------------------------------------------

export async function listPapers(userId: string): Promise<ExamPaperListResult> {
  const [rows, attempts] = await Promise.all([
    prisma.examPaper.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        examType: true,
        description: true,
        durationMin: true,
        _count: { select: { questions: true } },
        questions: { select: { section: true }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.examAttempt.groupBy({ by: ['paperId'], where: { userId }, _count: { _all: true } }),
  ])
  const countByPaper = new Map(attempts.map((a) => [a.paperId, a._count._all]))

  // section 从 structure JSON 取（paper 级无单字段）
  const papers: ExamPaperListItem[] = rows.map((row) => {
    return {
      id: row.id,
      title: row.title,
      examType: row.examType,
      section: sectionOfPaper(row.title),
      difficulty: '—',
      description: row.description,
      durationMin: row.durationMin,
      questionCount: row._count.questions,
      myAttemptCount: countByPaper.get(row.id) ?? 0,
    }
  })
  return { papers, total: papers.length }
}

/** 从标题提取专项类名（「听力专项 ·」→ 听力） */
function sectionOfPaper(title: string): string {
  const m = title.match(/^(听力|阅读|语法|词汇)专项/)
  return m?.[1] ?? '综合'
}

// ---------------------------------------------------------------------------
// E2 · 开始作答
// ---------------------------------------------------------------------------

export async function startAttempt(userId: string, paperId: string): Promise<ExamStartResult> {
  const paper = await prisma.examPaper.findFirst({
    where: { id: paperId, status: 'PUBLISHED' },
    select: { id: true, title: true, description: true, durationMin: true, questions: { select: { id: true, section: true, type: true, stem: true, options: true, score: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } } },
  })
  if (paper === null) throw errNotFound('试卷不存在')

  const attempt = await prisma.examAttempt.create({
    data: {
      userId,
      paperId,
      status: 'IN_PROGRESS',
      deadlineAt: new Date(Date.now() + paper.durationMin * 60_000),
    },
    select: { id: true, deadlineAt: true },
  })

  const optionsOf = (v: unknown): string[] | null =>
    Array.isArray(v) ? (v as unknown[]).filter((o): o is string => typeof o === 'string') : null

  return {
    attemptId: attempt.id,
    paperId: paper.id,
    title: paper.title,
    description: paper.description,
    durationMin: paper.durationMin,
    deadlineAt: (attempt.deadlineAt ?? new Date()).toISOString(),
    // **不含 answer/explanation**（判分在服务端，防前端自评）
    questions: paper.questions.map((q) => ({
      id: q.id,
      section: q.section,
      type: q.type,
      stem: q.stem,
      options: optionsOf(q.options),
      score: q.score,
    })),
  }
}

// ---------------------------------------------------------------------------
// 自动保存（验收 2：答题自动保存；乱序到达保护 saveVersion++）
// ---------------------------------------------------------------------------

export async function saveAnswer(
  userId: string,
  attemptId: string,
  input: { examQuestionId: string; userAnswer: string; saveVersion?: number },
): Promise<{ savedVersion: number }> {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId, status: 'IN_PROGRESS' },
    select: { id: true, saveVersion: true },
  })
  if (attempt === null) throw errNotFound('进行中的考试不存在（可能已交卷）')

  await prisma.examAnswer.upsert({
    where: { attemptId_examQuestionId: { attemptId, examQuestionId: input.examQuestionId } },
    update: { userAnswer: input.userAnswer, savedAt: new Date() },
    create: { attemptId, examQuestionId: input.examQuestionId, userAnswer: input.userAnswer, answeredAt: new Date() },
  })

  const savedVersion = attempt.saveVersion + 1
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { saveVersion: savedVersion } })
  return { savedVersion }
}

// ---------------------------------------------------------------------------
// E3 · 交卷（幂等判分）
// ---------------------------------------------------------------------------

export async function submitAttempt(
  userId: string,
  attemptId: string,
  input: { answers: ExamAnswerItem[]; timeUsedSec?: number },
): Promise<ExamSubmitResult> {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, status: true, objectiveScore: true, totalScore: true, sectionScores: true, paperId: true },
  })
  if (attempt === null) throw errNotFound('考试不存在')

  // **幂等**：已交卷直接返回现态（验收 2）
  if (attempt.status !== 'IN_PROGRESS') {
    const sectionScores = (attempt.sectionScores ?? {}) as Record<string, { correct: number; total: number; score: number }>
    const totalQuestions = Object.values(sectionScores).reduce((n, s) => n + s.total, 0)
    const correctCount = Object.values(sectionScores).reduce((n, s) => n + s.correct, 0)
    return {
      attemptId: attempt.id,
      status: attempt.status,
      objectiveScore: attempt.objectiveScore,
      totalScore: attempt.totalScore,
      totalQuestions,
      correctCount,
      accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
      sectionScores,
      wrongCount: 0,
      idempotent: true,
    }
  }

  // 取题目（服务端判分）
  const questions = await prisma.examQuestion.findMany({
    where: { paperId: attempt.paperId },
    select: { id: true, section: true, stem: true, options: true, answer: true, explanation: true, score: true },
    orderBy: { sortOrder: 'asc' },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))
  const answerMap = new Map(input.answers.map((a) => [a.examQuestionId, a.userAnswer]))

  const sectionScores: Record<string, { correct: number; total: number; score: number }> = {}
  let correctCount = 0
  let objectiveScore = 0
  const wrongRows: Array<{ id: string; stem: string; userAnswer: string; correctAnswer: string; explanation: string | null; section: ExamSection }> = []

  for (const q of questions) {
    const userAnswer = answerMap.get(q.id) ?? ''
    const isCorrect = userAnswer.trim() !== '' && normalize(q.answer ?? '') === normalize(userAnswer)
    const stat = sectionScores[q.section] ?? { correct: 0, total: 0, score: 0 }
    stat.total += 1
    if (isCorrect) {
      stat.correct += 1
      stat.score += q.score
      correctCount += 1
      objectiveScore += q.score
    } else if (userAnswer.trim() !== '') {
      wrongRows.push({ id: q.id, stem: q.stem, userAnswer, correctAnswer: q.answer ?? '', explanation: q.explanation, section: q.section })
    }
    sectionScores[q.section] = stat
  }

  const total = questions.length
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0

  // ---- 事务：答案落库 + attempt 收尾 + 错题入库 + 当日统计 ----
  await prisma.$transaction(async (tx) => {
    for (const q of questions) {
      const userAnswer = answerMap.get(q.id) ?? ''
      const isCorrect = userAnswer.trim() !== '' && normalize(q.answer ?? '') === normalize(userAnswer)
      await tx.examAnswer.upsert({
        where: { attemptId_examQuestionId: { attemptId, examQuestionId: q.id } },
        update: { userAnswer, isCorrect, score: isCorrect ? (byId.get(q.id)?.score ?? 0) : 0, answeredAt: new Date() },
        create: {
          attemptId,
          examQuestionId: q.id,
          userAnswer,
          isCorrect,
          score: isCorrect ? q.score : 0,
          answeredAt: new Date(),
        },
      })
    }

    await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        objectiveScore,
        totalScore: objectiveScore,
        // **不写 cetEstimate**（验收 4：710 分制缺标定样本，Phase 2 禁用）
        sectionScores: sectionScores as unknown as Prisma.InputJsonValue,
        timeUsedSec: input.timeUsedSec ?? 0,
      },
    })

    // 错题入库（source='exam'，与阅读/语法/听力同构；同题重复错累加 errorCount）
    for (const w of wrongRows) {
      const existing = await tx.wrongQuestion.findFirst({
        where: { userId, source: 'exam', refType: 'exam_question', refId: w.id, masteredAt: null },
        select: { id: true, errorCount: true },
      })
      const optionsOfQuestion = byId.get(w.id)
      if (existing !== null) {
        await tx.wrongQuestion.update({
          where: { id: existing.id },
          data: { errorCount: existing.errorCount + 1, lastWrongAt: new Date() },
        })
      } else {
        await tx.wrongQuestion.create({
          data: {
            userId,
            source: 'exam',
            refType: 'exam_question',
            refId: w.id,
            stem: w.stem,
            options: ((optionsOfQuestion?.options ?? null) as unknown as Prisma.InputJsonValue),
            userAnswer: w.userAnswer,
            correctAnswer: w.correctAnswer,
            explanation: w.explanation,
            knowledgePoints: [w.section] as unknown as Prisma.InputJsonValue,
          },
        })
      }
    }

    const today = await userToday(userId)
    await tx.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: { examCount: { increment: 1 } },
      create: { userId, date: today, examCount: 1 },
    })
  })

  log.info({ msg: 'exam submitted', userId, attemptId, objectiveScore, accuracy, wrongCount: wrongRows.length })

  return {
    attemptId,
    status: 'SUBMITTED',
    objectiveScore,
    totalScore: objectiveScore,
    totalQuestions: total,
    correctCount,
    accuracy,
    sectionScores,
    wrongCount: wrongRows.length,
    idempotent: false,
  }
}

// ---------------------------------------------------------------------------
// E3b · 报告
// ---------------------------------------------------------------------------

export interface ExamReportResult extends ExamSubmitResult {
  paperTitle: string
  paperDescription: string | null
  /** 每题判定（报告页逐题解析用） */
  answers: Array<{
    examQuestionId: string
    stem: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
    explanation: string | null
  }>
}

export async function getExamReport(userId: string, attemptId: string): Promise<ExamReportResult> {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      status: true,
      objectiveScore: true,
      totalScore: true,
      sectionScores: true,
      paper: { select: { title: true, description: true } },
      answers: { select: { examQuestionId: true, userAnswer: true, isCorrect: true, examQuestion: { select: { stem: true, answer: true, explanation: true } } } },
    },
  })
  if (attempt === null) throw errNotFound('考试记录不存在')
  if (attempt.status === 'IN_PROGRESS') throw new AppError('VALIDATION_ERROR', '考试尚未交卷')

  const sectionScores = (attempt.sectionScores ?? {}) as Record<string, { correct: number; total: number; score: number }>
  const totalQuestions = Object.values(sectionScores).reduce((n, s) => n + s.total, 0)
  const correctCount = Object.values(sectionScores).reduce((n, s) => n + s.correct, 0)

  return {
    attemptId: attempt.id,
    status: attempt.status,
    objectiveScore: attempt.objectiveScore,
    totalScore: attempt.totalScore,
    totalQuestions,
    correctCount,
    accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
    sectionScores,
    wrongCount: attempt.answers.filter((a) => a.isCorrect === false).length,
    idempotent: true,
    paperTitle: attempt.paper.title,
    paperDescription: attempt.paper.description,
    answers: attempt.answers.map((a) => ({
      examQuestionId: a.examQuestionId,
      stem: a.examQuestion.stem,
      userAnswer: a.userAnswer ?? '',
      correctAnswer: a.examQuestion.answer ?? '',
      isCorrect: a.isCorrect === true,
      explanation: a.examQuestion.explanation,
    })),
  }
}

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[.\-、,，\s]/g, '')
}
