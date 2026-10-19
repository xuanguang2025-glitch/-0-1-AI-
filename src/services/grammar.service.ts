/**
 * 语法学习服务（架构 §3.1 G1-G5 / Phase 2 设计 T16）。
 *
 * 关键决策：
 *   - **判分全部走确定性算法**（选择题字母比对），0 个依赖 AI —— Mock 阶段完整可用；
 *   - AI 只在「知识点讲解」一处介入（G5），且 Mock/降级时**回落静态知识点**
 *     （`source='static'`，设计文档验收 3），页面依然完整——与阅读的「隐藏区块」
 *     策略不同：语法讲解是学习主体，不能整个消失；
 *   - 错题自动写入 `wrong_questions`（source='grammar'）；
 *   - 掌握度落在 `user_grammar_progress`（累计正确率），徽章随练习结果变化（验收 4）。
 *
 * 本文件为 DB 编排层。
 */
import { prisma } from '@/lib/db'
import { errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { Prisma } from '@prisma/client'

import { aiService } from './ai/ai.service'

const log = createLogger('grammar.service')

/** 掌握度判定阈值（累计正确率 ≥80 且练习 ≥3 次视为掌握） */
export const MASTERY_THRESHOLD = 80
export const MASTERY_MIN_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/** 知识点讲解块（GrammarTopic.content 元素） */
export interface GrammarContentPoint {
  title: string
  content: string
}

/** 例句 */
export interface GrammarExample {
  en: string
  zh: string
  structure: string
}

/** 错误示例对照 */
export interface GrammarErrorExample {
  wrong: string
  right: string
  reason: string
}

/** 树节点（G1） */
export interface GrammarTopicNode {
  id: string
  name: string
  slug: string
  category: string
  difficulty: string
  orderIndex: number
  questionCount: number
  /** 当前用户掌握度 0-100；未练习为 null */
  mastery: number | null
  mastered: boolean
  children: GrammarTopicNode[]
}

export interface GrammarTopicListResult {
  topics: GrammarTopicNode[]
  total: number
}

/** 主题详情（G2） */
export interface GrammarTopicDetail {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  difficulty: string
  content: GrammarContentPoint[]
  examples: GrammarExample[]
  errorExamples: GrammarErrorExample[]
  questionCount: number
  mastery: number | null
  mastered: boolean
  attemptCount: number
  correctCount: number
}

/** 练习题（G3，**不含答案**） */
export interface GrammarExerciseItem {
  id: string
  type: string
  stem: string
  options: string[] | null
}

export interface GrammarExerciseResult {
  topicId: string
  topicName: string
  questions: GrammarExerciseItem[]
  total: number
}

/** 逐题结果（G4 返回 / 报告页用） */
export interface GrammarAnswerResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
}

export interface GrammarSubmitResult {
  topicId: string
  score: number
  total: number
  correctCount: number
  accuracy: number
  answers: GrammarAnswerResult[]
  /** 本次新增错题本条目数 */
  wrongCount: number
  /** 更新后的掌握度 */
  mastery: number
  mastered: boolean
  attemptCount: number
}

export interface GrammarExplainResult {
  topicId: string
  pointTitle: string
  /** 讲解正文（AI 生成或静态兜底，永不为 null） */
  explanation: string
  /** ai = AI 生成；static = 静态知识点兜底 */
  source: 'ai' | 'static'
}

// ---------------------------------------------------------------------------
// 解析助手
// ---------------------------------------------------------------------------

function parseContentPoints(value: unknown): GrammarContentPoint[] {
  if (!Array.isArray(value)) return []
  const out: GrammarContentPoint[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { title?: unknown; content?: unknown }
    if (typeof r.content !== 'string') continue
    out.push({
      title: typeof r.title === 'string' ? r.title : '',
      content: r.content,
    })
  }
  return out
}

function parseExamples(value: unknown): GrammarExample[] {
  if (!Array.isArray(value)) return []
  const out: GrammarExample[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { en?: unknown; zh?: unknown; structure?: unknown }
    if (typeof r.en !== 'string') continue
    out.push({
      en: r.en,
      zh: typeof r.zh === 'string' ? r.zh : '',
      structure: typeof r.structure === 'string' ? r.structure : '',
    })
  }
  return out
}

function parseErrorExamples(value: unknown): GrammarErrorExample[] {
  if (!Array.isArray(value)) return []
  const out: GrammarErrorExample[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { wrong?: unknown; right?: unknown; reason?: unknown }
    if (typeof r.wrong !== 'string' || typeof r.right !== 'string') continue
    out.push({ wrong: r.wrong, right: r.right, reason: typeof r.reason === 'string' ? r.reason : '' })
  }
  return out
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function normalizeAnswer(raw: string): string {
  return raw.trim().toUpperCase().replace(/[.\-、,，\s]/g, '')
}

/** 单选/判断题判分 */
export function gradeGrammarQuestion(userAnswer: string, correct: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correct)
}

/** 静态兜底讲解：由知识点与例句拼装（AI 不可用时使用） */
function staticExplanation(
  topicName: string,
  points: GrammarContentPoint[],
  examples: GrammarExample[],
  pointTitle?: string,
): string {
  const picked = pointTitle ? points.filter((p) => p.title === pointTitle) : points
  const used = picked.length > 0 ? picked : points
  const lines: string[] = [`【${topicName}】核心要点`]
  for (const p of used.slice(0, 4)) {
    lines.push(p.title ? `· ${p.title}：${p.content}` : `· ${p.content}`)
  }
  if (examples.length > 0) {
    lines.push('例句：')
    for (const e of examples.slice(0, 3)) {
      lines.push(`· ${e.en}${e.zh ? ` —— ${e.zh}` : ''}${e.structure ? `（${e.structure}）` : ''}`)
    }
  }
  if (lines.length === 1) {
    lines.push('该知识点暂无详细讲解，建议结合例句与练习巩固。')
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// G1 · 主题树
// ---------------------------------------------------------------------------

const TOPIC_TREE_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  difficulty: true,
  parentId: true,
  orderIndex: true,
  _count: { select: { questions: true } },
} satisfies Prisma.GrammarTopicSelect

type TopicTreeRow = Prisma.GrammarTopicGetPayload<{ select: typeof TOPIC_TREE_SELECT }>

export async function listTopics(userId: string): Promise<GrammarTopicListResult> {
  const [rows, progresses] = await Promise.all([
    prisma.grammarTopic.findMany({
      where: { status: 'PUBLISHED' },
      select: TOPIC_TREE_SELECT,
      orderBy: [{ orderIndex: 'asc' }],
    }),
    prisma.userGrammarProgress.findMany({
      where: { userId },
      select: { topicId: true, mastery: true, attemptCount: true },
    }),
  ])

  const progressById = new Map(progresses.map((p) => [p.topicId, p]))

  const toNode = (row: TopicTreeRow): GrammarTopicNode => {
    const p = progressById.get(row.id)
    const mastery = p && p.attemptCount > 0 ? p.mastery : null
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      difficulty: row.difficulty,
      orderIndex: row.orderIndex,
      questionCount: row._count?.questions ?? 0,
      mastery,
      mastered: mastery !== null && mastery >= MASTERY_THRESHOLD && (p?.attemptCount ?? 0) >= MASTERY_MIN_ATTEMPTS,
      children: [],
    }
  }

  // 组装树：parentId 为空 → 根节点；否则挂到父节点下
  const nodes = new Map<string, GrammarTopicNode>()
  for (const row of rows) nodes.set(row.id, toNode(row))
  const roots: GrammarTopicNode[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (!node) continue
    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return { topics: roots, total: rows.length }
}

// ---------------------------------------------------------------------------
// G2 · 主题详情
// ---------------------------------------------------------------------------

export async function getTopicDetail(userId: string, topicId: string): Promise<GrammarTopicDetail> {
  const topic = await prisma.grammarTopic.findFirst({
    where: { id: topicId, status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      description: true,
      difficulty: true,
      content: true,
      examples: true,
      errorExamples: true,
      _count: { select: { questions: true } },
    },
  })
  if (!topic) throw errNotFound('语法知识点不存在')

  const progress = await prisma.userGrammarProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
    select: { mastery: true, attemptCount: true, correctCount: true },
  })

  const mastery = progress && progress.attemptCount > 0 ? progress.mastery : null

  return {
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
    category: topic.category,
    description: topic.description,
    difficulty: topic.difficulty,
    content: parseContentPoints(topic.content),
    examples: parseExamples(topic.examples),
    errorExamples: parseErrorExamples(topic.errorExamples),
    questionCount: topic._count?.questions ?? 0,
    mastery,
    mastered:
      mastery !== null &&
      mastery >= MASTERY_THRESHOLD &&
      (progress?.attemptCount ?? 0) >= MASTERY_MIN_ATTEMPTS,
    attemptCount: progress?.attemptCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
  }
}

// ---------------------------------------------------------------------------
// G3 · 取练习题（不含答案）
// ---------------------------------------------------------------------------

export async function getExercises(userId: string, topicId: string, count = 5): Promise<GrammarExerciseResult> {
  const topic = await prisma.grammarTopic.findFirst({
    where: { id: topicId, status: 'PUBLISHED' },
    select: { id: true, name: true },
  })
  if (!topic) throw errNotFound('语法知识点不存在')

  const take = Math.max(1, Math.min(20, Math.floor(count)))
  const questions = await prisma.grammarQuestion.findMany({
    where: { topicId },
    select: { id: true, type: true, stem: true, options: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
    take: take,
  })

  return {
    topicId: topic.id,
    topicName: topic.name,
    // 防作弊：练习题**不含答案**
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: parseStringList(q.options).length > 0 ? parseStringList(q.options) : null,
    })),
    total: questions.length,
  }
}

// ---------------------------------------------------------------------------
// G4 · 提交练习（判分 + 错题本 + 掌握度 + 统计）
// ---------------------------------------------------------------------------

export async function submitExercises(
  userId: string,
  topicId: string,
  input: { answers: Array<{ questionId: string; userAnswer: string }>; durationSec?: number },
): Promise<GrammarSubmitResult> {
  const topic = await prisma.grammarTopic.findFirst({
    where: { id: topicId, status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      slug: true,
      questions: {
        select: { id: true, type: true, stem: true, options: true, answer: true, explanation: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!topic) throw errNotFound('语法知识点不存在')

  const byId = new Map(topic.questions.map((q) => [q.id, q]))
  const answerResults: GrammarAnswerResult[] = []
  const wrongRows: Array<{
    stem: string
    options: string[] | null
    userAnswer: string
    correctAnswer: string
    explanation: string | null
    refId: string
  }> = []
  let correctCount = 0

  for (const a of input.answers) {
    const q = byId.get(a.questionId)
    if (!q) continue
    const isCorrect = gradeGrammarQuestion(a.userAnswer, q.answer)
    if (isCorrect) correctCount += 1
    else {
      wrongRows.push({
        stem: q.stem,
        options: parseStringList(q.options).length > 0 ? parseStringList(q.options) : null,
        userAnswer: a.userAnswer,
        correctAnswer: q.answer,
        explanation: q.explanation,
        refId: q.id,
      })
    }
    answerResults.push({
      questionId: q.id,
      userAnswer: a.userAnswer,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation,
    })
  }

  const total = answerResults.length
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0

  // ---- 事务：错题本 + 掌握度 + 当日统计 ----
  let wrongCount = 0
  let mastery = 0
  let attemptCount = 0

  await prisma.$transaction(async (tx) => {
    for (const w of wrongRows) {
      const existing = await tx.wrongQuestion.findFirst({
        where: { userId, source: 'grammar', refType: 'grammar_question', refId: w.refId, masteredAt: null },
        select: { id: true, errorCount: true },
      })
      if (existing) {
        await tx.wrongQuestion.update({
          where: { id: existing.id },
          data: { errorCount: existing.errorCount + 1, lastWrongAt: new Date() },
        })
      } else {
        await tx.wrongQuestion.create({
          data: {
            userId,
            source: 'grammar',
            refType: 'grammar_question',
            refId: w.refId,
            stem: w.stem,
            options: (w.options ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
            userAnswer: w.userAnswer,
            correctAnswer: w.correctAnswer,
            explanation: w.explanation,
            knowledgePoints: [topic.slug] as unknown as Prisma.InputJsonValue,
          },
        })
      }
      wrongCount += 1
    }

    // 掌握度：累计正确率（不是单次分数），保证「徽章随练习结果变化」且不会被一次失误打回原形
    const prev = await tx.userGrammarProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
      select: { attemptCount: true, correctCount: true },
    })
    const nextAttempts = (prev?.attemptCount ?? 0) + 1
    const nextCorrect = (prev?.correctCount ?? 0) + correctCount
    mastery = nextAttempts > 0 ? Math.round((nextCorrect / nextAttempts) * 100) : 0
    attemptCount = nextAttempts

    await tx.userGrammarProgress.upsert({
      where: { userId_topicId: { userId, topicId } },
      update: { mastery, attemptCount: nextAttempts, correctCount: nextCorrect, lastAttemptAt: new Date() },
      create: {
        userId,
        topicId,
        mastery,
        attemptCount: nextAttempts,
        correctCount: nextCorrect,
        lastAttemptAt: new Date(),
      },
    })

    const today = await userToday(userId)
    await tx.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        grammarCount: { increment: 1 },
        correctCount: { increment: correctCount },
        wrongCount: { increment: wrongRows.length },
      },
      create: {
        userId,
        date: today,
        grammarCount: 1,
        correctCount,
        wrongCount: wrongRows.length,
      },
    })
  })

  log.info({ msg: 'grammar exercise submitted', userId, topicId, score, correctCount, total, mastery })

  return {
    topicId,
    score,
    total,
    correctCount,
    accuracy: score,
    answers: answerResults,
    wrongCount,
    mastery,
    mastered: mastery >= MASTERY_THRESHOLD && attemptCount >= MASTERY_MIN_ATTEMPTS,
    attemptCount,
  }
}

// ---------------------------------------------------------------------------
// G5 · AI 知识点讲解（Mock 时静态兜底）
// ---------------------------------------------------------------------------

export async function explainTopic(
  userId: string,
  topicId: string,
  input: { pointTitle?: string } = {},
): Promise<GrammarExplainResult> {
  const topic = await prisma.grammarTopic.findFirst({
    where: { id: topicId, status: 'PUBLISHED' },
    select: { id: true, name: true, description: true, content: true, examples: true },
  })
  if (!topic) throw errNotFound('语法知识点不存在')

  const points = parseContentPoints(topic.content)
  const examples = parseExamples(topic.examples)
  const pointTitle = input.pointTitle ?? points[0]?.title ?? topic.name

  try {
    const res = await aiService.explainGrammar(
      {
        topicName: topic.name,
        topicDescription: topic.description ?? '',
        pointTitle,
        points: points.map((p) => ({ title: p.title, content: p.content })),
        examples: examples.slice(0, 3).map((e) => ({ en: e.en, zh: e.zh })),
      },
      { userId, traceId: `grammar-${topicId}`, locale: 'zh-CN' },
    )
    if (!res.degraded && res.data !== null && res.data !== undefined) {
      const text =
        typeof res.data === 'string'
          ? res.data
          : typeof (res.data as { explanation?: unknown }).explanation === 'string'
          ? (res.data as { explanation: string }).explanation
          : typeof (res.data as { content?: unknown }).content === 'string'
            ? (res.data as { content: string }).content
            : null
      if (text !== null && text.trim().length > 0) {
        return { topicId, pointTitle, explanation: text, source: 'ai' }
      }
    }
  } catch (error) {
    log.warn({ msg: 'grammar explain failed (fallback to static)', userId, topicId, error: String(error) })
  }

  // 验收 3：Mock / 降级 → 静态知识点兜底（页面完整，标注 source='static'）
  return {
    topicId,
    pointTitle,
    explanation: staticExplanation(topic.name, points, examples, input.pointTitle),
    source: 'static',
  }
}
