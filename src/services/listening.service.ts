/**
 * 听力训练服务（架构 §3.1 L1-L8 / Phase 2 设计 §五）。
 *
 * 关键决策：
 *   - **判分全部走确定性算法**（客观题精确匹配 / 关键词模糊匹配 / 听写本地 diff），
 *     0 个依赖 AI —— 保证 Mock 阶段听力模块完整可用；
 *   - AI 只在「报告分析 / 下一步建议」两处介入（A12），且有规则兜底，不会不可用；
 *   - 字幕时间轴按词数估算（`ladder.estimateTimeline`），不用 TTS 输出（§5.1 局限③）。
 *
 * 本文件为 DB 编排层；纯算法在 `./listening/{dictation,ladder}`。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { userToday } from '@/lib/utils/user-date'
import { Prisma, type CEFRLevel, type Difficulty } from '@prisma/client'

import {
  diffDictation,
  fuzzyMatch,
  type DictationResult,
  type DictationToken,
} from './listening/dictation'
import {
  modeMeta,
  recommendedRate,
  type JudgeKind,
  type ListeningModeKey,
  type TimelineLine,
} from './listening/ladder'

const log = createLogger('listening.service')

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface ListeningAudioUrlDto {
  rate: number
  url: string
  /** 音频实际时长（秒）；未登记资产时为 null */
  durationSec: number | null
}

export interface ListeningFocusPointDto {
  word: string
  meaning: string
  /** NEW_WORD | KEY_WORD | PHRASE | GRAMMAR */
  type: string
  startSec: number
}

export interface ListeningMaterialListItem {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: string
  cefrLevel: string | null
  intensityLevel: number
  durationSec: number
  wordCount: number
  audioUrls: ListeningAudioUrlDto[]
  recommendedRate: number
  coverUrl: string | null
  questionCount: number
  /** 当前用户播放进度（未训练为 null） */
  progress: ListeningProgressDto | null
  /** 历史最佳正确率（未训练为 null） */
  bestAccuracy: number | null
}

export interface ListeningProgressDto {
  positionSec: number
  playbackRate: number
  completed: boolean
}

/** 材料列表用的进度行（含 materialId，便于回填） */
interface ProgressRow {
  materialId: string
  positionSec: number
  playbackRate: number
  completed: boolean
}

export interface ListeningFacetItem {
  value: string
  count: number
}

export interface ListeningFacets {
  categories: ListeningFacetItem[]
  difficulties: ListeningFacetItem[]
  intensityLevels: ListeningFacetItem[]
}

export interface ListeningListResult {
  materials: ListeningMaterialListItem[]
  facets: ListeningFacets
  total: number
  page: number
  pageSize: number
}

export interface ListeningDetail {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: string
  cefrLevel: string | null
  intensityLevel: number
  durationSec: number
  wordCount: number
  /** 兼容字段：默认档（1.0）音频地址 */
  audioUrl: string
  audioUrls: ListeningAudioUrlDto[]
  recommendedRate: number
  transcript: TimelineLine[]
  translation: string | null
  focusPoints: ListeningFocusPointDto[]
  progress: ListeningProgressDto | null
  /** Phase 2 可用的 6 个模式（RETELL 移 Phase 3） */
  availableModes: ListeningModeKey[]
  questionCount: number
}

export interface ListeningQuestionItem {
  id: string
  type: string
  stem: string
  options: string[] | null
  /** 关键词模式的释义提示 */
  hint: string | null
}

export interface ListeningQuestionsResult {
  materialId: string
  mode: ListeningModeKey
  /** 判分方式（objective / fuzzy / diff / none / ai） */
  judge: JudgeKind
  /** Phase 2 是否可用（RETELL 为 false → 前端显示「即将上线」） */
  available: boolean
  questions: ListeningQuestionItem[]
  /** 听写 / 精听模式的原文（按句） */
  transcript: TimelineLine[] | null
}

export interface ListeningAttemptInput {
  mode: ListeningModeKey
  answers?: Array<{ questionId: string; userAnswer: string }>
  durationSec?: number
  unknownWords?: Array<{ word: string; meaning?: string }>
  dictationText?: string
  playbackRate?: number
}

export interface ListeningAttemptResult {
  recordId: string
  mode: ListeningModeKey
  accuracy: number
  correctCount: number
  totalCount: number
  /** 听写模式的逐词 diff（对/错/漏/多 四态） */
  dictationDiff: DictationToken[] | null
}

export interface ListeningReportAnswer {
  questionId: string
  userAnswer: string
  isCorrect: boolean
}

export interface ListeningReport {
  recordId: string
  materialId: string
  materialTitle: string
  intensityLevel: number
  mode: string
  accuracy: number
  correctCount: number
  totalCount: number
  durationSec: number
  playbackRate: number
  completedAt: string
  unknownWords: Array<{ word: string; meaning?: string }>
  focusPoints: ListeningFocusPointDto[]
  ruleStats: Record<string, number>
  answers: ListeningReportAnswer[]
  dictationDiff: DictationToken[] | null
  ai: { degraded: boolean }
}

export interface ListeningAnalysis {
  accuracy: number
  suggestions: string[]
  weakSpots: string[]
  nextMaterials: Array<{ id: string; title: string; intensityLevel: number }>
}

export interface ListeningAnalyzeResult {
  analysis: ListeningAnalysis
  /** 分析来源：ai = AI 生成；rule = 规则兜底（Mock / 无 Key） */
  source: 'ai' | 'rule'
  ai: { degraded: boolean }
}

// ---------------------------------------------------------------------------
// Json 解析辅助（Prisma Json → DTO）
// ---------------------------------------------------------------------------

function parseAudioUrls(value: unknown): Array<{ rate: number; url: string }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ rate: number; url: string }> = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const rate = (item as { rate?: unknown }).rate
    const url = (item as { url?: unknown }).url
    if (typeof rate !== 'number' || typeof url !== 'string') continue
    out.push({ rate, url })
  }
  return out.sort((a, b) => a.rate - b.rate)
}

function parseFocusPoints(value: unknown): ListeningFocusPointDto[] {
  if (!Array.isArray(value)) return []
  const out: ListeningFocusPointDto[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { word?: unknown; meaning?: unknown; type?: unknown; startSec?: unknown }
    if (typeof r.word !== 'string') continue
    out.push({
      word: r.word,
      meaning: typeof r.meaning === 'string' ? r.meaning : '',
      type: typeof r.type === 'string' ? r.type : 'NEW_WORD',
      startSec: typeof r.startSec === 'number' ? r.startSec : 0,
    })
  }
  return out
}

function parseTranscript(value: unknown): TimelineLine[] {
  if (!Array.isArray(value)) return []
  const out: TimelineLine[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as { startSec?: unknown; endSec?: unknown; en?: unknown; zh?: unknown }
    if (typeof r.en !== 'string') continue
    out.push({
      startSec: typeof r.startSec === 'number' ? r.startSec : 0,
      endSec: typeof r.endSec === 'number' ? r.endSec : 0,
      en: r.en,
      zh: typeof r.zh === 'string' ? r.zh : '',
    })
  }
  return out
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** 字幕原文（听写比对用）：按时间轴顺序拼接 */
function transcriptText(transcript: TimelineLine[]): string {
  return transcript.map((l) => l.en).join(' ')
}

/** knowledgePoints[0] 即训练模式标签（seed 时写入） */
function knowledgeMode(value: unknown): string {
  const list = parseStringList(value)
  return list[0] ?? ''
}

/** 记录里的作答载荷（objective/keyword/dictation 三种形态） */
type AnswersPayload =
  | { kind: 'objective' | 'keyword'; items: ListeningReportAnswer[] }
  | { kind: 'dictation'; diff: DictationToken[] }
  | { kind: 'none' }

function parseAnswersPayload(value: unknown): AnswersPayload {
  if (value === null || typeof value !== 'object') return { kind: 'none' }
  const kind = (value as { kind?: unknown }).kind
  if (kind === 'dictation') {
    const diff = (value as { diff?: unknown }).diff
    return { kind: 'dictation', diff: Array.isArray(diff) ? (diff as DictationToken[]) : [] }
  }
  if (kind === 'objective' || kind === 'keyword') {
    const items = (value as { items?: unknown }).items
    const out: ListeningReportAnswer[] = []
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it === null || typeof it !== 'object') continue
        const r = it as { questionId?: unknown; userAnswer?: unknown; isCorrect?: unknown }
        if (typeof r.questionId !== 'string' || typeof r.userAnswer !== 'string') continue
        out.push({ questionId: r.questionId, userAnswer: r.userAnswer, isCorrect: r.isCorrect === true })
      }
    }
    return { kind, items: out }
  }
  // 兼容 Phase 1 的裸数组形态 [{questionId,userAnswer,isCorrect}]
  if (Array.isArray(value)) {
    const out: ListeningReportAnswer[] = []
    for (const it of value) {
      if (it === null || typeof it !== 'object') continue
      const r = it as { questionId?: unknown; userAnswer?: unknown; isCorrect?: unknown }
      if (typeof r.questionId !== 'string' || typeof r.userAnswer !== 'string') continue
      out.push({ questionId: r.questionId, userAnswer: r.userAnswer, isCorrect: r.isCorrect === true })
    }
    return { kind: 'objective', items: out }
  }
  return { kind: 'none' }
}

// ---------------------------------------------------------------------------
// 材料加载
// ---------------------------------------------------------------------------

const MATERIAL_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  difficulty: true,
  cefrLevel: true,
  intensityLevel: true,
  durationSec: true,
  wordCount: true,
  audioUrl: true,
  audioUrls: true,
  coverUrl: true,
  _count: { select: { questions: true } },
} satisfies Prisma.ListeningMaterialSelect

const MATERIAL_DETAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  difficulty: true,
  cefrLevel: true,
  intensityLevel: true,
  durationSec: true,
  wordCount: true,
  audioUrl: true,
  audioUrls: true,
  translation: true,
  transcript: true,
  focusPoints: true,
  coverUrl: true,
} satisfies Prisma.ListeningMaterialSelect

const MATERIAL_TRAIN_SELECT = {
  ...MATERIAL_DETAIL_SELECT,
  questions: {
    select: {
      id: true,
      type: true,
      stem: true,
      options: true,
      answer: true,
      answerAliases: true,
      explanation: true,
      knowledgePoints: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.ListeningMaterialSelect

/** 加载材料（不存在 / 已软删 → 404） */
async function loadMaterialOr404(materialId: string): Promise<MaterialDetailRow> {
  const material = await prisma.listeningMaterial.findFirst({
    where: { id: materialId, status: 'PUBLISHED', deletedAt: null },
    select: MATERIAL_DETAIL_SELECT,
  })
  if (!material) throw errNotFound('听力材料不存在')
  return material
}

type MaterialDetailRow = Prisma.ListeningMaterialGetPayload<{ select: typeof MATERIAL_DETAIL_SELECT }>

/** 解析模式键（非法值 → 400） */
function parseMode(mode: string): ListeningModeKey {
  const upper = mode.trim().toUpperCase()
  if (!(upper in MODE_GUARD)) throw new AppError('VALIDATION_ERROR', `未知的训练模式：${mode}`)
  return upper as ListeningModeKey
}

const MODE_GUARD: Record<string, true> = {
  INTENSIVE: true,
  EXTENSIVE: true,
  DICTATION: true,
  CHOICE: true,
  KEYWORD: true,
  RETELL: true,
  CLOZE: true,
}

/** 音频地址 DTO：优先用资产表里的真实时长 */
async function audioUrlDtos(materialId: string, fallback: unknown): Promise<ListeningAudioUrlDto[]> {
  const assets = await prisma.listeningAudioAsset.findMany({
    where: { materialId },
    select: { rate: true, url: true, durationSec: true },
    orderBy: { rate: 'asc' },
  })
  const byRate = new Map(assets.map((a) => [a.rate, a]))
  const urls = parseAudioUrls(fallback)
  return urls.map((u) => {
    const asset = byRate.get(u.rate)
    return { rate: u.rate, url: asset?.url ?? u.url, durationSec: asset?.durationSec ?? null }
  })
}

// ---------------------------------------------------------------------------
// L1 材料列表
// ---------------------------------------------------------------------------

export interface ListeningListQuery {
  category?: string
  difficulty?: string
  cefr?: string
  intensity?: number
  page?: number
  pageSize?: number
}

function tally(values: Array<string | null>): ListeningFacetItem[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v ?? ''
    if (key === '') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
}

export async function listMaterials(userId: string, query: ListeningListQuery): Promise<ListeningListResult> {
  const where: Prisma.ListeningMaterialWhereInput = { status: 'PUBLISHED', deletedAt: null }
  if (query.category) where.category = query.category
  if (query.difficulty) where.difficulty = query.difficulty as Difficulty
  if (query.cefr) where.cefrLevel = query.cefr as CEFRLevel
  if (typeof query.intensity === 'number' && query.intensity > 0) where.intensityLevel = query.intensity

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total, facetRows] = await Promise.all([
    prisma.listeningMaterial.findMany({
      where,
      select: MATERIAL_LIST_SELECT,
      orderBy: [{ intensityLevel: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.listeningMaterial.count({ where }),
    // facets 不带分页/筛选，反映全量分布（供前端筛选项计数）
    prisma.listeningMaterial.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { category: true, difficulty: true, cefrLevel: true, intensityLevel: true },
    }),
  ])

  const ids = rows.map((r) => r.id)
  const [progressRows, recordRows] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([] as ProgressRow[])
      : prisma.listeningProgress.findMany({
          where: { userId, materialId: { in: ids } },
          select: { materialId: true, positionSec: true, playbackRate: true, completed: true },
        }),
    ids.length === 0
      ? Promise.resolve([] as Array<{ materialId: string; accuracy: number }>)
      : prisma.listeningRecord.findMany({
          where: { userId, materialId: { in: ids } },
          select: { materialId: true, accuracy: true },
          orderBy: { completedAt: 'desc' },
        }),
  ])

  const progressById = new Map(progressRows.map((p) => [p.materialId, p]))
  const bestAccuracy = new Map<string, number>()
  for (const r of recordRows) {
    const prev = bestAccuracy.get(r.materialId) ?? -1
    if (r.accuracy > prev) bestAccuracy.set(r.materialId, r.accuracy)
  }

  const materials: ListeningMaterialListItem[] = []
  for (const row of rows) {
    const p = progressById.get(row.id)
    materials.push({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      difficulty: row.difficulty,
      cefrLevel: row.cefrLevel,
      intensityLevel: row.intensityLevel,
      durationSec: row.durationSec,
      wordCount: row.wordCount,
      audioUrls: await audioUrlDtos(row.id, row.audioUrls),
      recommendedRate: recommendedRate(row.intensityLevel),
      coverUrl: row.coverUrl,
      questionCount: row._count?.questions ?? 0,
      progress: p
        ? { positionSec: p.positionSec, playbackRate: p.playbackRate, completed: p.completed }
        : null,
      bestAccuracy: bestAccuracy.get(row.id) ?? null,
    })
  }

  return {
    materials,
    facets: {
      categories: tally(facetRows.map((f) => f.category)),
      difficulties: tally(facetRows.map((f) => f.difficulty)),
      intensityLevels: tally(facetRows.map((f) => String(f.intensityLevel))),
    },
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// L2 精听页数据
// ---------------------------------------------------------------------------

export async function getMaterialDetail(userId: string, materialId: string): Promise<ListeningDetail> {
  const material = await loadMaterialOr404(materialId)
  const progress = await prisma.listeningProgress.findUnique({
    where: { userId_materialId: { userId, materialId } },
    select: { positionSec: true, playbackRate: true, completed: true },
  })

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    category: material.category,
    difficulty: material.difficulty,
    cefrLevel: material.cefrLevel,
    intensityLevel: material.intensityLevel,
    durationSec: material.durationSec,
    wordCount: material.wordCount,
    audioUrl: material.audioUrl,
    audioUrls: await audioUrlDtos(material.id, material.audioUrls),
    recommendedRate: recommendedRate(material.intensityLevel),
    transcript: parseTranscript(material.transcript),
    translation: material.translation,
    focusPoints: parseFocusPoints(material.focusPoints),
    progress: progress
      ? { positionSec: progress.positionSec, playbackRate: progress.playbackRate, completed: progress.completed }
      : null,
    availableModes: ['EXTENSIVE', 'CHOICE', 'CLOZE', 'KEYWORD', 'INTENSIVE', 'DICTATION'],
    questionCount: 0,
  }
}

// ---------------------------------------------------------------------------
// L3 按模式取题
// ---------------------------------------------------------------------------

export async function getModeQuestions(userId: string, materialId: string, mode: string): Promise<ListeningQuestionsResult> {
  const key = parseMode(mode)
  const material = await prisma.listeningMaterial.findFirst({
    where: { id: materialId, status: 'PUBLISHED', deletedAt: null },
    select: MATERIAL_TRAIN_SELECT,
  })
  if (!material) throw errNotFound('听力材料不存在')

  const meta = modeMeta(key)
  const base = { materialId, mode: key, judge: meta.judge, available: meta.available }

  // RETELL：Phase 3 接录音，Phase 2 只声明不可用
  if (!meta.available) {
    return { ...base, questions: [], transcript: null }
  }

  // 关键词捕捉：由 focusPoints 生成填空题（脚本判 fuzzy）
  if (key === 'KEYWORD') {
    const fps = parseFocusPoints(material.focusPoints)
    return {
      ...base,
      questions: fps.map((fp, i) => ({
        id: `fp:${i}`,
        type: 'FILL_BLANK',
        stem: `听音填空：${fp.meaning}`,
        options: null,
        hint: fp.meaning,
      })),
      transcript: null,
    }
  }

  // 精听 / 听写：无客观题，返回原文逐句
  if (key === 'INTENSIVE' || key === 'DICTATION') {
    return { ...base, questions: [], transcript: parseTranscript(material.transcript) }
  }

  // 客观题模式：EXTENSIVE / CHOICE / CLOZE → 按 knowledgePoints[0] 筛
  const wanted = key === 'EXTENSIVE' ? ['EXTENSIVE', 'CHOICE'] : [key]
  const picked = material.questions.filter((q) => wanted.includes(knowledgeMode(q.knowledgePoints)))
  return {
    ...base,
    questions: picked.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: parseStringList(q.options).length > 0 ? parseStringList(q.options) : null,
      hint: null,
    })),
    transcript: null,
  }
}

// ---------------------------------------------------------------------------
// 判分
// ---------------------------------------------------------------------------

/** 客观题判分：大小写/首尾空白不敏感；支持别名与「选项文本」写法 */
function gradeObjective(answer: string, aliases: unknown, userAnswer: string): boolean {
  const norm = (s: string): string => s.trim().toUpperCase()
  const given = norm(userAnswer)
  if (given === '') return false
  if (norm(answer) === given) return true
  const aliasList = Array.isArray(aliases) ? aliases.map((a) => norm(String(a))) : []
  return aliasList.includes(given)
}

// ---------------------------------------------------------------------------
// L4 提交训练结果
// ---------------------------------------------------------------------------

export async function submitAttempt(
  userId: string,
  materialId: string,
  input: ListeningAttemptInput,
): Promise<ListeningAttemptResult> {
  const mode = parseMode(input.mode)
  const material = await prisma.listeningMaterial.findFirst({
    where: { id: materialId, status: 'PUBLISHED', deletedAt: null },
    select: MATERIAL_TRAIN_SELECT,
  })
  if (!material) throw errNotFound('听力材料不存在')

  const durationSec = Math.max(0, Math.min(86_400, Math.round(input.durationSec ?? 0)))
  const playbackRate = typeof input.playbackRate === 'number' && input.playbackRate > 0 ? input.playbackRate : 1
  const unknownWords = (input.unknownWords ?? []) as unknown as Prisma.InputJsonValue
  const answersInput = Array.isArray(input.answers) ? input.answers : []

  const graded: ListeningReportAnswer[] = []
  let dictationDiff: DictationToken[] | null = null
  let accuracy = 0
  let correctCount = 0
  let totalCount = 0

  if (mode === 'DICTATION') {
    // 本地 diff，零 AI、零延迟（L8 同款算法）
    const text = typeof input.dictationText === 'string' ? input.dictationText : ''
    const result: DictationResult = diffDictation(transcriptText(parseTranscript(material.transcript)), text)
    dictationDiff = result.diff
    accuracy = result.accuracy
    correctCount = result.correctCount
    totalCount = result.totalCount
  } else if (mode === 'KEYWORD') {
    const fps = parseFocusPoints(material.focusPoints)
    totalCount = fps.length
    for (const a of answersInput) {
      const idx = Number(a.questionId.replace(/^fp:/, ''))
      const fp = fps[idx]
      if (!fp) continue
      const ok = fuzzyMatch(fp.word, a.userAnswer)
      if (ok) correctCount += 1
      graded.push({ questionId: a.questionId, userAnswer: a.userAnswer, isCorrect: ok })
    }
    accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0
  } else if (mode === 'INTENSIVE') {
    // 精听无判分（纯练习）：记录一次完成事件，accuracy 记 0
    accuracy = 0
  } else {
    // 客观题：EXTENSIVE / CHOICE / CLOZE
    const byId = new Map(material.questions.map((q) => [q.id, q]))
    for (const a of answersInput) {
      const q = byId.get(a.questionId)
      if (!q) continue
      totalCount += 1
      const ok = gradeObjective(q.answer, q.answerAliases, a.userAnswer)
      if (ok) correctCount += 1
      graded.push({ questionId: a.questionId, userAnswer: a.userAnswer, isCorrect: ok })
    }
    accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0
  }

  const payload: AnswersPayload =
    mode === 'DICTATION'
      ? { kind: 'dictation', diff: dictationDiff ?? [] }
      : mode === 'INTENSIVE'
        ? { kind: 'none' }
        : { kind: mode === 'KEYWORD' ? 'keyword' : 'objective', items: graded }

  // 用户本地日期先算好，避免在事务内再打一次 DB
  const today = await userToday(userId)

  const recordId = await prisma.$transaction(async (tx) => {
    const record = await tx.listeningRecord.create({
      data: {
        userId,
        materialId: material.id,
        mode,
        accuracy,
        totalCount,
        correctCount,
        unknownWords,
        durationSec,
        playbackRate,
        answers: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    await tx.dailyLearningStat.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        listeningCount: { increment: 1 },
        listeningSeconds: { increment: durationSec },
        xpEarned: { increment: 10 },
      },
      create: {
        userId,
        date: today,
        listeningCount: 1,
        listeningSeconds: durationSec,
        xpEarned: 10,
      },
    })
    return record.id
  })

  log.info({ msg: 'listening attempt submitted', userId, materialId, mode, accuracy, correctCount, totalCount })
  return { recordId, mode, accuracy, correctCount, totalCount, dictationDiff }
}

// ---------------------------------------------------------------------------
// L5 训练报告
// ---------------------------------------------------------------------------

export async function getRecordReport(userId: string, recordId: string): Promise<ListeningReport> {
  const record = await prisma.listeningRecord.findFirst({
    where: { id: recordId, userId },
    select: {
      id: true,
      materialId: true,
      mode: true,
      accuracy: true,
      totalCount: true,
      correctCount: true,
      durationSec: true,
      playbackRate: true,
      unknownWords: true,
      answers: true,
      completedAt: true,
      material: { select: { id: true, title: true, intensityLevel: true, focusPoints: true, transcript: true } },
    },
  })
  if (!record) throw errNotFound('训练记录不存在')

  const payload = parseAnswersPayload(record.answers)
  const diff = payload.kind === 'dictation' ? payload.diff : null
  const answers = payload.kind === 'objective' || payload.kind === 'keyword' ? payload.items : []

  // 规则统计：纯确定性数字，AI 不可用时也保证报告有内容
  const ruleStats: Record<string, number> = {
    accuracy: Math.round(record.accuracy * 10) / 10,
    correctCount: record.correctCount,
    totalCount: record.totalCount,
    durationSec: record.durationSec,
    playbackRate: record.playbackRate,
  }
  if (diff) {
    ruleStats.substituted = diff.filter((d) => d.type === 'wrong').length
    ruleStats.missing = diff.filter((d) => d.type === 'missing').length
    ruleStats.extra = diff.filter((d) => d.type === 'extra').length
  }

  const unknownWords: Array<{ word: string; meaning?: string }> = []
  if (Array.isArray(record.unknownWords)) {
    for (const item of record.unknownWords) {
      if (item === null || typeof item !== 'object') continue
      const r = item as { word?: unknown; meaning?: unknown }
      if (typeof r.word !== 'string') continue
      unknownWords.push({ word: r.word, ...(typeof r.meaning === 'string' ? { meaning: r.meaning } : {}) })
    }
  }

  return {
    recordId: record.id,
    materialId: record.materialId,
    materialTitle: record.material.title,
    intensityLevel: record.material.intensityLevel,
    mode: record.mode,
    accuracy: Math.round(record.accuracy * 10) / 10,
    correctCount: record.correctCount,
    totalCount: record.totalCount,
    durationSec: record.durationSec,
    playbackRate: record.playbackRate,
    completedAt: record.completedAt.toISOString(),
    unknownWords,
    focusPoints: parseFocusPoints(record.material.focusPoints),
    ruleStats,
    answers,
    dictationDiff: diff,
    ai: { degraded: true },
  }
}

// ---------------------------------------------------------------------------
// L6 AI 听力分析（A12，带规则兜底）
// ---------------------------------------------------------------------------

/** 规则兜底分析：从记录本身推导建议/弱项/下一步，无 AI 也有真实可用内容 */
async function buildRuleAnalysis(userId: string, materialId: string, report: ListeningReport): Promise<ListeningAnalysis> {
  const weakSpots: string[] = []
  const suggestions: string[] = []

  if (report.accuracy >= 90) {
    suggestions.push('正确率很高，可以挑战更高强度档（intensityLevel +1）的材料。')
  } else if (report.accuracy >= 70) {
    suggestions.push('正确率良好，建议对错题所在句子做 2-3 次 A-B 循环精听。')
  } else {
    suggestions.push('正确率偏低，建议先用 0.75x 慢速泛听一遍，再逐句精听。')
  }
  if (report.mode === 'DICTATION' && report.dictationDiff) {
    const missing = report.dictationDiff.filter((d) => d.type === 'missing').length
    const wrong = report.dictationDiff.filter((d) => d.type === 'wrong').length
    const extra = report.dictationDiff.filter((d) => d.type === 'extra').length
    if (missing > 0) weakSpots.push(`漏听 ${missing} 词——注意连读与弱读。`)
    if (wrong > 0) weakSpots.push(`听错 ${wrong} 词——核对发音相近词。`)
    if (extra > 0) weakSpots.push(`多写 ${extra} 词——可能是脑补未出现的词。`)
  }
  for (const w of report.unknownWords.slice(0, 5)) {
    weakSpots.push(`生词：${w.word}${w.meaning ? `（${w.meaning}）` : ''}`)
  }
  if (weakSpots.length === 0) weakSpots.push('本次未标记明显弱项，保持当前强度即可。')

  const next = await prisma.listeningMaterial.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: materialId },
      intensityLevel: report.accuracy >= 85 ? report.intensityLevel + 1 : report.intensityLevel,
    },
    select: { id: true, title: true, intensityLevel: true },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })

  return {
    accuracy: report.accuracy,
    suggestions,
    weakSpots,
    nextMaterials: next.map((m) => ({ id: m.id, title: m.title, intensityLevel: m.intensityLevel })),
  }
}

export async function analyzeRecord(userId: string, recordId: string): Promise<ListeningAnalyzeResult> {
  const report = await getRecordReport(userId, recordId)
  const rule = await buildRuleAnalysis(userId, report.materialId, report)

  let source: 'ai' | 'rule' = 'rule'
  let aiDegraded = true
  let analysis: ListeningAnalysis = rule

  try {
    const { aiService } = await import('./ai/ai.service')
    const result = await aiService.analyzeListening(
      {
        materialTitle: report.materialTitle,
        mode: report.mode,
        accuracy: report.accuracy,
        correctCount: report.correctCount,
        totalCount: report.totalCount,
        unknownWords: report.unknownWords,
        intensityLevel: report.intensityLevel,
      },
      { userId, traceId: `listening-${recordId}`, locale: 'zh-CN' },
    )
    aiDegraded = result.degraded
    if (!result.degraded && result.data !== null && typeof result.data === 'object') {
      const d = result.data as { suggestions?: unknown; weakSpots?: unknown; nextMaterials?: unknown }
      source = 'ai'
      analysis = {
        accuracy: report.accuracy,
        suggestions: parseStringList(d.suggestions).length > 0 ? parseStringList(d.suggestions) : rule.suggestions,
        weakSpots: parseStringList(d.weakSpots).length > 0 ? parseStringList(d.weakSpots) : rule.weakSpots,
        nextMaterials: Array.isArray(d.nextMaterials)
          ? (d.nextMaterials as ListeningAnalysis['nextMaterials'])
          : rule.nextMaterials,
      }
    }
  } catch (error) {
    log.warn({ msg: 'listening analyze degraded to rule', recordId, error: String(error) })
  }

  return { analysis, source, ai: { degraded: aiDegraded } }
}

// ---------------------------------------------------------------------------
// L7 播放进度
// ---------------------------------------------------------------------------

export interface SaveProgressInput {
  materialId: string
  positionSec: number
  playbackRate?: number
  completed?: boolean
}

export async function saveProgress(userId: string, input: SaveProgressInput): Promise<ListeningProgressDto> {
  const positionSec = Math.max(0, Math.min(86_400, Math.round(input.positionSec)))
  // 倍速钳制到 [0.5, 2]（与 Zod schema 一致；service 层再兜一次，防止绕过 schema 的调用方）
  const playbackRate =
    typeof input.playbackRate === 'number' && Number.isFinite(input.playbackRate)
      ? Math.min(2, Math.max(0.5, input.playbackRate))
      : 1
  const completed = input.completed === true

  const row = await prisma.listeningProgress.upsert({
    where: { userId_materialId: { userId, materialId: input.materialId } },
    update: { positionSec, playbackRate, completed },
    create: { userId, materialId: input.materialId, positionSec, playbackRate, completed },
    select: { positionSec: true, playbackRate: true, completed: true },
  })
  return row
}

// ---------------------------------------------------------------------------
// L8 听写比对（纯本地 diff，不调 AI）
// ---------------------------------------------------------------------------

export function checkDictation(original: string, dictation: string): DictationResult {
  return diffDictation(original, dictation)
}
