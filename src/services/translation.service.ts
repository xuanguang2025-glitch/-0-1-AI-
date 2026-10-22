/**
 * 翻译训练服务（架构 §3.1 T1-T3 / Phase 2 设计 T18，轻量版）。
 *
 * 关键决策：
 *   - **5 档译文**（literal/natural/formal/academic/spoken）由 AI 一次性返回；
 *     **Mock 的 generic 回显没有分档**，因此解析防御式：AI 给哪档展示哪档，
 *     缺的档前端显示「AI 暂不可用」（验收 2：Tab 可切换不白屏）；
 *   - **生词抽取走词典直查**（vocabulary 表），不调 AI——与阅读划词同一策略；
 *   - 收藏 = 原句入 `favorites`（targetType='translation'）+ 抽取生词
 *     upsert 进 `user_vocabulary`（inNotebook=true，验收 3）；
 *   - 历史保留最近 50 条：**创建时顺带裁剪**（删除第 51 条之外的旧行），
 *     而不是靠查询 limit——否则用户会误以为历史还在。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { Prisma } from '@prisma/client'

import { aiService } from './ai/ai.service'

const log = createLogger('translation.service')

/** 历史保留条数（验收 4） */
export const HISTORY_KEEP = 50

/** 输入上限（验收 1） */
export const MAX_SOURCE_LEN = 500

/** 5 档译文键 */
export const TRANSLATE_STYLES = ['literal', 'natural', 'formal', 'academic', 'spoken'] as const
export type TranslateStyle = (typeof TRANSLATE_STYLES)[number]

/** 生词抽取上限 */
const MAX_EXTRACTED_WORDS = 5

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface TranslationStyles {
  literal: string | null
  natural: string | null
  formal: string | null
  academic: string | null
  spoken: string | null
}

export interface TranslationResult {
  id: string
  direction: 'zh2en' | 'en2zh'
  sourceText: string
  styles: TranslationStyles
  notes: string | null
  /** true = AI 完全不可用（连 literal 都没有），前端给明确提示 */
  degraded: boolean
  /** 哪些档可用（前端渲染 Tab 用） */
  availableStyles: TranslateStyle[]
}

export interface TranslationRecordItem {
  id: string
  direction: string
  sourceText: string
  /** 首个可用档的译文（列表预览用） */
  preview: string | null
  isFavorite: boolean
  createdAt: string
}

export interface TranslationHistoryResult {
  records: TranslationRecordItem[]
  total: number
  page: number
  pageSize: number
}

export interface ExtractedWord {
  word: string
  lemma: string
  meanings: string[]
  /** 是否已在生词本 */
  inNotebook: boolean
  /** vocabulary 行 id（加生词本用） */
  vocabularyId: string
}

// ---------------------------------------------------------------------------
// 解析助手
// ---------------------------------------------------------------------------

const STYLE_NAMES: Record<TranslateStyle, string> = {
  literal: '直译',
  natural: '地道',
  formal: '正式书面',
  academic: '学术',
  spoken: '口语',
}

export function styleName(style: TranslateStyle): string {
  return STYLE_NAMES[style]
}

function parseDirection(value: string): 'zh2en' | 'en2zh' {
  if (value === 'zh2en' || value === 'en2zh') return value
  throw new AppError('VALIDATION_ERROR', `不支持的翻译方向：${value}`)
}

/** 从 AI 结果里按档取字符串（Mock generic 回显 → literal 取 echo） */
function parseStyles(data: unknown): TranslationStyles {
  const out: TranslationStyles = { literal: null, natural: null, formal: null, academic: null, spoken: null }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return out
  const d = data as Record<string, unknown>
  for (const style of TRANSLATE_STYLES) {
    const v = d[style]
    if (typeof v === 'string' && v.trim().length > 0) out[style] = v.trim()
  }
  // Mock generic 回显 {mock:true, echo, summary}：literal 回退 echo
  if (out.literal === null && typeof d.echo === 'string' && d.echo.trim().length > 0) {
    out.literal = d.echo.trim()
  }
  return out
}

function parseNotes(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  for (const key of ['notes', 'summary', 'overallComment']) {
    const v = d[key]
    if (typeof v === 'string' && v.trim().length > 0 && v.includes('Mock') === false) return v.trim()
  }
  return null
}

// ---------------------------------------------------------------------------
// T1 · 翻译（创建记录 + 历史裁剪）
// ---------------------------------------------------------------------------

export interface TranslateInput {
  text: string
  direction: string
}

export async function translateText(userId: string, input: TranslateInput): Promise<TranslationResult> {
  const direction = parseDirection(input.direction)
  const text = input.text.trim()
  if (text.length === 0) throw new AppError('VALIDATION_ERROR', '请输入要翻译的内容')
  if (text.length > MAX_SOURCE_LEN) {
    throw new AppError('VALIDATION_ERROR', `内容过长（上限 ${MAX_SOURCE_LEN} 字符，当前 ${text.length}）`)
  }

  // ---- AI 翻译（防御式解析；Mock generic 回显 → literal）----
  let styles: TranslationStyles = { literal: null, natural: null, formal: null, academic: null, spoken: null }
  let notes: string | null = null
  try {
    const res = await aiService.translate({ text, direction }, { userId, traceId: `translation-${Date.now()}`, locale: 'zh-CN' })
    if (!res.degraded && res.data !== null) {
      styles = parseStyles(res.data)
      notes = parseNotes(res.data)
    }
  } catch (error) {
    log.warn({ msg: 'translate failed (all styles unavailable)', userId, error: String(error) })
  }

  const degraded = TRANSLATE_STYLES.every((s) => styles[s] === null)

  const row = await prisma.translationRecord.create({
    data: {
      userId,
      direction,
      sourceText: text,
      aiResult: styles as unknown as Prisma.InputJsonValue,
      aiNotes: notes,
      aiDegraded: degraded,
    },
    select: { id: true },
  })

  // 历史保留最近 HISTORY_KEEP 条：裁掉更早的（验收 4）
  await pruneHistory(userId)

  const availableStyles = TRANSLATE_STYLES.filter((s) => styles[s] !== null)

  return { id: row.id, direction, sourceText: text, styles, notes, degraded, availableStyles }
}

/** 删除第 HISTORY_KEEP 条之外的旧记录（按 createdAt 倒序保留） */
async function pruneHistory(userId: string): Promise<void> {
  const keep = await prisma.translationRecord.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_KEEP,
  })
  if (keep.length < HISTORY_KEEP) return
  await prisma.translationRecord.deleteMany({
    where: { userId, id: { notIn: keep.map((r) => r.id) } },
  })
}

// ---------------------------------------------------------------------------
// T2 · 收藏（原句入 favorites + 生词入 user_vocabulary）
// ---------------------------------------------------------------------------

export interface TranslationSaveResult {
  favorited: boolean
  addedWords: string[]
}

/** 抽取「值得收藏」的词：≥4 字母、非停用词、且在词典中 */
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'has', 'had', 'they', 'them', 'their', 'there',
  'then', 'than', 'when', 'what', 'which', 'where', 'will', 'would', 'could', 'should',
  'about', 'after', 'before', 'because', 'being', 'been', 'into', 'over', 'some', 'such',
  'only', 'also', 'very', 'just', 'more', 'most', 'much', 'many', 'make', 'made', 'like',
  'time', 'year', 'years', 'your', 'yours', 'ours', 'here', 'each', 'both', 'were', 'was',
])

export function extractCandidateWords(text: string, limit = MAX_EXTRACTED_WORDS): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[^A-Za-z]+/)) {
    const w = raw.toLowerCase()
    if (w.length < 4 || STOPWORDS.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= limit) break
  }
  return out
}

/** 抽取的生词 → upsert user_vocabulary（inNotebook=true） */
async function addWordsToNotebook(userId: string, words: string[]): Promise<string[]> {
  const added: string[] = []
  for (const lemma of words) {
    const vocab = await prisma.vocabulary.findUnique({ where: { lemma }, select: { id: true } })
    if (vocab === null) continue // 词典未收录的词跳过（不造生词）
    await prisma.userVocabulary.upsert({
      where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } },
      update: { inNotebook: true },
      create: { userId, vocabularyId: vocab.id, inNotebook: true },
    })
    added.push(lemma)
  }
  return added
}

export interface TranslationSaveInput {
  /** translate 返回的记录 id；缺省时先按 sourceText 查最近一条 */
  recordId?: string
  /** 是否同时把抽取的生词加入生词本（默认 true） */
  addWords?: boolean
}

export async function saveTranslation(
  userId: string,
  input: TranslationSaveInput,
): Promise<TranslationSaveResult> {
  // 定位记录：recordId 优先，否则取最近一条
  const record =
    input.recordId !== undefined
      ? await prisma.translationRecord.findFirst({ where: { id: input.recordId, userId }, select: { id: true, sourceText: true, isFavorite: true } })
      : await prisma.translationRecord.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, sourceText: true, isFavorite: true } })
  if (record === null) throw errNotFound('翻译记录不存在（请先完成一次翻译）')

  // ① 原句 + 首档译文入 favorites（幂等：@@unique([userId,targetType,targetId])）
  await prisma.favorite.upsert({
    where: { userId_targetType_targetId: { userId, targetType: 'translation', targetId: record.id } },
    update: {},
    create: {
      userId,
      targetType: 'translation',
      targetId: record.id,
      title: record.sourceText.slice(0, 120),
    },
  })
  await prisma.translationRecord.update({ where: { id: record.id }, data: { isFavorite: true } })

  // ② 抽取生词入生词本（验收 3）
  let addedWords: string[] = []
  if (input.addWords !== false) {
    const candidates = extractCandidateWords(record.sourceText)
    addedWords = await addWordsToNotebook(userId, candidates)
  }

  return { favorited: true, addedWords }
}

// ---------------------------------------------------------------------------
// T3 · 历史
// ---------------------------------------------------------------------------

export async function listHistory(
  userId: string,
  query: { page?: number; pageSize?: number; favoriteOnly?: boolean } = {},
): Promise<TranslationHistoryResult> {
  const where: Prisma.TranslationRecordWhereInput = { userId }
  if (query.favoriteOnly === true) where.isFavorite = true

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total] = await Promise.all([
    prisma.translationRecord.findMany({
      where,
      select: { id: true, direction: true, sourceText: true, aiResult: true, isFavorite: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.translationRecord.count({ where }),
  ])

  return {
    records: rows.map((row) => {
      const styles = parseStyles(row.aiResult)
      const preview = TRANSLATE_STYLES.map((s) => styles[s]).find((v) => v !== null) ?? null
      return {
        id: row.id,
        direction: row.direction,
        sourceText: row.sourceText,
        preview,
        isFavorite: row.isFavorite,
        createdAt: row.createdAt.toISOString(),
      }
    }),
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// 生词抽取（词典直查，0 AI）
// ---------------------------------------------------------------------------

export async function extractWords(userId: string, text: string): Promise<ExtractedWord[]> {
  const candidates = extractCandidateWords(text, 12)
  if (candidates.length === 0) return []

  const rows = await prisma.vocabulary.findMany({
    where: { lemma: { in: candidates } },
    select: { id: true, word: true, lemma: true, definitions: true },
  })
  if (rows.length === 0) return []

  const notebooks = await prisma.userVocabulary.findMany({
    where: { userId, vocabularyId: { in: rows.map((r) => r.id) } },
    select: { vocabularyId: true, inNotebook: true },
  })
  const inNotebook = new Set(notebooks.filter((n) => n.inNotebook).map((n) => n.vocabularyId))

  return rows.slice(0, MAX_EXTRACTED_WORDS).map((row) => {
    const defs = Array.isArray(row.definitions)
      ? (row.definitions as Array<{ pos?: unknown; zh?: unknown }>)
          .map((d) => (typeof d.zh === 'string' ? d.zh : ''))
          .filter(Boolean)
      : []
    return {
      word: row.word,
      lemma: row.lemma,
      meanings: defs.slice(0, 2),
      inNotebook: inNotebook.has(row.id),
      vocabularyId: row.id,
    }
  })
}

/** 把指定词加入生词本（word-extract 组件的收藏动作） */
export async function addWordToNotebook(userId: string, vocabularyId: string): Promise<{ inNotebook: boolean }> {
  const vocab = await prisma.vocabulary.findUnique({ where: { id: vocabularyId }, select: { id: true } })
  if (vocab === null) throw errNotFound('词典未收录该单词')
  const row = await prisma.userVocabulary.upsert({
    where: { userId_vocabularyId: { userId, vocabularyId } },
    update: { inNotebook: true },
    create: { userId, vocabularyId, inNotebook: true },
    select: { inNotebook: true },
  })
  return { inNotebook: row.inNotebook }
}
