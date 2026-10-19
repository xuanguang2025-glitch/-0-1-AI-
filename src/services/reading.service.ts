/**
 * 阅读训练服务（架构 §3.1 R1-R4 / Phase 2 设计 T15）。
 *
 * 关键决策：
 *   - **判分全部走确定性算法**（选择题字母比对 / 多选集合比对），0 个依赖 AI ——
 *     Mock 阶段阅读模块完整可用；
 *   - **划词释义走词典直查**（`vocabulary` 表，ECDICT 语料），**不调 AI**：
 *     响应快、离线可用、成本为零；
 *   - AI 只在「句子讲解」一处介入（R4），且 Mock/降级时**明确返回 degraded=true**，
 *     前端据此**隐藏整个 AI 区块**（设计文档验收 5），绝不给一句「AI 不可用」占位；
 *   - 错题自动写入 `wrong_questions`（source='reading'），与词汇/听力/语法错题本同源。
 *
 * 本文件为 DB 编排层。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { Prisma, type CEFRLevel, type Difficulty } from '@prisma/client'

import { aiService } from './ai/ai.service'

const log = createLogger('reading.service')

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/** 段落（contentBlocks 的元素） */
export interface ReadingBlock {
  index: number
  en: string
  zh: string
}

/** 重点词 */
export interface ReadingKeyWord {
  word: string
  pos: string
  meaning: string
}

/** 长难句 */
export interface ReadingSentence {
  sentence: string
  structure: string
  translation: string
}

/** 答案定位（ReadingQuestion.location） */
export interface ReadingLocation {
  blockIndex: number
  charStart: number
  charEnd: number
}

/** 列表项（**不含正文与答案**，避免列表页拉全量内容） */
export interface ReadingArticleListItem {
  id: string
  title: string
  category: string
  difficulty: string
  cefrLevel: string | null
  wordCount: number
  readingMinutes: number
  /** 已读进度 0-100；未读过为 0 */
  progress: number
  /** 是否已做过 quiz */
  quizDone: boolean
  /** quiz 正确率（未做过为 null） */
  quizAccuracy: number | null
  tags: string[]
}

export interface ReadingFacetItem {
  value: string
  count: number
}

export interface ReadingFacets {
  categories: ReadingFacetItem[]
  difficulties: ReadingFacetItem[]
}

export interface ReadingListResult {
  articles: ReadingArticleListItem[]
  facets: ReadingFacets
  total: number
  page: number
  pageSize: number
}

/** 列表页用的记录行 */
interface RecordRow {
  articleId: string
  progress: number
  quizResult: unknown
}

/** 文章详情（题目**不含答案**；判分在服务端 R3 完成） */
export interface ReadingQuestionItem {
  id: string
  type: string
  stem: string
  options: string[] | null
  /** 答案定位：缺失时为 null，前端隐藏「定位」按钮 */
  location: ReadingLocation | null
}

export interface ReadingArticleDetail {
  id: string
  title: string
  category: string
  difficulty: string
  cefrLevel: string | null
  wordCount: number
  readingMinutes: number
  contentBlocks: ReadingBlock[]
  keyWords: ReadingKeyWord[]
  sentences: ReadingSentence[]
  questions: ReadingQuestionItem[]
  /** 断点续读：上次读到的段落下标 */
  lastBlockIndex: number
  progress: number
  quizResult: { score: number; total: number; correctCount: number } | null
  /** 划词收藏 [{word, meaning, blockIndex}] */
  highlights: Array<{ word: string; meaning: string; blockIndex: number }>
  sourceName: string | null
  sourceUrl: string | null
}

export interface ReadingQuizAnswerResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
  location: ReadingLocation | null
}

export interface ReadingQuizResult {
  articleId: string
  score: number
  total: number
  correctCount: number
  accuracy: number
  answers: ReadingQuizAnswerResult[]
  /** 本次新增的错题本条目数 */
  wrongCount: number
}

export interface ReadingExplainResult {
  sentence: string
  /** AI 生成的讲解；degraded 时为 null */
  explanation: string | null
  /** true = AI 不可用，前端应**隐藏 AI 区块**（验收 5） */
  degraded: boolean
}

export interface ReadingWordResult {
  word: string
  /** 规范化查询键（小写） */
  lemma: string
  phoneticUk: string | null
  phoneticUs: string | null
  pos: string[]
  /** [{pos, zh, en}] */
  definitions: Array<{ pos: string; zh: string; en?: string }>
  examples: Array<{ en: string; zh: string }>
  /** 词典中是否存在 */
  found: boolean
}

// ---------------------------------------------------------------------------
// 解析助手（Json 字段一律不信任形状）
// ---------------------------------------------------------------------------

function parseBlocks(value: unknown): ReadingBlock[] {
  if (!Array.isArray(value)) return []
  const out: ReadingBlock[] = []
  for (const [i, item] of value.entries()) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { en?: unknown; zh?: unknown }
    if (typeof r.en !== 'string') continue
    out.push({ index: i, en: r.en, zh: typeof r.zh === 'string' ? r.zh : '' })
  }
  return out
}

function parseKeyWords(value: unknown): ReadingKeyWord[] {
  if (!Array.isArray(value)) return []
  const out: ReadingKeyWord[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { word?: unknown; pos?: unknown; meaning?: unknown }
    if (typeof r.word !== 'string') continue
    out.push({
      word: r.word,
      pos: typeof r.pos === 'string' ? r.pos : '',
      meaning: typeof r.meaning === 'string' ? r.meaning : '',
    })
  }
  return out
}

function parseSentences(value: unknown): ReadingSentence[] {
  if (!Array.isArray(value)) return []
  const out: ReadingSentence[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { sentence?: unknown; structure?: unknown; translation?: unknown }
    if (typeof r.sentence !== 'string') continue
    out.push({
      sentence: r.sentence,
      structure: typeof r.structure === 'string' ? r.structure : '',
      translation: typeof r.translation === 'string' ? r.translation : '',
    })
  }
  return out
}

function parseLocation(value: unknown): ReadingLocation | null {
  if (value === null || typeof value !== 'object') return null
  const r = value as { blockIndex?: unknown; charStart?: unknown; charEnd?: unknown }
  if (typeof r.blockIndex !== 'number' || !Number.isInteger(r.blockIndex) || r.blockIndex < 0) return null
  const charStart = typeof r.charStart === 'number' && r.charStart >= 0 ? r.charStart : 0
  const charEnd = typeof r.charEnd === 'number' && r.charEnd > charStart ? r.charEnd : charStart
  return { blockIndex: r.blockIndex, charStart, charEnd }
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function parseHighlights(value: unknown): Array<{ word: string; meaning: string; blockIndex: number }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ word: string; meaning: string; blockIndex: number }> = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { word?: unknown; meaning?: unknown; blockIndex?: unknown }
    if (typeof r.word !== 'string') continue
    out.push({
      word: r.word,
      meaning: typeof r.meaning === 'string' ? r.meaning : '',
      blockIndex: typeof r.blockIndex === 'number' ? r.blockIndex : 0,
    })
  }
  return out
}

/** quizResult → 结构化（脏数据容错） */
function parseQuizResult(value: unknown): { score: number; total: number; correctCount: number } | null {
  if (value === null || typeof value !== 'object') return null
  const r = value as { score?: unknown; total?: unknown; correctCount?: unknown }
  if (typeof r.total !== 'number' || r.total <= 0) return null
  return {
    score: typeof r.score === 'number' ? r.score : 0,
    total: r.total,
    correctCount: typeof r.correctCount === 'number' ? r.correctCount : 0,
  }
}

function tally(values: Array<string | null>): ReadingFacetItem[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v ?? ''
    if (key === '') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// 判分（确定性，0 AI 依赖）
// ---------------------------------------------------------------------------

/** 归一化用户答案：去空白、大写（选择题按字母判） */
function normalizeAnswer(raw: string): string {
  return raw.trim().toUpperCase()
}

/** 单选/判断题：字母或布尔文本精确比对 */
function gradeSingle(userAnswer: string, correct: string): boolean {
  const u = normalizeAnswer(userAnswer)
  const c = normalizeAnswer(correct)
  if (u === c) return true
  // 容忍 "A." / "A、" / "A " 等写法
  return u.replace(/[.\-、,，\s]/g, '') === c.replace(/[.\-、,，\s]/g, '')
}

/** 多选：按集合比对（忽略顺序与分隔符） */
function gradeMulti(userAnswer: string, correct: string): boolean {
  const toSet = (s: string): Set<string> =>
    new Set(
      s
        .toUpperCase()
        .split(/[,，、\s|]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    )
  const u = toSet(userAnswer)
  const c = toSet(correct)
  if (u.size !== c.size) return false
  for (const v of c) if (!u.has(v)) return false
  return true
}

/** 按题型判分 */
export function gradeReadingQuestion(type: string, userAnswer: string, correct: string): boolean {
  if (type === 'MULTI_CHOICE') return gradeMulti(userAnswer, correct)
  return gradeSingle(userAnswer, correct)
}

// ---------------------------------------------------------------------------
// Select 常量
// ---------------------------------------------------------------------------

const ARTICLE_LIST_SELECT = {
  id: true,
  title: true,
  category: true,
  difficulty: true,
  cefrLevel: true,
  wordCount: true,
  readingMinutes: true,
  tags: true,
} satisfies Prisma.ReadingArticleSelect

const ARTICLE_DETAIL_SELECT = {
  ...ARTICLE_LIST_SELECT,
  contentBlocks: true,
  contentZh: true,
  keyWords: true,
  sentences: true,
  sourceName: true,
  sourceUrl: true,
  questions: {
    select: {
      id: true,
      type: true,
      stem: true,
      options: true,
      answer: true,
      explanation: true,
      location: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.ReadingArticleSelect

// ---------------------------------------------------------------------------
// R1 · 文章列表
// ---------------------------------------------------------------------------

export interface ReadingListQuery {
  category?: string
  difficulty?: Difficulty
  cefr?: CEFRLevel
  q?: string
  page?: number
  pageSize?: number
}

export async function listArticles(userId: string, query: ReadingListQuery): Promise<ReadingListResult> {
  const where: Prisma.ReadingArticleWhereInput = { status: 'PUBLISHED', deletedAt: null }
  if (query.category) where.category = query.category
  if (query.difficulty) where.difficulty = query.difficulty
  if (query.cefr) where.cefrLevel = query.cefr
  if (query.q) where.title = { contains: query.q, mode: 'insensitive' }

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total, facetRows, records] = await Promise.all([
    prisma.readingArticle.findMany({
      where,
      select: ARTICLE_LIST_SELECT,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.readingArticle.count({ where }),
    prisma.readingArticle.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { category: true, difficulty: true },
    }),
    prisma.readingRecord.findMany({
      where: { userId },
      select: { articleId: true, progress: true, quizResult: true },
    }),
  ])

  const recordById = new Map<string, RecordRow>(records.map((r) => [r.articleId, r]))

  const articles: ReadingArticleListItem[] = rows.map((row) => {
    const rec = recordById.get(row.id)
    const quiz = parseQuizResult(rec?.quizResult ?? null)
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      difficulty: row.difficulty,
      cefrLevel: row.cefrLevel,
      wordCount: row.wordCount,
      readingMinutes: row.readingMinutes,
      progress: rec?.progress ?? 0,
      quizDone: quiz !== null,
      quizAccuracy: quiz && quiz.total > 0 ? Math.round((quiz.correctCount / quiz.total) * 100) : null,
      tags: parseStringList(row.tags),
    }
  })

  return {
    articles,
    facets: {
      categories: tally(facetRows.map((f) => f.category)),
      difficulties: tally(facetRows.map((f) => f.difficulty)),
    },
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// R2 · 文章详情（断点续读）
// ---------------------------------------------------------------------------

export async function getArticleDetail(userId: string, articleId: string): Promise<ReadingArticleDetail> {
  const article = await prisma.readingArticle.findFirst({
    where: { id: articleId, status: 'PUBLISHED', deletedAt: null },
    select: ARTICLE_DETAIL_SELECT,
  })
  if (!article) throw errNotFound('阅读文章不存在')

  const record = await prisma.readingRecord.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { progress: true, lastBlockIndex: true, quizResult: true, highlights: true },
  })

  return {
    id: article.id,
    title: article.title,
    category: article.category,
    difficulty: article.difficulty,
    cefrLevel: article.cefrLevel,
    wordCount: article.wordCount,
    readingMinutes: article.readingMinutes,
    contentBlocks: parseBlocks(article.contentBlocks),
    keyWords: parseKeyWords(article.keyWords),
    sentences: parseSentences(article.sentences),
    // 防作弊：详情页题目**不含答案**
    questions: article.questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: parseStringList(q.options).length > 0 ? parseStringList(q.options) : null,
      location: parseLocation(q.location),
    })),
    lastBlockIndex: record?.lastBlockIndex ?? 0,
    progress: record?.progress ?? 0,
    quizResult: parseQuizResult(record?.quizResult ?? null),
    highlights: parseHighlights(record?.highlights),
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
  }
}

// ---------------------------------------------------------------------------
// 断点续读 · 保存阅读进度
// ---------------------------------------------------------------------------

export interface ReadingProgressResult {
  articleId: string
  progress: number
  lastBlockIndex: number
}

export async function saveReadingProgress(
  userId: string,
  articleId: string,
  input: { progress: number; lastBlockIndex?: number; readSeconds?: number },
): Promise<ReadingProgressResult> {
  const article = await prisma.readingArticle.findFirst({
    where: { id: articleId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true },
  })
  if (!article) throw errNotFound('阅读文章不存在')

  const progress = Math.max(0, Math.min(100, Math.floor(input.progress)))
  const lastBlockIndex = Math.max(0, Math.floor(input.lastBlockIndex ?? 0))
  const readSeconds = Math.max(0, Math.floor(input.readSeconds ?? 0))

  const row = await prisma.readingRecord.upsert({
    where: { userId_articleId: { userId, articleId } },
    update: { progress, lastBlockIndex },
    create: { userId, articleId, progress, lastBlockIndex },
    select: { progress: true, lastBlockIndex: true },
  })

  // 阅读秒数计入当日统计（只增不减，用 increment 避免覆盖其他模块）
  if (readSeconds > 0) {
    const today = await userToday(userId)
    await prisma.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: { readingCount: { increment: 1 }, studySeconds: { increment: readSeconds } },
      create: {
        userId,
        date: today,
        readingCount: 1,
        studySeconds: readSeconds,
      },
    })
  }

  return { articleId, progress: row.progress, lastBlockIndex: row.lastBlockIndex }
}

// ---------------------------------------------------------------------------
// 划词收藏
// ---------------------------------------------------------------------------

export async function addHighlight(
  userId: string,
  articleId: string,
  input: { word: string; blockIndex: number },
): Promise<{ highlights: Array<{ word: string; meaning: string; blockIndex: number }> }> {
  const record = await prisma.readingRecord.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { id: true, highlights: true },
  })
  if (!record) throw new AppError('VALIDATION_ERROR', '请先开始阅读（保存进度）再收藏生词')

  const existing = parseHighlights(record.highlights)
  // 同一段落同一词只留一份
  const dedup = existing.filter((h) => !(h.word === input.word && h.blockIndex === input.blockIndex))
  dedup.push({ word: input.word, meaning: '', blockIndex: input.blockIndex })

  const updated = await prisma.readingRecord.update({
    where: { id: record.id },
    data: { highlights: dedup as unknown as Prisma.InputJsonValue },
    select: { highlights: true },
  })
  return { highlights: parseHighlights(updated.highlights) }
}

// ---------------------------------------------------------------------------
// R3 · 提交 quiz（判分 + 错题本 + 统计）
// ---------------------------------------------------------------------------

export async function submitQuiz(
  userId: string,
  articleId: string,
  input: { answers: Array<{ questionId: string; userAnswer: string }>; durationSec?: number },
): Promise<ReadingQuizResult> {
  const article = await prisma.readingArticle.findFirst({
    where: { id: articleId, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      title: true,
      questions: {
        select: {
          id: true,
          type: true,
          stem: true,
          options: true,
          answer: true,
          explanation: true,
          location: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!article) throw errNotFound('阅读文章不存在')

  const byId = new Map(article.questions.map((q) => [q.id, q]))
  const answerResults: ReadingQuizAnswerResult[] = []
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
    // 未知题目 id 直接跳过（不因为脏数据让整次提交失败）
    if (!q) continue
    const isCorrect = gradeReadingQuestion(q.type, a.userAnswer, q.answer)
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
      location: parseLocation(q.location),
    })
  }

  const total = answerResults.length
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0

  // ---- 事务：记录 quiz 结果 + 错题本 + 当日统计 ----
  let wrongCount = 0
  await prisma.$transaction(async (tx) => {
    await tx.readingRecord.upsert({
      where: { userId_articleId: { userId, articleId } },
      update: {
        quizResult: { score, total, correctCount } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        progress: 100,
      },
      create: {
        userId,
        articleId,
        progress: 100,
        quizResult: { score, total, correctCount } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    })

    for (const w of wrongRows) {
      // 幂等：同一用户同一题重复错只累加 errorCount（与词汇错题本同口径）
      const existing = await tx.wrongQuestion.findFirst({
        where: { userId, source: 'reading', refType: 'reading_question', refId: w.refId, masteredAt: null },
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
            source: 'reading',
            refType: 'reading_question',
            refId: w.refId,
            stem: w.stem,
            options: (w.options ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
            userAnswer: w.userAnswer,
            correctAnswer: w.correctAnswer,
            explanation: w.explanation,
            knowledgePoints: ['reading', article.title] as unknown as Prisma.InputJsonValue,
          },
        })
      }
      wrongCount += 1
    }

    const today = await userToday(userId)
    await tx.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        readingCount: { increment: 1 },
        correctCount: { increment: correctCount },
        wrongCount: { increment: wrongRows.length },
      },
      create: {
        userId,
        date: today,
        readingCount: 1,
        correctCount,
        wrongCount: wrongRows.length,
      },
    })
  })

  log.info({ msg: 'reading quiz submitted', userId, articleId, score, correctCount, total, wrongCount })

  return {
    articleId,
    score,
    total,
    correctCount,
    accuracy: score,
    answers: answerResults,
    wrongCount,
  }
}

// ---------------------------------------------------------------------------
// R4 · AI 句子讲解（Mock 时 degraded=true → 前端隐藏区块）
// ---------------------------------------------------------------------------

export async function explainSentence(
  userId: string,
  articleId: string,
  input: { sentence: string; blockIndex?: number },
): Promise<ReadingExplainResult> {
  const article = await prisma.readingArticle.findFirst({
    where: { id: articleId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true, title: true, contentBlocks: true },
  })
  if (!article) throw errNotFound('阅读文章不存在')

  // 上下文：定位该句所在段落（用于给 AI 更准的讲解）
  const blocks = parseBlocks(article.contentBlocks)
  const blockIndex = input.blockIndex ?? blocks.findIndex((b) => b.en.includes(input.sentence))
  const context = blockIndex >= 0 ? (blocks[blockIndex]?.en ?? '') : ''

  try {
    const res = await aiService.explainReading(
      {
        sentence: input.sentence,
        context,
        articleTitle: article.title,
        blockIndex: blockIndex >= 0 ? blockIndex : 0,
      },
      { userId, traceId: `reading-${articleId}`, locale: 'zh-CN' },
    )
    if (res.degraded || res.data === null || res.data === undefined) {
      return { sentence: input.sentence, explanation: null, degraded: true }
    }
    // AI 结果形态不信任：取字符串字段，取不到就视为降级
    const text =
      typeof res.data === 'string'
        ? res.data
        : typeof (res.data as { explanation?: unknown }).explanation === 'string'
          ? (res.data as { explanation: string }).explanation
          : typeof (res.data as { text?: unknown }).text === 'string'
            ? (res.data as { text: string }).text
            : null
    if (text === null || text.trim().length === 0) {
      return { sentence: input.sentence, explanation: null, degraded: true }
    }
    return { sentence: input.sentence, explanation: text, degraded: false }
  } catch (error) {
    log.warn({ msg: 'reading explain failed (degrade → hide block)', userId, articleId, error: String(error) })
    return { sentence: input.sentence, explanation: null, degraded: true }
  }
}

// ---------------------------------------------------------------------------
// 划词直查（词典，0 AI）
// ---------------------------------------------------------------------------

export async function lookupWord(word: string): Promise<ReadingWordResult> {
  const lemma = word.trim().toLowerCase().replace(/[^a-z'-]/g, '')
  if (lemma.length === 0) {
    throw new AppError('VALIDATION_ERROR', '请输入有效的英文单词')
  }

  const row = await prisma.vocabulary.findUnique({
    where: { lemma },
    select: {
      word: true,
      lemma: true,
      phoneticUk: true,
      phoneticUs: true,
      pos: true,
      definitions: true,
      examples: true,
    },
  })

  if (!row) {
    return {
      word: word.trim(),
      lemma,
      phoneticUk: null,
      phoneticUs: null,
      pos: [],
      definitions: [],
      examples: [],
      found: false,
    }
  }

  const defs = Array.isArray(row.definitions)
    ? (row.definitions as Array<{ pos?: unknown; zh?: unknown; en?: unknown }>)
        .filter((d) => d !== null && typeof d === 'object')
        .map((d) => ({
          pos: typeof d.pos === 'string' ? d.pos : '',
          zh: typeof d.zh === 'string' ? d.zh : '',
          en: typeof d.en === 'string' ? d.en : undefined,
        }))
    : []

  const examples = Array.isArray(row.examples)
    ? (row.examples as Array<{ en?: unknown; zh?: unknown }>)
        .filter((e) => e !== null && typeof e === 'object' && typeof e.en === 'string')
        .map((e) => ({ en: e.en as string, zh: typeof e.zh === 'string' ? (e.zh as string) : '' }))
        .slice(0, 3)
    : []

  return {
    word: row.word,
    lemma: row.lemma,
    phoneticUk: row.phoneticUk,
    phoneticUs: row.phoneticUs,
    pos: parseStringList(row.pos),
    definitions: defs,
    examples,
    found: true,
  }
}
