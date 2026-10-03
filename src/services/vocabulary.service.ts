/**
 * 词汇服务（架构 §8.1 T08）：today / review-queue / review（幂等）/ learn / books / search / records / mastery / notebook。
 * SRS 推进全部在服务端计算（srs.engine），乐观锁 + Idempotency-Key 双保险。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { review, stateFromRow, type SelfRating } from './vocabulary/srs/srs.engine'
import { reviewXpAward, xpForEvent } from './gamification/level'
import { userToday } from '@/lib/utils/user-date'
import { createLogger } from '@/lib/logger/logger'

const log = createLogger('vocabulary.service')

const TODAY_LIMIT = 30
const QUEUE_LIMIT = 50

/**
 * 复习 XP 发放（架构 §5.4「复习正确 1 次 +1，上限 100/日，防刷」）。
 * 统计当日已答对的复习流水条数，超过上限后不再发放，避免脚本刷分。
 */
async function resolveReviewXp(userId: string, isCorrect: boolean): Promise<number> {
  if (!isCorrect) return 0
  const startOfToday = new Date(`${await userToday(userId)}T00:00:00.000Z`)
  const correctReviewsToday = await prisma.vocabularyReview.count({
    where: { userId, isCorrect: true, occurredAt: { gte: startOfToday } },
  })
  return reviewXpAward(correctReviewsToday, true)
}

// ---------------------------------------------------------------------------
// 查询类
// ---------------------------------------------------------------------------

/** 今日新词：按词书顺序取未学的 30 词 */
export async function getTodayWords(userId: string, bookSlug?: string) {
  const book = bookSlug
    ? await prisma.vocabularyBook.findUnique({ where: { slug: bookSlug } })
    : await prisma.vocabularyBook.findFirst({ where: { slug: { startsWith: 'cet4' } } })
  if (!book) throw errNotFound('词书不存在，请先在词库选择')

  const learned = await prisma.userVocabulary.findMany({
    where: { userId },
    select: { vocabularyId: true },
  })
  const learnedIds = new Set(learned.map((l) => l.vocabularyId))

  const items = await prisma.vocabularyBookItem.findMany({
    where: { bookId: book.id },
    orderBy: { orderIndex: 'asc' },
    select: { vocabularyId: true },
    take: 400,
  })
  const fresh = items.map((i) => i.vocabularyId).filter((id) => !learnedIds.has(id)).slice(0, TODAY_LIMIT)

  const words = await prisma.vocabulary.findMany({
    where: { id: { in: fresh } },
    select: {
      id: true, word: true, phoneticUk: true, phoneticUs: true,
      pos: true, definitions: true, examples: true, derivatives: true,
      cefrLevel: true, difficulty: true,
    },
  })
  // 保持词书顺序
  const byId = new Map(words.map((w) => [w.id, w]))
  return {
    book: { slug: book.slug, name: book.name },
    words: fresh.map((id) => byId.get(id)).filter((w): w is NonNullable<typeof w> => w != null),
  }
}

/** 复习队列：到期词按 nextReviewAt 升序 */
export async function getReviewQueue(userId: string) {
  const rows = await prisma.userVocabulary.findMany({
    where: { userId, nextReviewAt: { lte: new Date() } },
    orderBy: { nextReviewAt: 'asc' },
    take: QUEUE_LIMIT,
    include: {
      vocabulary: {
        select: {
          id: true, word: true, phoneticUk: true, phoneticUs: true,
          pos: true, definitions: true, examples: true, difficulty: true,
        },
      },
    },
  })
  return {
    dueCount: rows.length,
    items: rows.map((r) => ({
      userVocabId: r.id,
      masteryScore: r.masteryScore,
      stage: r.masteryStage,
      intervalDays: r.intervalDays,
      vocabulary: r.vocabulary,
    })),
  }
}

/** 词书列表 */
export async function listBooks() {
  const books = await prisma.vocabularyBook.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, description: true, wordCount: true },
  })
  return books
}

/** 搜索 */
export async function searchWords(q: string, limit = 10) {
  const trimmed = q.trim()
  if (!trimmed) return []
  return prisma.vocabulary.findMany({
    where: { word: { contains: trimmed, mode: 'insensitive' } },
    select: { id: true, word: true, phoneticUk: true, definitions: true, difficulty: true },
    take: Math.min(50, limit),
  })
}

/** 生词本 */
export async function getNotebook(userId: string) {
  const rows = await prisma.userVocabulary.findMany({
    where: { userId, inNotebook: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      vocabulary: {
        select: { id: true, word: true, phoneticUk: true, definitions: true },
      },
    },
  })
  return rows.map((r) => ({
    userVocabId: r.id,
    masteryScore: r.masteryScore,
    stage: r.masteryStage,
    nextReviewAt: r.nextReviewAt?.toISOString() ?? null,
    vocabulary: r.vocabulary,
  }))
}

/** 掌握度概览 */
export async function getMasteryOverview(userId: string) {
  const group = await prisma.userVocabulary.groupBy({
    by: ['masteryStage'],
    where: { userId },
    _count: { id: true },
  })
  const counts: Record<string, number> = {}
  for (const g of group) counts[g.masteryStage] = g._count.id
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { total, byStage: counts }
}

/** 学习记录（复习流水） */
export async function listRecords(userId: string, page: number, pageSize: number) {
  const [total, rows] = await Promise.all([
    prisma.vocabularyReview.count({ where: { userId } }),
    prisma.vocabularyReview.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { userVocab: { select: { vocabulary: { select: { word: true } } } } },
    }),
  ])
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      word: r.userVocab.vocabulary.word,
      rating: r.rating,
      isCorrect: r.isCorrect,
      prevStage: r.prevStage,
      newStage: r.newStage,
      newIntervalDays: r.newIntervalDays,
      occurredAt: r.occurredAt.toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// 写入类
// ---------------------------------------------------------------------------

/** 学一个新词：建 UserVocabulary（NEW），xp + 统计 */
export async function learnWord(userId: string, vocabularyId: string): Promise<{ userVocabId: string }> {
  const vocab = await prisma.vocabulary.findUnique({ where: { id: vocabularyId }, select: { id: true } })
  if (!vocab) throw errNotFound('单词不存在')

  const existing = await prisma.userVocabulary.findUnique({
    where: { userId_vocabularyId: { userId, vocabularyId } },
  })
  if (existing) return { userVocabId: existing.id }

  const created = await prisma.userVocabulary.create({
    // nextReviewAt = 学即到期：新词学完立刻可进复习队列（SRS 首次复习）
    data: { userId, vocabularyId, learnedAt: new Date(), nextReviewAt: new Date() },
  })

  const today = await userToday(userId)
  const xp = xpForEvent('learn_word')
  await prisma.$transaction([
    prisma.userStats.updateMany({ where: { userId }, data: { xp: { increment: xp }, wordsLearned: { increment: 1 } } }),
    prisma.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: { wordsLearned: { increment: 1 }, studySeconds: { increment: 30 }, xpEarned: { increment: xp } },
      create: { userId, date: today, wordsLearned: 1, studySeconds: 30, xpEarned: xp },
    }),
  ])
  return { userVocabId: created.id }
}

export interface ReviewInput {
  userVocabId: string
  rating: SelfRating
  responseMs: number
  idempotencyKey?: string
}

/**
 * 复习提交：服务端 SRS 推进 + 流水 + 统计。
 * 幂等：1) idempotencyKey 唯一约束；2) 同 key 重复请求返回首次结果。
 */
export async function submitReview(
  userId: string,
  input: ReviewInput,
): Promise<{ newMastery: number; newStage: string; newIntervalDays: number; nextReviewAt: string; path: string; intervalPredictions: number[]; duplicate: boolean }> {
  if (input.rating < 0 || input.rating > 5) throw new AppError('VALIDATION_ERROR', '自评需为 0-5')

  // ---- 幂等短路径 ----
  if (input.idempotencyKey) {
    const existing = await prisma.vocabularyReview.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { newMastery: true, newStage: true, newIntervalDays: true, occurredAt: true, prevIntervalDays: true, newEaseFactor: true },
    })
    if (existing) {
      return {
        newMastery: existing.newMastery,
        newStage: existing.newStage,
        newIntervalDays: existing.newIntervalDays,
        nextReviewAt: new Date(existing.occurredAt.getTime() + existing.newIntervalDays * 86400_000).toISOString(),
        path: 'DUPLICATE',
        intervalPredictions: predictIntervals(existing.newEaseFactor, existing.newIntervalDays),
        duplicate: true,
      }
    }
  }

  const row = await prisma.userVocabulary.findFirst({
    where: { id: input.userVocabId, userId },
    include: { vocabulary: { select: { id: true } } },
  })
  if (!row) throw errNotFound('学习记录不存在')

  const state = stateFromRow(row)
  const outcome = review(state, input.rating, input.responseMs)
  const today = await userToday(userId)
  const reviewXp = await resolveReviewXp(userId, outcome.isCorrect)
  const xp = reviewXp

  // 乐观锁事务：version 不匹配时重读一次重算
  const apply = async (): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.userVocabulary.updateMany({
        where: { id: row.id, version: row.version },
        data: {
          masteryScore: outcome.masteryScore,
          masteryStage: outcome.stage,
          easeFactor: outcome.easeFactor,
          intervalDays: outcome.intervalDays,
          reps: outcome.reps,
          lapses: outcome.lapses,
          consecutiveCorrect: outcome.consecutiveCorrect,
          avgResponseMs: outcome.avgResponseMs,
          lastReviewedAt: new Date(),
          nextReviewAt: outcome.nextReviewAt,
          reviewCount: { increment: 1 },
          correctCount: outcome.isCorrect ? { increment: 1 } : undefined,
          wrongCount: outcome.isCorrect ? undefined : { increment: 1 },
          inNotebook: outcome.isCorrect ? undefined : true, // 错词自动入生词本
          version: { increment: 1 },
        },
      })
      if (updated.count === 0) throw new AppError('SYS_INTERNAL', '并发冲突，请重试')

      await tx.vocabularyReview.create({
        data: {
          userId,
          userVocabId: row.id,
          vocabularyId: row.vocabularyId,
          rating: input.rating,
          isCorrect: outcome.isCorrect,
          responseMs: input.responseMs,
          prevMastery: state.masteryScore,
          newMastery: outcome.masteryScore,
          prevStage: state.stage,
          newStage: outcome.stage,
          prevIntervalDays: state.intervalDays,
          newIntervalDays: outcome.intervalDays,
          prevEaseFactor: state.easeFactor,
          newEaseFactor: outcome.easeFactor,
          source: 'REVIEW',
          idempotencyKey: input.idempotencyKey,
        },
      })

      await tx.userStats.updateMany({
        where: { userId },
        data: { xp: { increment: xp }, wordsReviewed: { increment: 1 }, correctCount: outcome.isCorrect ? { increment: 1 } : undefined, wrongCount: outcome.isCorrect ? undefined : { increment: 1 } },
      })
      await tx.dailyLearningStat.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          wordsReviewed: { increment: 1 },
          studySeconds: { increment: 20 },
          xpEarned: { increment: xp },
          correctCount: outcome.isCorrect ? { increment: 1 } : undefined,
          wrongCount: outcome.isCorrect ? undefined : { increment: 1 },
        },
        create: {
          userId, date: today,
          wordsReviewed: 1, studySeconds: 20, xpEarned: xp,
          correctCount: outcome.isCorrect ? 1 : 0, wrongCount: outcome.isCorrect ? 0 : 1,
        },
      })
    })
  }

  try {
    await apply()
  } catch (e) {
    if (e instanceof AppError && e.message.includes('并发冲突')) {
      const fresh = await prisma.userVocabulary.findUniqueOrThrow({ where: { id: row.id } })
      const freshState = stateFromRow(fresh)
      const freshOutcome = review(freshState, input.rating, input.responseMs)
      Object.assign(outcome, freshOutcome)
      await apply()
    } else {
      throw e
    }
  }

  log.info({ msg: 'review', userId, userVocabId: input.userVocabId, path: outcome.path })
  return {
    newMastery: outcome.masteryScore,
    newStage: outcome.stage,
    newIntervalDays: outcome.intervalDays,
    nextReviewAt: outcome.nextReviewAt.toISOString(),
    path: outcome.path,
    intervalPredictions: predictIntervals(outcome.easeFactor, outcome.intervalDays, outcome.reps),
    duplicate: false,
  }
}

/** 前端展示的 1/3/7/14/30 天预测（按当前 EF 缩放） */
function predictIntervals(easeFactor: number, currentInterval: number, reps = 1): number[] {
  const table = [1, 3, 7, 14, 30]
  const scale = 0.5 + (easeFactor / 2.5) * 0.5
  return table.map((base, i) => {
    if (base <= currentInterval && i <= reps) return currentInterval
    return Math.max(1, Math.round(base * scale))
  })
}

/** 单词详情：词库数据 + 当前用户学习状态（未学时 state 为 null） */
export async function getWordDetail(userId: string, vocabularyId: string) {
  const word = await prisma.vocabulary.findUnique({
    where: { id: vocabularyId },
    select: {
      id: true, word: true, phoneticUk: true, phoneticUs: true,
      pos: true, definitions: true, examples: true, derivatives: true,
      synonyms: true, antonyms: true, collocations: true, mnemonic: true, rootAffix: true,
      cefrLevel: true, difficulty: true, frequencyRank: true,
    },
  })
  if (!word) throw errNotFound('单词不存在')
  const uv = await prisma.userVocabulary.findUnique({
    where: { userId_vocabularyId: { userId, vocabularyId } },
    select: {
      id: true, masteryScore: true, masteryStage: true, intervalDays: true,
      nextReviewAt: true, lastReviewedAt: true, reviewCount: true, correctCount: true,
      wrongCount: true, inNotebook: true, learnedAt: true,
    },
  })
  return { word, state: uv }
}

/** 生词本切换 */
export async function toggleNotebook(userId: string, userVocabId: string): Promise<{ inNotebook: boolean }> {
  const row = await prisma.userVocabulary.findFirst({ where: { id: userVocabId, userId } })
  if (!row) throw errNotFound('学习记录不存在')
  const updated = await prisma.userVocabulary.update({
    where: { id: userVocabId },
    data: { inNotebook: !row.inNotebook },
  })
  return { inNotebook: updated.inNotebook }
}
