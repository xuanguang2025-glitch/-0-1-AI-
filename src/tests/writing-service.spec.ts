/**
 * writing-service.spec.ts — 写作服务层单测（T17，双轨评分）。
 *
 * 覆盖策略：mock Prisma + AI service，验证**编排与降级语义**：
 *   - W2 创建：同步规则检查落库（scoreSource='rule'）、词典缓存、脏输入 400
 *   - 自动保存：内容变更重算规则检查
 *   - W4 批改：**degraded=true 时绝不把零分兜底当 AI 分写库**（本服务最关键的坑）；
 *     AI 成功 → scoreSource='ai' + revision+1；AI 抛错回落 rule
 *   - W5 报告：AI 轨无效时永远回落 rule（页面不空白的保障）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const h = vi.hoisted(() => ({
  taskFirst: null as Record<string, unknown> | null,
  subFirst: null as Record<string, unknown> | null,
  vocabLemmas: [] as string[],
  created: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
  aiWriting: { degraded: true, data: null as unknown },
}))

vi.mock('@/lib/db', () => {
  const prisma = {
    writingTask: {
      findFirst: vi.fn(async () => h.taskFirst),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    writingSubmission: {
      findFirst: vi.fn(async () => h.subFirst),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.created.push(a.data)
        return { id: 'ws-1' }
      }),
      update: vi.fn(async (a: { where: unknown; data: Record<string, unknown> }) => {
        h.updated.push(a.data)
        // 返回值从入参推导（真实 Prisma 会返回更新后的行）
        return {
          id: 'ws-1',
          wordCount: (a.data.wordCount as number) ?? 0,
          ruleCheckScore: (a.data.ruleCheckScore as number) ?? null,
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }
      }),
      groupBy: vi.fn(async () => []),
    },
    vocabulary: {
      findMany: vi.fn(async () => h.vocabLemmas.map((l) => ({ lemma: l }))),
    },
  }
  return { prisma }
})

vi.mock('@/services/ai/ai.service', () => ({
  aiService: {
    analyzeWriting: vi.fn(async () => ({ data: h.aiWriting.data, degraded: h.aiWriting.degraded })),
  },
}))

import {
  analyzeSubmission,
  clearDictionaryCache,
  createSubmission,
  getWritingReport,
  updateSubmission,
} from '@/services/writing.service'

const TASK = {
  id: 'wt-1',
  title: 'My Writing Task',
  taskType: 'essay',
  wordMin: 120,
  wordMax: 200,
  status: 'PUBLISHED',
}

/** 干净长文（词典内词 + 2 个连接词 → 规则分高、无拼写） */
function cleanText(): string {
  const s1 = 'However, students study hard every day and the school work is good. Therefore, reading books helps a lot.'
  return Array.from({ length: 8 }, () => s1).join(' ')
}

const DICT_WORDS = [
  'however', 'students', 'study', 'hard', 'every', 'day', 'and', 'the', 'school', 'work', 'is', 'good',
  'therefore', 'reading', 'books', 'helps', 'a', 'lot', 'i', 'this', 'task', 'was', 'written', 'him',
  'write', 'more', 'short', 'still', 'enjoy', 'kind', 'teacher', 'my',
]

describe('W2 createSubmission — 同步规则检查', () => {
  beforeEach(() => {
    h.taskFirst = TASK
    h.created = []
    h.vocabLemmas = DICT_WORDS
    clearDictionaryCache()
  })

  it('保存即返回规则检查（scoreSource=rule），并落库 ruleCheck 字段', async () => {
    const r = await createSubmission('u1', { taskId: 'wt-1', content: cleanText() })
    expect(r.ruleCheckScore).toBeGreaterThan(80)
    expect(r.requiredWords).toEqual({ min: 120, max: 200 })
    expect(r.wordCountOk).toBe(true)
    const row = h.created[0]!
    expect(row.scoreSource).toBe('rule')
    expect(row.ruleCheckScore).toBeGreaterThan(80)
    expect(row.ruleCheck).toBeTruthy()
    expect(row.status).toBe('DRAFT')
  })

  it('拼写错误被词典检出（lovve 不在词典）', async () => {
    const r = await createSubmission('u1', { taskId: 'wt-1', content: 'I lovve this task. However, it is good. Therefore, I write more.' })
    expect(r.ruleCheck.stats.spellingErrors).toContain('lovve')
  })

  it('字数不达标 → wordCountOk=false（但不拒绝创建）', async () => {
    const r = await createSubmission('u1', { taskId: 'wt-1', content: 'However, this is short.' })
    expect(r.wordCount).toBeLessThan(120)
    expect(r.wordCountOk).toBe(false)
  })

  it('空内容 / 任务不存在 → 400 / 404', async () => {
    await expect(createSubmission('u1', { taskId: 'wt-1', content: '   ' })).rejects.toThrow(/不能为空/)
    h.taskFirst = null
    await expect(createSubmission('u1', { taskId: 'nope', content: 'Some text here.' })).rejects.toThrow(/写作任务不存在/)
  })
})

describe('自动保存 updateSubmission', () => {
  beforeEach(() => {
    h.subFirst = { id: 'ws-1', userId: 'u1', content: 'old', title: null, deletedAt: null }
    h.updated = []
    h.vocabLemmas = DICT_WORDS
    clearDictionaryCache()
  })

  it('内容变更即重算规则检查并落库', async () => {
    const r = await updateSubmission('u1', 'ws-1', { content: cleanText() })
    expect(r.wordCount).toBeGreaterThan(60) // cleanText 144 词
    expect(r.ruleCheckScore).toBeGreaterThan(80)
    const data = h.updated[0]!
    expect(data.ruleCheckScore).toBeGreaterThan(80)
  })

  it('作文不存在 → 404', async () => {
    h.subFirst = null
    await expect(updateSubmission('u1', 'nope', { content: 'x' })).rejects.toThrow(/作文不存在/)
  })
})

describe('W4 analyzeSubmission — 降级语义（核心）', () => {
  beforeEach(() => {
    h.subFirst = {
      id: 'ws-1',
      userId: 'u1',
      content: cleanText(),
      wordCount: 130,
      ruleCheckScore: 90,
      revision: 0,
      deletedAt: null,
      task: { title: 'My Writing Task', taskType: 'essay', wordMin: 120, wordMax: 200 },
    }
    h.updated = []
    h.aiWriting = { degraded: true, data: null }
  })

  it('**验收 4 核心**：Mock（degraded=true + 零分兜底）→ 绝不写 AI 分，scoreSource 保持 rule', async () => {
    // 模拟 gateway 降级：data 是零分兜底对象 —— 不判 degraded 会把 0 分当真实 AI 分
    h.aiWriting = {
      degraded: true,
      data: {
        totalScore: 0,
        dimensions: { content: 0, organisation: 0, language: 0, accuracy: 0 },
        overallComment: 'AI 批改暂时不可用',
        sentences: [],
      },
    }
    const r = await analyzeSubmission('u1', 'ws-1')
    expect(r.scoreSource).toBe('rule')
    expect(r.aiDegraded).toBe(true)
    expect(r.aiTotalScore).toBeNull()
    expect(r.aiSummary).toBeNull()
    const data = h.updated[0]!
    expect(data.scoreSource).toBe('rule')
    expect(data.aiDegraded).toBe(true)
    expect(data.aiTotalScore).toBeNull()
    // AI 字段清空 = 写 Prisma.DbNull（DB 语义上的 NULL）
    expect(data.aiScores).toBe(Prisma.DbNull)
    // revision 每次 +1（即使降级也记一次批改轮次）
    expect(data.revision).toBe(1)
  })

  it('AI 成功（degraded=false + 非零总分 + 维度分）→ scoreSource=ai 且落库', async () => {
    h.aiWriting = {
      degraded: false,
      data: {
        totalScore: 82,
        dimensions: { grammar: 80, vocabulary: 78, structure: 85, coherence: 82, content: 86, naturalness: 80 },
        overallComment: '整体结构清晰，注意连接词多样性。',
        corrections: [{ original: 'I lovve it.', issue: '拼写错误', fixed: 'I love it.', reason: '拼写' }],
        rewrites: { basic: 'Basic version.', advanced: 'Advanced version.' },
      },
    }
    const r = await analyzeSubmission('u1', 'ws-1')
    expect(r.scoreSource).toBe('ai')
    expect(r.aiDegraded).toBe(false)
    expect(r.aiTotalScore).toBe(82)
    expect(r.aiSummary).toContain('整体结构清晰')
    const data = h.updated[0]!
    expect(data.scoreSource).toBe('ai')
    expect(data.aiTotalScore).toBe(82)
    expect(data.aiCorrections).toBeTruthy()
    expect(data.aiRewrites).toBeTruthy()
  })

  it('**防御式解析**：非降级但只有 0 分（无维度）→ 仍回落 rule', async () => {
    // 防止上游某天把 0 分塞进非降级路径
    h.aiWriting = { degraded: false, data: { totalScore: 0, dimensions: {} } }
    const r = await analyzeSubmission('u1', 'ws-1')
    expect(r.scoreSource).toBe('rule')
    expect(r.aiTotalScore).toBeNull()
  })

  it('AI 抛错 → 捕获并回落 rule（不 500、作文不丢）', async () => {
    const { aiService } = await import('@/services/ai/ai.service')
    vi.mocked(aiService.analyzeWriting).mockRejectedValueOnce(new Error('boom') as never)
    const r = await analyzeSubmission('u1', 'ws-1')
    expect(r.scoreSource).toBe('rule')
    expect(r.aiDegraded).toBe(true)
    expect(r.ruleCheckScore).toBe(90) // 规则分原样保留
  })
})

describe('W5 getWritingReport — 回落保障', () => {
  /** 让 getSubmissionDetail 走真实实现：mock 其依赖即可（这里直接用 findFirst 返回 detail 所需行） */
  beforeEach(() => {
    h.vocabLemmas = DICT_WORDS
    clearDictionaryCache()
    h.subFirst = {
      id: 'ws-1',
      userId: 'u1',
      taskId: 'wt-1',
      title: null,
      content: cleanText(),
      wordCount: 130,
      paragraphCount: 1,
      status: 'SCORED',
      ruleCheck: { score: 90, issues: [], stats: { wordCount: 130, sentenceCount: 8, paragraphCount: 1, longSentences: 0, passiveCount: 0, connectorCount: 2, spellingErrors: [] }, passed: true },
      ruleCheckScore: 90,
      ruleCheckDetail: { score: 90, issues: [] },
      requiredWords: { min: 120, max: 200 },
      aiScores: null,
      aiTotalScore: null,
      aiCorrections: null,
      aiRewrites: null,
      aiSummary: null,
      scoreSource: 'rule',
      aiDegraded: true,
      revision: 1,
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      scoredAt: new Date('2026-01-01T00:01:00Z'),
      deletedAt: null,
      task: { title: 'My Writing Task', prompt: 'Write an essay.' },
    }
  })

  it('rule 轨：scoreSource=rule + 规则分 + 规则问题清单（页面不空白的保障）', async () => {
    const r = await getWritingReport('u1', 'ws-1')
    expect(r.scoreSource).toBe('rule')
    expect(r.ruleScore).toBe(90)
    expect(r.aiTotalScore).toBeNull()
    expect(r.corrections).toBeNull()
    expect(r.rewrites).toBeNull()
    expect(r.wordCountOk).toBe(true)
  })

  it('**回落保障**：scoreSource=ai 但 aiTotalScore=null（脏数据）→ 报告仍回落 rule', async () => {
    const row = h.subFirst as Record<string, unknown>
    row.scoreSource = 'ai'
    row.aiTotalScore = null
    const r = await getWritingReport('u1', 'ws-1')
    expect(r.scoreSource).toBe('rule')
    expect(r.ruleScore).toBe(90)
  })

  it('ai 轨完整 → scoreSource=ai + corrections/rewrites', async () => {
    const row = h.subFirst as Record<string, unknown>
    row.scoreSource = 'ai'
    row.aiTotalScore = 82
    row.aiScores = { grammar: 80, vocabulary: 78, structure: 85, coherence: 82, content: 86, naturalness: 80 }
    row.aiCorrections = [{ original: 'I lovve it.', issue: '拼写错误', fixed: 'I love it.', reason: '拼写' }]
    row.aiRewrites = { basic: 'Basic.', advanced: 'Advanced.' }
    row.aiSummary = '总体不错。'
    const r = await getWritingReport('u1', 'ws-1')
    expect(r.scoreSource).toBe('ai')
    expect(r.aiTotalScore).toBe(82)
    expect(r.corrections).toHaveLength(1)
    expect(Object.keys(r.rewrites ?? {})).toEqual(['basic', 'advanced'])
  })

  it('作文不存在 → 404', async () => {
    h.subFirst = null
    await expect(getWritingReport('u1', 'nope')).rejects.toThrow(/作文不存在/)
  })
})

// ---------------------------------------------------------------------------
// R2-10 防回归：Mock 对 WRITING_REVIEW（评价型能力）不得返回可校验 WritingReport
// 架构 §5.7：评价型能力打恒定分（如固定 9 分）是非偶然反馈，比没有反馈更有害。
// mock.ts 的「作文批改」罐头分支已删除；若将来有人加回来，本用例会失败。
// ---------------------------------------------------------------------------
describe('R2-10 防回归：mock 不给评价型能力罐头分', () => {
  it('mock provider 对 WRITING_REVIEW 不返回可校验 WritingReport（走 buildFallback 降级）', async () => {
    // 直连 mock provider（不经 gateway 的 config/计费），验证 cannedJsonForCapability 行为
    const { MockProvider } = await import('@/services/ai/providers/mock')
    const provider = new MockProvider()
    const chunks: Array<{ text: string }> = []
    const iterable = provider.complete({
      messages: [
        { role: 'system', content: '你是 EnglishAI 的「作文批改」引擎，按 CET-4/CET-6 评分标准批改。' },
        { role: 'user', content: 'Some essay text.' },
      ],
      model: 'mock',
      temperature: 0.7,
      maxTokens: 512,
      stream: false,
      jsonMode: true,
      timeoutMs: 10_000,
      firstTokenTimeoutMs: 10_000,
    })
    for await (const chunk of iterable) chunks.push(chunk)
    const raw = chunks.map((c) => c.text).join('')
    const parsed: unknown = JSON.parse(raw)

    // 罐头分支若被加回来，这里会拿到 {totalScore:9, dimensions:{...}} → 本断言失败
    const d = parsed as Record<string, unknown>
    const hasTotalScore = typeof d.totalScore === 'number'
    const hasNonZeroScore =
      (hasTotalScore && (d.totalScore as number) > 0) ||
      (typeof d.dimensions === 'object' &&
        d.dimensions !== null &&
        Object.values(d.dimensions as Record<string, unknown>).some((v) => typeof v === 'number' && v > 0))
    expect(hasNonZeroScore).toBe(false)
  })
})
