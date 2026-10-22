/**
 * 写作训练服务（架构 §3.1 W1-W5 / Phase 2 设计 T17）。
 *
 * 关键决策（双轨评分）：
 *   - **规则轨（同步）**：保存即算 `runRuleCheck`（纯函数 + 词典注入），
 *     0 AI 依赖、<200ms —— 编辑器边写边出规则提示、断网也永远有分可看；
 *   - **AI 轨（异步增强）**：`analyzeWriting` 成功才落 `aiScores/aiCorrections/aiRewrites`
 *     并置 `scoreSource='ai'`；
 *   - **Mock/降级判定看 `degraded` 标志而不是 data 是否为 null**：
 *     gateway 降级时 data 是零分兜底对象（totalScore=0），若不判 degraded
 *     会把 0 分当真实 AI 分写库 —— 这是本服务最容易踩的坑；
 *   - AI 输出形状无法在本环境验证（Mock 恒降级），因此解析全部**防御式**：
 *     任何字段缺失/类型不符都回落 rule 轨，绝不把脏数据透给前端。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { Prisma, type Difficulty, type ExamType } from '@prisma/client'

import { aiService } from './ai/ai.service'
import { runRuleCheck, type RuleCheckResult, type RuleIssue } from './writing/rule-engine'

const log = createLogger('writing.service')

// ---------------------------------------------------------------------------
// 词典缓存（拼写检查用；5 分钟 TTL，避免每次保存都拉全量 lemma）
// ---------------------------------------------------------------------------

let dictCache: { words: Set<string>; loadedAt: number } | null = null
const DICT_TTL_MS = 5 * 60 * 1000

async function loadDictionary(): Promise<Set<string>> {
  if (dictCache && Date.now() - dictCache.loadedAt < DICT_TTL_MS) return dictCache.words
  const rows = await prisma.vocabulary.findMany({ select: { lemma: true } })
  const words = new Set(rows.map((r) => r.lemma))
  dictCache = { words, loadedAt: Date.now() }
  return words
}

/** 测试钩子：清空词典缓存 */
export function clearDictionaryCache(): void {
  dictCache = null
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/** W1 · 任务列表项 */
export interface WritingTaskListItem {
  id: string
  title: string
  taskType: string
  difficulty: string
  examType: string | null
  prompt: string
  wordMin: number | null
  wordMax: number | null
  tags: string[]
  /** 该任务的历史提交数（当前用户） */
  mySubmissionCount: number
}

export interface WritingTaskListResult {
  tasks: WritingTaskListItem[]
  total: number
}

/** 字数要求快照 */
export interface WritingRequiredWords {
  min: number
  max: number
}

/** W2/W3 · 提交列表项 */
export interface WritingSubmissionListItem {
  id: string
  taskId: string
  taskTitle: string
  title: string | null
  wordCount: number
  status: string
  ruleCheckScore: number | null
  /** rule = 规则引擎分；ai = AI 六维分 */
  scoreSource: string
  aiTotalScore: number | null
  updatedAt: string
}

export interface WritingSubmissionListResult {
  submissions: WritingSubmissionListItem[]
  total: number
  page: number
  pageSize: number
}

/** W3 · 提交详情（含双轨分数） */
export interface WritingSubmissionDetail {
  id: string
  taskId: string
  taskTitle: string
  prompt: string
  title: string | null
  content: string
  wordCount: number
  paragraphCount: number
  requiredWords: WritingRequiredWords
  /** 字数是否达标（min ≤ wordCount ≤ max；无要求时 true） */
  wordCountOk: boolean
  /** 规则轨（永远有） */
  ruleCheck: RuleCheckResult | null
  ruleCheckScore: number | null
  /** AI 轨（scoreSource='ai' 时有值） */
  aiScores: Record<string, unknown> | null
  aiTotalScore: number | null
  aiCorrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null
  aiRewrites: Record<string, string> | null
  aiSummary: string | null
  scoreSource: string
  aiDegraded: boolean
  revision: number
  status: string
  submittedAt: string | null
  scoredAt: string | null
}

/** W2 · 创建提交返回（同步规则检查结果） */
export interface WritingCreateResult {
  id: string
  wordCount: number
  paragraphCount: number
  ruleCheck: RuleCheckResult
  ruleCheckScore: number
  requiredWords: WritingRequiredWords
  wordCountOk: boolean
}

/** W4 · 批改结果 */
export interface WritingAnalyzeResult {
  id: string
  /** rule = AI 不可用，展示规则分；ai = AI 六维评分 */
  scoreSource: 'rule' | 'ai'
  aiDegraded: boolean
  ruleCheckScore: number
  aiTotalScore: number | null
  revision: number
  /** AI 摘要（降级时为 null） */
  aiSummary: string | null
}

/** W5 · 报告 */
export interface WritingReport {
  submissionId: string
  taskId: string
  taskTitle: string
  prompt: string
  title: string | null
  wordCount: number
  paragraphCount: number
  requiredWords: WritingRequiredWords
  wordCountOk: boolean
  scoreSource: 'rule' | 'ai'
  aiDegraded: boolean
  /** 规则轨（永远有） */
  ruleScore: number
  ruleIssues: RuleIssue[]
  /** AI 轨（scoreSource='ai' 时有值） */
  aiTotalScore: number | null
  aiScores: Record<string, unknown> | null
  aiSummary: string | null
  corrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null
  rewrites: Record<string, string> | null
  revision: number
}

// ---------------------------------------------------------------------------
// 解析助手（Json 字段一律不信任形状）
// ---------------------------------------------------------------------------

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** 字数要求：wordMin/wordMax 任一存在即生效 */
function requiredWordsOf(min: number | null, max: number | null): WritingRequiredWords {
  return { min: min ?? 0, max: max ?? 0 }
}

function wordCountOk(count: number, req: WritingRequiredWords): boolean {
  if (req.min <= 0 && req.max <= 0) return true
  if (req.min > 0 && count < req.min) return false
  if (req.max > 0 && count > req.max) return false
  return true
}

/** 解析规则检查结果（ruleCheckDetail 存的就是 RuleCheckResult 去掉 stats 的形状） */
function parseRuleDetail(value: unknown): { issues: RuleIssue[]; score: number } | null {
  if (value === null || typeof value !== 'object') return null
  const r = value as { score?: unknown; issues?: unknown }
  if (typeof r.score !== 'number' || !Array.isArray(r.issues)) return null
  const issues: RuleIssue[] = []
  for (const it of r.issues) {
    if (it === null || typeof it !== 'object') continue
    const q = it as { rule?: unknown; message?: unknown; deduction?: unknown; excerpt?: unknown }
    if (typeof q.rule !== 'string' || typeof q.message !== 'string' || typeof q.deduction !== 'number') continue
    issues.push({
      rule: q.rule as RuleIssue['rule'],
      message: q.message,
      deduction: q.deduction,
      excerpt: typeof q.excerpt === 'string' ? q.excerpt : undefined,
    })
  }
  return { score: r.score, issues }
}

/** AI 维度分对象（值必须是有限数字） */
function parseAiScores(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string' && v.trim().length > 0) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/** AI corrections：接受 corrections 或 sentences 数组；字段缺失回落占位 */
function parseCorrections(value: unknown): Array<{ original: string; issue: string; fixed: string; reason: string }> | null {
  const arr = Array.isArray(value) ? value : null
  if (arr === null) return null
  const out: Array<{ original: string; issue: string; fixed: string; reason: string }> = []
  for (const item of arr) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const original = typeof r.original === 'string' ? r.original : typeof r.sentence === 'string' ? r.sentence : ''
    const issue = typeof r.issue === 'string' ? r.issue : ''
    if (original.length === 0 && issue.length === 0) continue
    out.push({
      original,
      issue,
      fixed: typeof r.fixed === 'string' ? r.fixed : '',
      reason: typeof r.reason === 'string' ? r.reason : '',
    })
  }
  return out.length > 0 ? out : null
}

/** AI rewrites：接受 rewrites 对象或 modelEssay 字符串 */
function parseRewrites(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

// ---------------------------------------------------------------------------
// W1 · 任务列表
// ---------------------------------------------------------------------------

const TASK_LIST_SELECT = {
  id: true,
  title: true,
  taskType: true,
  difficulty: true,
  examType: true,
  prompt: true,
  wordMin: true,
  wordMax: true,
  tags: true,
} satisfies Prisma.WritingTaskSelect

export interface WritingTaskQuery {
  taskType?: string
  difficulty?: Difficulty
  examType?: ExamType
  page?: number
  pageSize?: number
}

export async function listWritingTasks(userId: string, query: WritingTaskQuery): Promise<WritingTaskListResult> {
  const where: Prisma.WritingTaskWhereInput = { status: 'PUBLISHED' }
  if (query.taskType) where.taskType = query.taskType
  if (query.difficulty) where.difficulty = query.difficulty
  if (query.examType) where.examType = query.examType

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total, myCounts] = await Promise.all([
    prisma.writingTask.findMany({
      where,
      select: TASK_LIST_SELECT,
      orderBy: [{ createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.writingTask.count({ where }),
    prisma.writingSubmission.groupBy({
      by: ['taskId'],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    }),
  ])

  const countByTask = new Map(myCounts.map((c) => [c.taskId, c._count._all]))

  const tasks: WritingTaskListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    taskType: row.taskType,
    difficulty: row.difficulty,
    examType: row.examType,
    prompt: row.prompt,
    wordMin: row.wordMin,
    wordMax: row.wordMax,
    tags: parseStringList(row.tags),
    mySubmissionCount: countByTask.get(row.id) ?? 0,
  }))

  return { tasks, total }
}

// ---------------------------------------------------------------------------
// W2 · 创建提交（同步规则检查）
// ---------------------------------------------------------------------------

export interface WritingCreateInput {
  taskId: string
  content: string
  title?: string
}

export async function createSubmission(userId: string, input: WritingCreateInput): Promise<WritingCreateResult> {
  const task = await prisma.writingTask.findFirst({
    where: { id: input.taskId, status: 'PUBLISHED' },
    select: { id: true, wordMin: true, wordMax: true, title: true },
  })
  if (!task) throw errNotFound('写作任务不存在')

  const content = input.content.trim()
  if (content.length === 0) throw new AppError('VALIDATION_ERROR', '作文内容不能为空')
  if (content.length > 20_000) throw new AppError('VALIDATION_ERROR', '作文内容过长（上限 20000 字符）')

  const knownWords = await loadDictionary()
  const ruleCheck = runRuleCheck(content, { knownWords })

  const row = await prisma.writingSubmission.create({
    data: {
      userId,
      taskId: task.id,
      title: input.title?.trim() || null,
      content,
      wordCount: ruleCheck.stats.wordCount,
      paragraphCount: ruleCheck.stats.paragraphCount,
      ruleCheck: ruleCheck as unknown as Prisma.InputJsonValue,
      ruleCheckScore: ruleCheck.score,
      ruleCheckDetail: { score: ruleCheck.score, issues: ruleCheck.issues } as unknown as Prisma.InputJsonValue,
      scoreSource: 'rule',
      requiredWords: requiredWordsOf(task.wordMin, task.wordMax) as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
    },
    select: { id: true },
  })

  const req = requiredWordsOf(task.wordMin, task.wordMax)
  log.info({ msg: 'writing submission created', userId, submissionId: row.id, ruleScore: ruleCheck.score })

  return {
    id: row.id,
    wordCount: ruleCheck.stats.wordCount,
    paragraphCount: ruleCheck.stats.paragraphCount,
    ruleCheck,
    ruleCheckScore: ruleCheck.score,
    requiredWords: req,
    wordCountOk: wordCountOk(ruleCheck.stats.wordCount, req),
  }
}

// ---------------------------------------------------------------------------
// 自动保存（验收 6：防抖 ≤3s，刷新不丢稿）
// ---------------------------------------------------------------------------

export interface WritingUpdateInput {
  content?: string
  title?: string
}

export async function updateSubmission(
  userId: string,
  submissionId: string,
  input: WritingUpdateInput,
): Promise<{ id: string; wordCount: number; ruleCheckScore: number | null; updatedAt: string }> {
  const row = await prisma.writingSubmission.findFirst({
    where: { id: submissionId, userId, deletedAt: null },
    select: { id: true, content: true, title: true },
  })
  if (!row) throw errNotFound('作文不存在')

  const content = input.content !== undefined ? input.content.trim() : row.content
  if (content.length === 0) throw new AppError('VALIDATION_ERROR', '作文内容不能为空')

  // 内容变了就重算规则检查（纯函数 + 词典缓存，开销可忽略）
  const knownWords = await loadDictionary()
  const ruleCheck = runRuleCheck(content, { knownWords })

  const updated = await prisma.writingSubmission.update({
    where: { id: submissionId },
    data: {
      content,
      title: input.title !== undefined ? input.title.trim() || null : row.title ?? null,
      wordCount: ruleCheck.stats.wordCount,
      paragraphCount: ruleCheck.stats.paragraphCount,
      ruleCheck: ruleCheck as unknown as Prisma.InputJsonValue,
      ruleCheckScore: ruleCheck.score,
      ruleCheckDetail: { score: ruleCheck.score, issues: ruleCheck.issues } as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, wordCount: true, ruleCheckScore: true, updatedAt: true },
  })

  return {
    id: updated.id,
    wordCount: updated.wordCount,
    ruleCheckScore: updated.ruleCheckScore,
    updatedAt: updated.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// W3 · 提交详情 / 列表
// ---------------------------------------------------------------------------

export async function getSubmissionDetail(userId: string, submissionId: string): Promise<WritingSubmissionDetail> {
  const row = await prisma.writingSubmission.findFirst({
    where: { id: submissionId, userId, deletedAt: null },
    select: {
      id: true,
      taskId: true,
      title: true,
      content: true,
      wordCount: true,
      paragraphCount: true,
      status: true,
      ruleCheck: true,
      ruleCheckScore: true,
      ruleCheckDetail: true,
      requiredWords: true,
      aiScores: true,
      aiTotalScore: true,
      aiCorrections: true,
      aiRewrites: true,
      aiSummary: true,
      scoreSource: true,
      aiDegraded: true,
      revision: true,
      submittedAt: true,
      scoredAt: true,
      task: { select: { title: true, prompt: true } },
    },
  })
  if (!row) throw errNotFound('作文不存在')

  const ruleCheck = row.ruleCheck !== null ? (row.ruleCheck as unknown as RuleCheckResult) : null
  const detail = parseRuleDetail(row.ruleCheckDetail)
  const reqRaw = (row.requiredWords ?? {}) as { min?: unknown; max?: unknown }
  const req = requiredWordsOf(
    typeof reqRaw.min === 'number' ? reqRaw.min : null,
    typeof reqRaw.max === 'number' ? reqRaw.max : null,
  )

  return {
    id: row.id,
    taskId: row.taskId,
    taskTitle: row.task.title,
    prompt: row.task.prompt,
    title: row.title,
    content: row.content,
    wordCount: row.wordCount,
    paragraphCount: row.paragraphCount,
    requiredWords: req,
    wordCountOk: wordCountOk(row.wordCount, req),
    ruleCheck: ruleCheck ?? (detail ? { score: detail.score, issues: detail.issues, stats: { wordCount: row.wordCount, sentenceCount: 0, paragraphCount: row.paragraphCount, longSentences: 0, passiveCount: 0, connectorCount: 0, spellingErrors: [] }, passed: detail.score >= 60 && detail.issues.every((i) => i.rule !== 'spelling') } : null),
    ruleCheckScore: row.ruleCheckScore ?? detail?.score ?? null,
    aiScores: parseAiScores(row.aiScores),
    aiTotalScore: row.aiTotalScore,
    aiCorrections: parseCorrections(row.aiCorrections),
    aiRewrites: parseRewrites(row.aiRewrites),
    aiSummary: row.aiSummary,
    scoreSource: row.scoreSource,
    aiDegraded: row.aiDegraded,
    revision: row.revision,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    scoredAt: row.scoredAt?.toISOString() ?? null,
  }
}

export async function listSubmissions(
  userId: string,
  query: { taskId?: string; page?: number; pageSize?: number } = {},
): Promise<WritingSubmissionListResult> {
  const where: Prisma.WritingSubmissionWhereInput = { userId, deletedAt: null }
  if (query.taskId) where.taskId = query.taskId

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total] = await Promise.all([
    prisma.writingSubmission.findMany({
      where,
      select: {
        id: true,
        taskId: true,
        title: true,
        wordCount: true,
        status: true,
        ruleCheckScore: true,
        scoreSource: true,
        aiTotalScore: true,
        updatedAt: true,
        task: { select: { title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.writingSubmission.count({ where }),
  ])

  return {
    submissions: rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.task.title,
      title: row.title,
      wordCount: row.wordCount,
      status: row.status,
      ruleCheckScore: row.ruleCheckScore,
      scoreSource: row.scoreSource,
      aiTotalScore: row.aiTotalScore,
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  }
}

// ---------------------------------------------------------------------------
// W4 · AI 批改（降级回落规则轨）
// ---------------------------------------------------------------------------

export async function analyzeSubmission(userId: string, submissionId: string): Promise<WritingAnalyzeResult> {
  const row = await prisma.writingSubmission.findFirst({
    where: { id: submissionId, userId, deletedAt: null },
    select: {
      id: true,
      content: true,
      wordCount: true,
      ruleCheckScore: true,
      revision: true,
      task: { select: { title: true, taskType: true, wordMin: true, wordMax: true } },
    },
  })
  if (!row) throw errNotFound('作文不存在')

  let scoreSource: 'rule' | 'ai' = 'rule'
  let aiDegraded = true
  let aiScores: Record<string, unknown> | null = null
  let aiTotalScore: number | null = null
  let aiCorrections: Array<{ original: string; issue: string; fixed: string; reason: string }> | null = null
  let aiRewrites: Record<string, string> | null = null
  let aiSummary: string | null = null

  try {
    const res = await aiService.analyzeWriting(
      {
        taskType: row.task.taskType,
        taskTitle: row.task.title,
        wordMin: row.task.wordMin,
        wordMax: row.task.wordMax,
        content: row.content,
        wordCount: row.wordCount,
        ruleScore: row.ruleCheckScore,
      },
      { userId, traceId: `writing-${submissionId}`, locale: 'zh-CN' },
    )

    // ⚠️ degraded=true 时 data 是零分兜底对象，绝不能当真实 AI 分写库
    if (!res.degraded && res.data !== null && typeof res.data === 'object') {
      const d = res.data as Record<string, unknown>
      const dims = parseAiScores(d.dimensions)
      const total = typeof d.totalScore === 'number' && Number.isFinite(d.totalScore) ? d.totalScore : null
      aiSummary = typeof d.overallComment === 'string' && d.overallComment.trim().length > 0 ? d.overallComment : null
      aiCorrections = parseCorrections(d.corrections ?? d.sentences)
      aiRewrites = parseRewrites(d.rewrites ?? (d.modelEssay !== undefined ? { modelEssay: String(d.modelEssay) } : undefined))
      // 只有拿到「非零总分」或「至少一个非零维度分」才认定 AI 成功
      // （R2-10 防御加固：dims 全 0 也不算成功——防止上游把 0 分塞进非降级路径）
      if ((total !== null && total > 0) || (dims !== null && Object.values(dims).some((v) => typeof v === 'number' && v > 0))) {
        aiDegraded = false
        scoreSource = 'ai'
        aiTotalScore = total
        // 维度分优先；只有总分没有维度时也保留总分（前端按存在的字段渲染）
        aiScores = dims ?? (total !== null ? { total } : null)
      }
    }
  } catch (error) {
    log.warn({ msg: 'writing analyze failed (fallback to rule)', userId, submissionId, error: String(error) })
  }

  const revision = row.revision + 1

  await prisma.writingSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'SCORED',
      submittedAt: row.revision === 0 ? new Date() : undefined,
      scoredAt: new Date(),
      // 双轨都落库：AI 轨有值就写，没有就清空（保持与 scoreSource 一致）
      aiScores: (aiScores ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      aiTotalScore,
      aiCorrections: (aiCorrections ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      aiRewrites: (aiRewrites ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      aiSummary,
      aiDegraded,
      scoreSource,
      revision,
    },
    select: { id: true },
  })

  log.info({ msg: 'writing analyze done', userId, submissionId, scoreSource, revision })

  return {
    id: submissionId,
    scoreSource,
    aiDegraded,
    ruleCheckScore: row.ruleCheckScore ?? 0,
    aiTotalScore,
    revision,
    aiSummary,
  }
}

// ---------------------------------------------------------------------------
// W5 · 报告
// ---------------------------------------------------------------------------

export async function getWritingReport(userId: string, submissionId: string): Promise<WritingReport> {
  const detail = await getSubmissionDetail(userId, submissionId)
  const ruleScore = detail.ruleCheckScore ?? 100

  return {
    submissionId: detail.id,
    taskId: detail.taskId,
    taskTitle: detail.taskTitle,
    prompt: detail.prompt,
    title: detail.title,
    wordCount: detail.wordCount,
    paragraphCount: detail.paragraphCount,
    requiredWords: detail.requiredWords,
    wordCountOk: detail.wordCountOk,
    // AI 轨有效 → ai；否则永远回落 rule（页面不空白的保障）
    scoreSource: detail.scoreSource === 'ai' && detail.aiTotalScore !== null ? 'ai' : 'rule',
    aiDegraded: detail.aiDegraded,
    ruleScore,
    ruleIssues: detail.ruleCheck?.issues ?? [],
    aiTotalScore: detail.scoreSource === 'ai' ? detail.aiTotalScore : null,
    aiScores: detail.scoreSource === 'ai' ? detail.aiScores : null,
    aiSummary: detail.scoreSource === 'ai' ? detail.aiSummary : null,
    corrections: detail.scoreSource === 'ai' ? detail.aiCorrections : null,
    rewrites: detail.scoreSource === 'ai' ? detail.aiRewrites : null,
    revision: detail.revision,
  }
}
