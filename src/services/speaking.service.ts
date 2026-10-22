/**
 * 口语模块服务（架构 §3.1 S1-S7 / Phase 2 设计 T19）。
 *
 * 关键决策：
 *   - **双轨评分与写作同构**：结束时先算 S6 规则评分（纯函数，真实数字），
 *     再尝试 AI（SPEAKING_SCORE）——degraded 时 scoreSource 保持 'rule'；
 *     **报告不展示"发音"维度**（Web Speech API 无音素数据，架构师裁决宁缺毋假）；
 *   - **对话走 TUTOR_CHAT 流式**：persona/setting 拼入输入，用户消息与 AI 回复
 *     都落 `speaking_messages`；浏览器不支持 SpeechRecognition 时前端降级
 *     文本输入（`wasTextInput=true`），评分链路不变（验收 5）；
 *   - **回执幂等**：end 幂等（已结束直接返回现态），不会重复计分。
 */
import { prisma } from '@/lib/db'
import { AppError, errNotFound } from '@/lib/api/errors'
import { createLogger } from '@/lib/logger/logger'
import { Prisma } from '@prisma/client'

import { aiService } from './ai/ai.service'
import { ruleScore, type RuleScoreOutput } from './speaking/rule-score'

const log = createLogger('speaking.service')

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface SpeakingCatalogItem {
  roleKey: string
  name: string
  description: string | null
  difficulty: string
}

export interface SpeakingCatalog {
  roles: SpeakingCatalogItem[]
  scenes: Array<{ sceneKey: string; name: string; description: string | null; difficulty: string; targetWords: string[] }>
}

export interface SpeakingSessionCreated {
  id: string
  roleKey: string
  sceneKey: string
  roleName: string
  sceneName: string
  /** 欢迎语（首条 AI 消息，落库 speaker=AI） */
  greeting: string
}

export interface SpeakingMessageItem {
  id: string
  speaker: string
  textContent: string | null
  createdAt: string
}

/** S6 规则评分（无 AI） */
export type SpeakingRuleScoreResult = RuleScoreOutput & { source: 'rule' }

export interface SpeakingSessionReport {
  id: string
  roleKey: string
  roleName: string
  sceneKey: string
  sceneName: string
  status: string
  durationSec: number
  messageCount: number
  /** rule = 规则评分（Mock 阶段恒定）；ai = AI 评分 */
  scoreSource: string
  /** 4 维文本级评分（**无发音维度**——Web Speech API 无音素数据，宁缺毋假） */
  scores: { grammar: number; vocabulary: number; fluency: number; naturalness: number; total: number } | null
  /** S6 真实统计（wpm/填充词/句长/覆盖度 + score） */
  ruleStats: RuleScoreOutput | null
  aiSummary: string | null
  aiCorrections: Array<{ sentence: string; correct: string; moreNatural: string | null }> | null
  wasTextInput: boolean
  messages: SpeakingMessageItem[]
}

// ---------------------------------------------------------------------------
// S1 · 目录
// ---------------------------------------------------------------------------

export async function getCatalog(): Promise<SpeakingCatalog> {
  const [roles, scenes] = await Promise.all([
    prisma.speakingRole.findMany({
      where: { status: 'PUBLISHED' },
      select: { roleKey: true, name: true, description: true, difficulty: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.speakingScene.findMany({
      where: { status: 'PUBLISHED' },
      select: { sceneKey: true, name: true, description: true, difficulty: true, targetWords: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return {
    roles: roles.map((r) => ({ ...r, difficulty: String(r.difficulty) })),
    scenes: scenes.map((s) => ({
      sceneKey: s.sceneKey,
      name: s.name,
      description: s.description,
      difficulty: String(s.difficulty),
      targetWords: Array.isArray(s.targetWords) ? (s.targetWords as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    })),
  }
}

// ---------------------------------------------------------------------------
// S2 · 创建会话（含欢迎语）
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  roleKey: string
  sceneKey: string
  mode?: string
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<SpeakingSessionCreated> {
  const [role, scene] = await Promise.all([
    prisma.speakingRole.findFirst({ where: { roleKey: input.roleKey, status: 'PUBLISHED' }, select: { roleKey: true, name: true, persona: true } }),
    prisma.speakingScene.findFirst({ where: { sceneKey: input.sceneKey, status: 'PUBLISHED' }, select: { sceneKey: true, name: true, setting: true } }),
  ])
  if (role === null || scene === null) throw errNotFound('口语角色或场景不存在')

  const session = await prisma.speakingSession.create({
    data: { userId, roleKey: role.roleKey, sceneKey: scene.sceneKey, mode: input.mode ?? 'partner', status: 'ACTIVE' },
    select: { id: true },
  })

  // 欢迎语：固定引导（Mock/无 AI 时对话也有开场白，验收 4 全程可用）
  const greeting = `Hi! I'm your ${role.name} (${scene.name}). Let's practice — say anything to start!`

  await prisma.speakingMessage.create({
    data: { sessionId: session.id, speaker: 'AI', textContent: greeting },
  })
  await prisma.speakingSession.update({ where: { id: session.id }, data: { messageCount: { increment: 1 } } })

  return { id: session.id, roleKey: role.roleKey, sceneKey: scene.sceneKey, roleName: role.name, sceneName: scene.name, greeting }
}

// ---------------------------------------------------------------------------
// S3 · 发消息（AI 流式回复由路由层消费 stream 后整条落库）
// ---------------------------------------------------------------------------

export interface SpeakingMessageInput {
  text: string
  /** 浏览器不支持 SpeechRecognition 时的文本降级标记（验收 5） */
  wasTextInput?: boolean
  durationMs?: number
  sttConfidence?: number
  sttProvider?: string
}

/** 会话归属校验 + 取 persona/setting 上下文（路由层拼 AI 输入用） */
export async function getSessionContext(userId: string, sessionId: string) {
  const session = await prisma.speakingSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      status: true,
      roleKey: true,
      sceneKey: true,
      wasTextInput: true,
    },
  })
  if (session === null) throw errNotFound('口语会话不存在')
  if (session.status !== 'ACTIVE') throw new AppError('VALIDATION_ERROR', '会话已结束，不能再发送消息')

  const [role, scene] = await Promise.all([
    prisma.speakingRole.findUnique({ where: { roleKey: session.roleKey }, select: { name: true, persona: true } }),
    prisma.speakingScene.findUnique({ where: { sceneKey: session.sceneKey }, select: { name: true, setting: true, targetWords: true } }),
  ])

  return { session, role, scene }
}

/** 落用户消息（+wasTextInput 降级标记） */
export async function saveUserMessage(sessionId: string, input: SpeakingMessageInput): Promise<SpeakingMessageItem> {
  const text = input.text.trim()
  if (text.length === 0) throw new AppError('VALIDATION_ERROR', '消息不能为空')
  if (text.length > 2000) throw new AppError('VALIDATION_ERROR', '消息过长（上限 2000 字符）')

  const msg = await prisma.speakingMessage.create({
    data: {
      sessionId,
      speaker: 'USER',
      textContent: text,
      durationMs: input.durationMs ?? 0,
      sttConfidence: input.sttConfidence,
    },
  })
  await prisma.speakingSession.update({
    where: { id: sessionId },
    data: {
      messageCount: { increment: 1 },
      // 文本降级标记一旦出现即为 true（验收 5）
      wasTextInput: input.wasTextInput === true || undefined,
      sttProvider: input.sttProvider ?? undefined,
    },
  })
  return { id: msg.id, speaker: 'USER', textContent: msg.textContent, createdAt: msg.createdAt.toISOString() }
}

/** 落 AI 回复（流式聚合完成后调用） */
export async function saveAiMessage(sessionId: string, text: string, meta: { tokensUsed: number; latencyMs: number; model: string }): Promise<SpeakingMessageItem> {
  const msg = await prisma.speakingMessage.create({
    data: { sessionId, speaker: 'AI', textContent: text, tokensUsed: meta.tokensUsed, latencyMs: meta.latencyMs, model: meta.model },
  })
  await prisma.speakingSession.update({ where: { id: sessionId }, data: { messageCount: { increment: 1 } } })
  return { id: msg.id, speaker: 'AI', textContent: msg.textContent, createdAt: msg.createdAt.toISOString() }
}

export async function listMessages(userId: string, sessionId: string): Promise<SpeakingMessageItem[]> {
  const session = await prisma.speakingSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } })
  if (session === null) throw errNotFound('口语会话不存在')
  const rows = await prisma.speakingMessage.findMany({
    where: { sessionId },
    select: { id: true, speaker: true, textContent: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({ id: r.id, speaker: String(r.speaker), textContent: r.textContent, createdAt: r.createdAt.toISOString() }))
}

// ---------------------------------------------------------------------------
// S4 · 结束会话（幂等）：S6 规则评分 + AI 尝试（降级保持 rule）
// ---------------------------------------------------------------------------

export interface EndSessionResult {
  id: string
  status: string
  durationSec: number
  scoreSource: string
  ruleStats: RuleScoreOutput
  aiDegraded: boolean
}

export async function endSession(
  userId: string,
  sessionId: string,
  input: { durationSec?: number; pauseCount?: number } = {},
): Promise<EndSessionResult> {
  const session = await prisma.speakingSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true, startedAt: true, endedAt: true, durationSec: true, roleKey: true, sceneKey: true, ruleStats: true, scoreSource: true },
  })
  if (session === null) throw errNotFound('口语会话不存在')

  // 幂等：已结束直接返回现态（不重复计分）
  if (session.status !== 'ACTIVE') {
    return {
      id: session.id,
      status: session.status,
      durationSec: session.durationSec,
      scoreSource: session.scoreSource,
      ruleStats: session.ruleStats as unknown as RuleScoreOutput,
      aiDegraded: true,
    }
  }

  // 拼接完整转写（仅用户发言——评分对象是用户的口语）
  const userMessages = await prisma.speakingMessage.findMany({
    where: { sessionId, speaker: 'USER' },
    select: { textContent: true },
    orderBy: { createdAt: 'asc' },
  })
  const transcript = userMessages.map((m) => m.textContent ?? '').filter(Boolean).join(' ')

  const scene = await prisma.speakingScene.findUnique({ where: { sceneKey: session.sceneKey }, select: { targetWords: true } })
  const targetWords = Array.isArray(scene?.targetWords)
    ? (scene.targetWords as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined

  // 实际时长：前端报值优先，否则按起止时间推算
  const durationSec = input.durationSec !== undefined && input.durationSec > 0
    ? Math.round(input.durationSec)
    : Math.max(1, Math.round((Date.now() - session.startedAt.getTime()) / 1000))

  // ---- S6 规则评分（真实计算，恒定执行）----
  const ruleStats = ruleScore({ transcript, durationSec, pauseCount: input.pauseCount, targetWords })

  // ---- AI 尝试（Mock/降级 → 保持 rule）----
  let scoreSource = 'rule'
  let aiDegraded = true
  let aiScores: Record<string, unknown> | null = null
  let aiTotalScore: number | null = null
  let aiSummary: string | null = null
  const aiCorrections: Array<{ sentence: string; correct: string; moreNatural: string | null }> | null = null

  if (transcript.trim().length > 0) {
    try {
      const res = await aiService.analyzeSpeaking(
        { transcript, durationSec, roleKey: session.roleKey, sceneKey: session.sceneKey, ruleStats },
        { userId, traceId: `speaking-${sessionId}`, locale: 'zh-CN' },
      )
      if (!res.degraded && res.data !== null && typeof res.data === 'object') {
        const d = res.data as Record<string, unknown>
        const total = typeof d.total === 'number' && Number.isFinite(d.total) && d.total > 0 ? d.total : null
        if (total !== null) {
          aiDegraded = false
          scoreSource = 'ai'
          aiTotalScore = total
          aiScores = d
          aiSummary = typeof d.summary === 'string' ? d.summary : null
        }
      }
    } catch (error) {
      log.warn({ msg: 'speaking AI score failed (fallback to rule)', userId, sessionId, error: String(error) })
    }
  }

  await prisma.speakingSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      durationSec,
      fullTranscript: transcript,
      ruleStats: ruleStats as unknown as Prisma.InputJsonValue,
      scoreSource,
      aiScores: (aiScores ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      aiTotalScore,
      aiSummary,
      aiCorrections: (aiCorrections ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      aiDegraded,
    },
    select: { id: true },
  })

  log.info({ msg: 'speaking session ended', userId, sessionId, scoreSource, ruleScore: ruleStats.score })

  return { id: sessionId, status: 'COMPLETED', durationSec, scoreSource, ruleStats, aiDegraded }
}

// ---------------------------------------------------------------------------
// S5 · 报告
// ---------------------------------------------------------------------------

/** 4 维文本级评分派生（rule 轨：由 S6 统计派生，无 AI 时也有真实数字） */
function deriveScores(ruleStats: RuleScoreOutput): { grammar: number; vocabulary: number; fluency: number; naturalness: number; total: number } {
  const fluency = Math.max(0, Math.min(100, ruleStats.score))
  const naturalness = Math.max(0, 100 - ruleStats.fillerCount * 12)
  // 句长适中 → 语法组织代理分；覆盖度 → 词汇代理分
  const grammar = Math.round(ruleStats.score * 0.6 + ruleStats.coverage * 100 * 0.4)
  const vocabulary = Math.round(ruleStats.coverage * 100 * 0.6 + fluency * 0.4)
  const total = Math.round(grammar * 0.25 + vocabulary * 0.25 + fluency * 0.3 + naturalness * 0.2)
  return { grammar, vocabulary, fluency, naturalness, total }
}

export async function getReport(userId: string, sessionId: string): Promise<SpeakingSessionReport> {
  const session = await prisma.speakingSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      roleKey: true,
      sceneKey: true,
      status: true,
      durationSec: true,
      messageCount: true,
      scoreSource: true,
      ruleStats: true,
      aiScores: true,
      aiTotalScore: true,
      aiSummary: true,
      aiCorrections: true,
      wasTextInput: true,
    },
  })
  if (session === null) throw errNotFound('口语会话不存在')

  const [role, messages] = await Promise.all([
    prisma.speakingRole.findUnique({ where: { roleKey: session.roleKey }, select: { name: true } }),
    prisma.speakingMessage.findMany({
      where: { sessionId },
      select: { id: true, speaker: true, textContent: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const scene = await prisma.speakingScene.findUnique({ where: { sceneKey: session.sceneKey }, select: { name: true } })

  const ruleStats = session.ruleStats as unknown as RuleScoreOutput | null
  // rule 轨：4 维派生分（grammar/vocabulary/fluency/naturalness）——**无 pronunciation**（宁缺毋假）
  const scores =
    session.scoreSource === 'ai' && session.aiTotalScore !== null
      ? null // AI 轨形状未验证，Mock 阶段恒 rule；AI 轨维度由 aiScores 透传
      : ruleStats !== null
        ? deriveScores(ruleStats)
        : null

  return {
    id: session.id,
    roleKey: session.roleKey,
    roleName: role?.name ?? session.roleKey,
    sceneKey: session.sceneKey,
    sceneName: scene?.name ?? session.sceneKey,
    status: session.status,
    durationSec: session.durationSec,
    messageCount: session.messageCount,
    scoreSource: session.scoreSource,
    scores: session.scoreSource === 'rule' ? scores : null,
    ruleStats,
    aiSummary: session.scoreSource === 'ai' ? session.aiSummary : null,
    aiCorrections: parseCorrections(session.aiCorrections),
    wasTextInput: session.wasTextInput,
    messages: messages.map((m) => ({ id: m.id, speaker: String(m.speaker), textContent: m.textContent, createdAt: m.createdAt.toISOString() })),
  }
}

function parseCorrections(value: unknown): Array<{ sentence: string; correct: string; moreNatural: string | null }> | null {
  if (value === null || !Array.isArray(value)) return null
  const out: Array<{ sentence: string; correct: string; moreNatural: string | null }> = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const sentence = typeof r.sentence === 'string' ? r.sentence : ''
    const correct = typeof r.correct === 'string' ? r.correct : ''
    if (sentence.length === 0 && correct.length === 0) continue
    out.push({ sentence, correct, moreNatural: typeof r.moreNatural === 'string' ? r.moreNatural : null })
  }
  return out.length > 0 ? out : null
}

// ---------------------------------------------------------------------------
// S6 · 纯规则评分端点（无 AI，验收 3）
// ---------------------------------------------------------------------------

export interface RuleScoreEndpointInput {
  transcript: string
  durationSec: number
  pauseCount?: number
  targetWords?: string[]
}

export async function computeRuleScoreEndpoint(userId: string, input: RuleScoreEndpointInput): Promise<SpeakingRuleScoreResult> {
  const text = input.transcript.trim()
  if (text.length === 0) throw new AppError('VALIDATION_ERROR', '转写文本不能为空')
  if (text.length > 20_000) throw new AppError('VALIDATION_ERROR', '转写文本过长')
  const stats = ruleScore({ transcript: text, durationSec: input.durationSec, pauseCount: input.pauseCount, targetWords: input.targetWords })
  log.debug({ msg: 'rule score computed', userId, score: stats.score })
  return { ...stats, source: 'rule' }
}

// ---------------------------------------------------------------------------
// S7 · 历史会话
// ---------------------------------------------------------------------------

export interface SpeakingSessionListItem {
  id: string
  roleKey: string
  sceneKey: string
  status: string
  durationSec: number
  messageCount: number
  scoreSource: string
  /** S6 规则分（列表预览） */
  ruleScore: number | null
  startedAt: string
}

export interface SpeakingSessionListResult {
  sessions: SpeakingSessionListItem[]
  total: number
  page: number
  pageSize: number
}

export async function listSessions(
  userId: string,
  query: { page?: number; pageSize?: number; sceneKey?: string } = {},
): Promise<SpeakingSessionListResult> {
  const where: Prisma.SpeakingSessionWhereInput = { userId }
  if (query.sceneKey !== undefined && query.sceneKey !== '') where.sceneKey = query.sceneKey

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 20)))

  const [rows, total] = await Promise.all([
    prisma.speakingSession.findMany({
      where,
      select: {
        id: true, roleKey: true, sceneKey: true, status: true, durationSec: true,
        messageCount: true, scoreSource: true, ruleStats: true, startedAt: true,
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.speakingSession.count({ where }),
  ])

  return {
    sessions: rows.map((row) => {
      const stats = row.ruleStats as unknown as RuleScoreOutput | null
      return {
        id: row.id,
        roleKey: row.roleKey,
        sceneKey: row.sceneKey,
        status: row.status,
        durationSec: row.durationSec,
        messageCount: row.messageCount,
        scoreSource: row.scoreSource,
        ruleScore: stats !== null && typeof stats.score === 'number' ? stats.score : null,
        startedAt: row.startedAt.toISOString(),
      }
    }),
    total,
    page,
    pageSize,
  }
}
