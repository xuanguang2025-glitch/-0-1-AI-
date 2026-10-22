/**
 * 错题本服务（team-lead 增补项，不在原设计文档任务清单内）。
 *
 * 背景：阅读（source=reading）/ 语法（source=grammar）/ 听力（listening）都已把
 * 错题写入 `wrong_questions`，但**没有列表页和 API，错题进去用户看不见** ——
 * 数据闭环断在半路。本服务补上读取侧：
 *   - 列表：按来源 / 掌握状态筛选 + 分页（置顶最近写错的）；
 *   - 复习闭环：标记已掌握（masteredAt）/ 重新打开（masteredAt=null）；
 *   - **只读聚合，不写错题**：错题的写入仍归各业务 service（保持单一写入口）。
 */
import { prisma } from '@/lib/db'
import { errNotFound } from '@/lib/api/errors'
import { Prisma } from '@prisma/client'

/** 错题来源（与 WrongQuestion.source 注释一致） */
export const WRONG_SOURCES = ['exam', 'quiz', 'grammar', 'vocab', 'listening', 'reading', 'challenge'] as const
export type WrongSource = (typeof WRONG_SOURCES)[number]

/** AI 错因分类（A13） */
const AI_CATEGORY_NAMES: Record<string, string> = {
  vocab: '词汇',
  grammar: '语法',
  comprehension: '理解',
  careless: '粗心',
  knowledge_gap: '知识漏洞',
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface WrongQuestionItem {
  id: string
  source: string
  refType: string | null
  refId: string | null
  stem: string
  options: string[]
  userAnswer: string | null
  correctAnswer: string | null
  explanation: string | null
  aiExplanation: string | null
  /** AI 错因分类（未分类为 null） */
  aiCategory: string | null
  /** 出错次数 */
  errorCount: number
  lastWrongAt: string
  /** 已掌握时间（null = 未掌握） */
  masteredAt: string | null
  isFavorite: boolean
}

export interface WrongQuestionListResult {
  items: WrongQuestionItem[]
  total: number
  page: number
  pageSize: number
  /** 各来源的未掌握计数（筛选 chips 用） */
  sourceCounts: Array<{ source: string; count: number }>
}

export interface WrongQuestionReviewResult {
  id: string
  masteredAt: string | null
}

// ---------------------------------------------------------------------------
// 列表
// ---------------------------------------------------------------------------

export interface WrongQuestionQuery {
  source?: string
  /** mastered=true → 只看已掌握；false → 只看未掌握；undefined → 全部 */
  mastered?: boolean
  page?: number
  pageSize?: number
}

const LIST_SELECT = {
  id: true,
  source: true,
  refType: true,
  refId: true,
  stem: true,
  options: true,
  userAnswer: true,
  correctAnswer: true,
  explanation: true,
  aiExplanation: true,
  aiCategory: true,
  errorCount: true,
  lastWrongAt: true,
  masteredAt: true,
  isFavorite: true,
} satisfies Prisma.WrongQuestionSelect

export async function listWrongQuestions(userId: string, query: WrongQuestionQuery): Promise<WrongQuestionListResult> {
  const where: Prisma.WrongQuestionWhereInput = { userId }
  // source 合法性：非法值直接忽略（不 500，筛选 chips 只来自白名单）
  if (query.source !== undefined && (WRONG_SOURCES as readonly string[]).includes(query.source)) {
    where.source = query.source
  }
  if (query.mastered === true) where.masteredAt = { not: null }
  if (query.mastered === false) where.masteredAt = null

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total, sourceGroups] = await Promise.all([
    prisma.wrongQuestion.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { lastWrongAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.wrongQuestion.count({ where }),
    // 各来源未掌握计数（不过滤 source/mastered，反映全量分布）
    prisma.wrongQuestion.groupBy({
      by: ['source'],
      where: { userId, masteredAt: null },
      _count: { _all: true },
    }),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      source: row.source,
      refType: row.refType,
      refId: row.refId,
      stem: row.stem,
      options: Array.isArray(row.options) ? (row.options as unknown[]).filter((o): o is string => typeof o === 'string') : [],
      userAnswer: row.userAnswer,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
      aiExplanation: row.aiExplanation,
      aiCategory: row.aiCategory,
      errorCount: row.errorCount,
      lastWrongAt: row.lastWrongAt.toISOString(),
      masteredAt: row.masteredAt?.toISOString() ?? null,
      isFavorite: row.isFavorite,
    })),
    total,
    page,
    pageSize,
    sourceCounts: sourceGroups
      .map((g) => ({ source: g.source, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
  }
}

/** AI 错因中文名（FE 直接用，放在服务里保证单一口径） */
export function aiCategoryName(category: string | null): string | null {
  if (category === null) return null
  return AI_CATEGORY_NAMES[category] ?? category
}

// ---------------------------------------------------------------------------
// 复习闭环
// ---------------------------------------------------------------------------

/** 标记已掌握（masteredAt=now；重复标记幂等——保留首次掌握时间） */
export async function markMastered(userId: string, questionId: string): Promise<WrongQuestionReviewResult> {
  const row = await prisma.wrongQuestion.findFirst({
    where: { id: questionId, userId },
    select: { id: true, masteredAt: true },
  })
  if (row === null) throw errNotFound('错题不存在')

  const masteredAt = row.masteredAt ?? new Date()
  const updated = await prisma.wrongQuestion.update({
    where: { id: questionId },
    data: { masteredAt },
    select: { masteredAt: true },
  })
  return { id: questionId, masteredAt: updated.masteredAt?.toISOString() ?? masteredAt.toISOString() }
}

/** 重新打开（答错了/想再练）：masteredAt=null，errorCount 不动（历史保留） */
export async function reopenQuestion(userId: string, questionId: string): Promise<WrongQuestionReviewResult> {
  const row = await prisma.wrongQuestion.findFirst({
    where: { id: questionId, userId },
    select: { id: true },
  })
  if (row === null) throw errNotFound('错题不存在')

  const updated = await prisma.wrongQuestion.update({
    where: { id: questionId },
    data: { masteredAt: null },
    select: { masteredAt: true },
  })
  return { id: questionId, masteredAt: updated.masteredAt === null ? null : updated.masteredAt.toISOString() }
}
