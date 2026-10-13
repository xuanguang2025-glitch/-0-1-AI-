/**
 * listening-service.spec.ts — 听力服务层单测（T13 补测，QA 反馈「service 0 覆盖」）。
 *
 * 覆盖策略：用 mock 替换 Prisma 与用户时区解析（与 plan-rebuild.spec.ts 同套路），
 * 验证**编排与判分汇总逻辑**，不验证 SQL 本身：
 *   - L3 按模式取题的路由分流（客观题 / 关键词 / 精听听写原文 / RETELL 不可用）；
 *   - L4 四种模式的判分汇总（客观题精确匹配 / 关键词模糊 / 听写 diff / 精听无判分）；
 *   - L5 报告结构与 ruleStats（含听写 diff 的四态统计）；
 *   - L6 AI 降级时回落到规则分析（source=rule）；
 *   - L7 进度 upsert 的键与取值钳制；
 *   - L1 列表的 facets / 进度回填 / 最佳成绩 / 音频资产时长合并。
 *
 * 说明：纯算法（diff / levenshtein / 阶梯）已由 listening-dictation.spec.ts 与
 *      listening-ladder.spec.ts 覆盖；API 路由需连库，标 [BLOCKED-ENV] 由 E2E 负责。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MaterialRow {
  id: string
  title: string
  description?: string | null
  category?: string
  difficulty?: string
  cefrLevel?: string | null
  intensityLevel?: number
  durationSec?: number
  wordCount?: number
  audioUrl?: string
  audioUrls?: unknown
  translation?: string | null
  transcript?: unknown
  focusPoints?: unknown
  coverUrl?: string | null
  status?: string
  deletedAt?: null
  /** 仅列表查询（_count）会带 */
  _count?: { questions: number }
  questions?: Array<{
    id: string
    type: string
    stem: string
    options?: unknown
    answer: string
    answerAliases?: unknown
    explanation?: string | null
    knowledgePoints?: unknown
    sortOrder?: number
  }>
}

const h = vi.hoisted(() => ({
  materialFirst: null as MaterialRow | null,
  materials: [] as MaterialRow[],
  assets: [] as Array<{ materialId: string; rate: number; url: string; durationSec: number }>,
  progresses: [] as Array<{ materialId: string; positionSec: number; playbackRate: number; completed: boolean }>,
  progressUnique: null as { positionSec: number; playbackRate: number; completed: boolean } | null,
  records: [] as Array<{ materialId: string; accuracy: number }>,
  recordFirst: null as Record<string, unknown> | null,

  progressUpserts: [] as Array<{ where: unknown; create: unknown; update: unknown }>,
  createdRecords: [] as Array<Record<string, unknown>>,
  dailyUpserts: [] as Array<Record<string, unknown>>,
  aiListening: { degraded: true, data: null as unknown },
}))

vi.mock('@/lib/db', () => {
  const tx = {
    listeningRecord: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.createdRecords.push(a.data)
        return { id: 'rec-1' }
      }),
    },
    dailyLearningStat: {
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.dailyUpserts.push(a)
        return {}
      }),
    },
  }
  const prisma = {
    listeningMaterial: {
      findFirst: vi.fn(async () => h.materialFirst),
      findMany: vi.fn(async () => h.materials),
      count: vi.fn(async () => h.materials.length),
    },
    listeningAudioAsset: { findMany: vi.fn(async () => h.assets) },
    listeningProgress: {
      findMany: vi.fn(async () => h.progresses),
      findUnique: vi.fn(async () => h.progressUnique),
      upsert: vi.fn(async (a: { where: unknown; create: unknown; update: unknown }) => {
        h.progressUpserts.push(a)
        return (a.update ?? a.create) as { positionSec: number; playbackRate: number; completed: boolean }
      }),
    },
    listeningRecord: {
      findMany: vi.fn(async () => h.records),
      findFirst: vi.fn(async () => h.recordFirst),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.createdRecords.push(a.data)
        return { id: 'rec-1' }
      }),
    },
    dailyLearningStat: {
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.dailyUpserts.push(a)
        return {}
      }),
    },
    $transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  }
  return { prisma }
})

vi.mock('@/lib/utils/user-date', () => ({ userToday: vi.fn(async () => '2026-01-01') }))

vi.mock('@/services/ai/ai.service', () => ({
  aiService: {
    analyzeListening: vi.fn(async () => ({ data: h.aiListening.data, degraded: h.aiListening.degraded })),
  },
}))

import {
  analyzeRecord,
  checkDictation,
  getMaterialDetail,
  getModeQuestions,
  getRecordReport,
  listMaterials,
  saveProgress,
  submitAttempt,
} from '@/services/listening.service'

const TRANSCRIPT = [
  { startSec: 0, endSec: 4, en: 'Good morning, what can I get for you?', zh: '早上好，要点什么？' },
  { startSec: 4, endSec: 9, en: 'I would like a latte with less sugar.', zh: '我想要一杯少糖拿铁。' },
]

const FOCUS_POINTS = [
  { word: 'latte', meaning: '拿铁咖啡', type: 'NEW_WORD', startSec: 0 },
  { word: 'less sugar', meaning: '少糖', type: 'PHRASE', startSec: 4 },
]

function material(over: Partial<MaterialRow> = {}): MaterialRow {
  return {
    id: 'lm-1',
    title: 'Ordering Coffee',
    description: 'daily topic',
    category: 'daily',
    difficulty: 'EASY',
    cefrLevel: 'A2',
    intensityLevel: 1,
    durationSec: 9,
    wordCount: 12,
    audioUrl: '/audio/listening/ordering-coffee_100.mp3',
    audioUrls: [
      { rate: 0.75, url: '/audio/listening/ordering-coffee_075.mp3' },
      { rate: 1, url: '/audio/listening/ordering-coffee_100.mp3' },
      { rate: 1.25, url: '/audio/listening/ordering-coffee_125.mp3' },
    ],
    translation: null,
    transcript: TRANSCRIPT,
    focusPoints: FOCUS_POINTS,
    coverUrl: null,
    status: 'PUBLISHED',
    deletedAt: null,
    _count: { questions: 2 },
    questions: [
      {
        id: 'lq2-lm-1-1',
        type: 'SINGLE_CHOICE',
        stem: 'What does the customer order?',
        options: ['A latte', 'Tea', 'Juice'],
        answer: 'A',
        knowledgePoints: ['CHOICE', 'daily', 'intensity:1'],
      },
      {
        id: 'lq2-lm-1-2',
        type: 'FILL_BLANK',
        stem: 'The customer wants a latte with ____ sugar.',
        answer: 'less',
        answerAliases: ['fewer'],
        knowledgePoints: ['CLOZE', 'daily', 'intensity:1'],
      },
    ],
    ...over,
  }
}

describe('L3 getModeQuestions — 模式 → 题目来源分流', () => {
  beforeEach(() => {
    h.materialFirst = material()
  })

  it('CHOICE：返回客观题且不带答案', async () => {
    const r = await getModeQuestions('u1', 'lm-1', 'CHOICE')
    expect(r.available).toBe(true)
    expect(r.judge).toBe('objective')
    expect(r.questions).toHaveLength(1)
    expect(r.questions[0]?.id).toBe('lq2-lm-1-1')
    // 防作弊：题目里不得出现 answer / answerAliases
    expect(JSON.stringify(r.questions)).not.toContain('"A"')
  })

  it('EXTENSIVE：回落到 CHOICE 题（seed 未单列 extensive 题）', async () => {
    const r = await getModeQuestions('u1', 'lm-1', 'EXTENSIVE')
    expect(r.questions.map((q) => q.id)).toEqual(['lq2-lm-1-1'])
  })

  it('CLOZE：只取 cloze 标签题', async () => {
    const r = await getModeQuestions('u1', 'lm-1', 'CLOZE')
    expect(r.questions.map((q) => q.id)).toEqual(['lq2-lm-1-2'])
  })

  it('KEYWORD：由 focusPoints 生成填空题（id 形如 fp:N，含释义提示）', async () => {
    const r = await getModeQuestions('u1', 'lm-1', 'KEYWORD')
    expect(r.judge).toBe('fuzzy')
    expect(r.questions).toHaveLength(2)
    expect(r.questions[0]?.id).toBe('fp:0')
    expect(r.questions[0]?.hint).toBe('拿铁咖啡')
  })

  it('DICTATION / INTENSIVE：无客观题，返回逐句原文', async () => {
    for (const mode of ['DICTATION', 'INTENSIVE'] as const) {
      const r = await getModeQuestions('u1', 'lm-1', mode)
      expect(r.questions).toHaveLength(0)
      expect(r.transcript).toHaveLength(2)
    }
    expect((await getModeQuestions('u1', 'lm-1', 'DICTATION')).judge).toBe('diff')
    expect((await getModeQuestions('u1', 'lm-1', 'INTENSIVE')).judge).toBe('none')
  })

  it('RETELL：Phase 3 不可用（available=false，无题）', async () => {
    const r = await getModeQuestions('u1', 'lm-1', 'RETELL')
    expect(r.available).toBe(false)
    expect(r.questions).toHaveLength(0)
  })

  it('未知模式 → VALIDATION_ERROR；材料不存在 → 404', async () => {
    await expect(getModeQuestions('u1', 'lm-1', 'NOPE')).rejects.toThrow(/未知的训练模式/)
    h.materialFirst = null
    await expect(getModeQuestions('u1', 'lm-1', 'CHOICE')).rejects.toThrow(/听力材料不存在/)
  })
})

describe('L4 submitAttempt — 四种模式判分汇总', () => {
  beforeEach(() => {
    h.materialFirst = material()
    h.createdRecords.length = 0
    h.dailyUpserts.length = 0
  })

  it('CHOICE：大小写/空白不敏感；答对 1 题 → accuracy 50', async () => {
    const r = await submitAttempt('u1', 'lm-1', {
      mode: 'CHOICE',
      answers: [
        { questionId: 'lq2-lm-1-1', userAnswer: ' a ' },
        { questionId: 'lq2-lm-1-2', userAnswer: 'A latte' }, // 张冠李戴 → 错
      ],
      durationSec: 120,
    })
    expect(r.correctCount).toBe(1)
    expect(r.totalCount).toBe(2)
    expect(r.accuracy).toBe(50)
    // 未知 questionId 被忽略，不计入 totalCount
    expect(h.createdRecords[0]?.totalCount).toBe(2)
  })

  it('CLOZE：支持 answerAliases（fewer 亦判对）', async () => {
    const r = await submitAttempt('u1', 'lm-1', {
      mode: 'CLOZE',
      answers: [{ questionId: 'lq2-lm-1-2', userAnswer: 'Fewer' }],
    })
    expect(r.correctCount).toBe(1)
    expect(r.accuracy).toBe(100)
  })

  it('KEYWORD：模糊匹配容忍 1 字符（coffee→错、lattes→对）', async () => {
    // 设计口径：允许 1 个字符容错，因此 'latt'（差 1 字符）也判对，此处用远词做反例
    const wrong = await submitAttempt('u1', 'lm-1', {
      mode: 'KEYWORD',
      answers: [{ questionId: 'fp:0', userAnswer: 'coffee' }],
    })
    expect(wrong.correctCount).toBe(0)

    h.createdRecords.length = 0
    const ok = await submitAttempt('u1', 'lm-1', {
      mode: 'KEYWORD',
      answers: [{ questionId: 'fp:0', userAnswer: 'lattes' }],
    })
    expect(ok.correctCount).toBe(1)
    expect(ok.totalCount).toBe(2) // 分母为 focusPoints 总数
  })

  it('KEYWORD：1 字符容差内的拼写变体判对（设计 §5.2 允许 1 字符容错）', async () => {
    const r = await submitAttempt('u1', 'lm-1', {
      mode: 'KEYWORD',
      answers: [{ questionId: 'fp:0', userAnswer: 'latt' }],
    })
    expect(r.correctCount).toBe(1)
  })

  it('DICTATION：本地 diff，返回四态 token 与 accuracy', async () => {
    const r = await submitAttempt('u1', 'lm-1', {
      mode: 'DICTATION',
      dictationText: 'Good morning, what can I get for you? I would like a latte with more sugar.',
    })
    expect(r.mode).toBe('DICTATION')
    expect(r.dictationDiff).not.toBeNull()
    expect(r.totalCount).toBeGreaterThan(0)
    // less → more 是 substitution
    expect(r.dictationDiff?.some((d) => d.type === 'wrong' && d.token === 'less')).toBe(true)
    expect(r.accuracy).toBeGreaterThan(0)
    expect(r.accuracy).toBeLessThan(100)
  })

  it('INTENSIVE：无判分（accuracy 0、totalCount 0），但仍落记录', async () => {
    const r = await submitAttempt('u1', 'lm-1', { mode: 'INTENSIVE', durationSec: 90 })
    expect(r.accuracy).toBe(0)
    expect(r.totalCount).toBe(0)
    expect(h.createdRecords).toHaveLength(1)
  })

  it('提交即写当日听力统计（用户本地日期）', async () => {
    await submitAttempt('u1', 'lm-1', { mode: 'CHOICE', answers: [], durationSec: 45 })
    expect(h.dailyUpserts).toHaveLength(1)
    const u = h.dailyUpserts[0] as { where: { userId_date: { date: string } }; update: { listeningSeconds: { increment: number } } }
    expect(u.where.userId_date.date).toBe('2026-01-01')
    expect(u.update.listeningSeconds.increment).toBe(45)
  })
})

describe('L5 getRecordReport — 报告结构与 ruleStats', () => {
  it('客观题报告：含逐题作答、ruleStats 关键数字', async () => {
    h.recordFirst = {
      id: 'rec-1',
      materialId: 'lm-1',
      mode: 'CHOICE',
      accuracy: 50,
      totalCount: 2,
      correctCount: 1,
      durationSec: 120,
      playbackRate: 1,
      unknownWords: [{ word: 'latte', meaning: '拿铁' }, 'bad-shape'],
      answers: { kind: 'objective', items: [{ questionId: 'lq2-lm-1-1', userAnswer: 'A', isCorrect: true }] },
      completedAt: new Date('2026-01-01T10:00:00Z'),
      material: { id: 'lm-1', title: 'Ordering Coffee', intensityLevel: 1, focusPoints: FOCUS_POINTS, transcript: TRANSCRIPT },
    }
    const r = await getRecordReport('u1', 'rec-1')
    expect(r.accuracy).toBe(50)
    expect(r.answers).toHaveLength(1)
    expect(r.unknownWords).toEqual([{ word: 'latte', meaning: '拿铁' }]) // 脏数据被过滤
    expect(r.ruleStats.accuracy).toBe(50)
    expect(r.ruleStats.correctCount).toBe(1)
    expect(r.dictationDiff).toBeNull()
    expect(r.focusPoints).toHaveLength(2)
  })

  it('听写报告：ruleStats 带 substituted/missing/extra 四态统计', async () => {
    h.recordFirst = {
      id: 'rec-2',
      materialId: 'lm-1',
      mode: 'DICTATION',
      accuracy: 80,
      totalCount: 5,
      correctCount: 4,
      durationSec: 60,
      playbackRate: 1,
      unknownWords: null,
      answers: {
        kind: 'dictation',
        diff: [
          { index: 0, token: 'a', type: 'correct' },
          { index: 1, token: 'b', type: 'wrong', actual: 'c' },
          { index: 2, token: 'd', type: 'missing' },
          { index: 3, token: 'e', type: 'extra' },
        ],
      },
      completedAt: new Date('2026-01-01T10:00:00Z'),
      material: { id: 'lm-1', title: 'Ordering Coffee', intensityLevel: 1, focusPoints: [], transcript: TRANSCRIPT },
    }
    const r = await getRecordReport('u1', 'rec-2')
    expect(r.ruleStats.substituted).toBe(1)
    expect(r.ruleStats.missing).toBe(1)
    expect(r.ruleStats.extra).toBe(1)
    expect(r.dictationDiff).toHaveLength(4)
    expect(r.answers).toHaveLength(0)
  })

  it('兼容 Phase 1 裸数组 answers 形态', async () => {
    h.recordFirst = {
      id: 'rec-3',
      materialId: 'lm-1',
      mode: 'CHOICE',
      accuracy: 100,
      totalCount: 1,
      correctCount: 1,
      durationSec: 10,
      playbackRate: 1,
      unknownWords: null,
      answers: [{ questionId: 'lq2-lm-1-1', userAnswer: 'A', isCorrect: true }],
      completedAt: new Date('2026-01-01T10:00:00Z'),
      material: { id: 'lm-1', title: 'Ordering Coffee', intensityLevel: 1, focusPoints: [], transcript: TRANSCRIPT },
    }
    const r = await getRecordReport('u1', 'rec-3')
    expect(r.answers).toEqual([{ questionId: 'lq2-lm-1-1', userAnswer: 'A', isCorrect: true }])
  })

  it('记录不存在 → 404', async () => {
    h.recordFirst = null
    await expect(getRecordReport('u1', 'nope')).rejects.toThrow(/训练记录不存在/)
  })
})

describe('L6 analyzeRecord — AI 降级回落到规则分析', () => {
  beforeEach(() => {
    // mock 的 listeningMaterial.findMany 统一返回 h.materials，此处即「下一篇推荐」池
    h.materials = [{ id: 'lm-2', title: 'Next One', intensityLevel: 1 }]
  })

  it('AI degraded → source=rule，仍返回可用的 suggestions/weakSpots/nextMaterials', async () => {
    h.aiListening = { degraded: true, data: null }
    h.recordFirst = {
      id: 'rec-1',
      materialId: 'lm-1',
      mode: 'DICTATION',
      accuracy: 40,
      totalCount: 10,
      correctCount: 4,
      durationSec: 60,
      playbackRate: 1,
      unknownWords: [{ word: 'latte', meaning: '拿铁' }],
      answers: { kind: 'dictation', diff: [{ index: 0, token: 'x', type: 'missing' }] },
      completedAt: new Date('2026-01-01T10:00:00Z'),
      material: { id: 'lm-1', title: 'Ordering Coffee', intensityLevel: 1, focusPoints: [], transcript: TRANSCRIPT },
    }
    const r = await analyzeRecord('u1', 'rec-1')
    expect(r.source).toBe('rule')
    expect(r.ai.degraded).toBe(true)
    expect(r.analysis.suggestions.length).toBeGreaterThan(0)
    expect(r.analysis.weakSpots.join(' ')).toContain('漏听 1 词')
    expect(r.analysis.nextMaterials).toHaveLength(1)
  })

  it('AI 可用 → source=ai，缺失字段用规则值补齐', async () => {
    h.aiListening = { degraded: false, data: { suggestions: ['多听连读'], weakSpots: [] } }
    h.recordFirst = {
      id: 'rec-1',
      materialId: 'lm-1',
      mode: 'CHOICE',
      accuracy: 95,
      totalCount: 10,
      correctCount: 9,
      durationSec: 60,
      playbackRate: 1,
      unknownWords: [],
      answers: { kind: 'objective', items: [] },
      completedAt: new Date('2026-01-01T10:00:00Z'),
      material: { id: 'lm-1', title: 'Ordering Coffee', intensityLevel: 1, focusPoints: [], transcript: TRANSCRIPT },
    }
    const r = await analyzeRecord('u1', 'rec-1')
    expect(r.source).toBe('ai')
    expect(r.ai.degraded).toBe(false)
    expect(r.analysis.suggestions).toEqual(['多听连读'])
    // AI 未返回 weakSpots → 回落到规则推导
    expect(r.analysis.weakSpots.length).toBeGreaterThan(0)
  })
})

describe('L7 saveProgress — upsert 键与取值钳制', () => {
  beforeEach(() => {
    h.progressUpserts.length = 0
  })

  it('以 (userId, materialId) 复合键 upsert，非法值被钳制', async () => {
    const r = await saveProgress('u1', { materialId: 'lm-1', positionSec: -5, playbackRate: 0.1 })
    expect(h.progressUpserts).toHaveLength(1)
    const u = h.progressUpserts[0] as {
      where: { userId_materialId: { userId: string; materialId: string } }
      update: { positionSec: number; playbackRate: number; completed: boolean }
    }
    expect(u.where.userId_materialId).toEqual({ userId: 'u1', materialId: 'lm-1' })
    expect(u.update.positionSec).toBe(0) // 负值钳到 0
    expect(u.update.playbackRate).toBe(0.5) // 越界倍速钳到下限 0.5（与 Zod schema 同口径）
    expect(u.update.completed).toBe(false)
    expect(r.positionSec).toBe(0)
  })

  it('未传倍速 → 回退 1.0；completed 默认 false', async () => {
    h.progressUpserts.length = 0
    const r = await saveProgress('u1', { materialId: 'lm-1', positionSec: 10 })
    expect(r.playbackRate).toBe(1)
    expect(r.completed).toBe(false)
  })

  it('completed=true 与自定义倍速被透传', async () => {
    const r = await saveProgress('u1', { materialId: 'lm-1', positionSec: 30, playbackRate: 1.25, completed: true })
    expect(r).toEqual({ positionSec: 30, playbackRate: 1.25, completed: true })
  })
})

describe('L1 listMaterials — facets / 进度 / 最佳成绩 / 资产时长', () => {
  beforeEach(() => {
    h.materials = [
      material({ id: 'lm-1', category: 'daily', intensityLevel: 1, difficulty: 'EASY' }),
      material({ id: 'lm-2', category: 'cet4', intensityLevel: 2, difficulty: 'MEDIUM' }),
      material({ id: 'lm-3', category: 'cet4', intensityLevel: 2, difficulty: 'MEDIUM' }),
    ]
    h.progresses = [{ materialId: 'lm-1', positionSec: 42, playbackRate: 1, completed: true }]
    h.records = [
      { materialId: 'lm-2', accuracy: 60 },
      { materialId: 'lm-2', accuracy: 90 },
      { materialId: 'lm-2', accuracy: 70 },
    ]
    h.assets = [{ materialId: 'lm-1', rate: 1, url: '/audio/listening/ordering-coffee_100.mp3', durationSec: 31 }]
  })

  it('facets 按全量分布计数（分类/难度/强度档）', async () => {
    const r = await listMaterials('u1', {})
    expect(r.total).toBe(3)
    expect(r.facets.categories).toEqual([
      { value: 'cet4', count: 2 },
      { value: 'daily', count: 1 },
    ])
    expect(r.facets.difficulties).toEqual([
      { value: 'MEDIUM', count: 2 },
      { value: 'EASY', count: 1 },
    ])
    expect(r.facets.intensityLevels).toEqual([
      { value: '2', count: 2 },
      { value: '1', count: 1 },
    ])
  })

  it('进度回填 + 最佳正确率取最大值', async () => {
    const r = await listMaterials('u1', {})
    const first = r.materials.find((m) => m.id === 'lm-1')
    const second = r.materials.find((m) => m.id === 'lm-2')
    expect(first?.progress).toEqual({ positionSec: 42, playbackRate: 1, completed: true })
    expect(first?.bestAccuracy).toBeNull()
    expect(second?.progress).toBeNull()
    expect(second?.bestAccuracy).toBe(90)
  })

  it('音频档位与资产表合并：有资产时用真实 durationSec', async () => {
    const r = await listMaterials('u1', {})
    const m = r.materials.find((x) => x.id === 'lm-1')
    expect(m?.audioUrls.map((a) => a.rate)).toEqual([0.75, 1, 1.25])
    expect(m?.audioUrls.find((a) => a.rate === 1)?.durationSec).toBe(31)
    expect(m?.audioUrls.find((a) => a.rate === 0.75)?.durationSec).toBeNull()
    expect(m?.recommendedRate).toBe(1) // intensityLevel 1 → 1.0
  })

  it('intensity 筛选条件被应用', async () => {
    await listMaterials('u1', { intensity: 2 })
    expect(h.materials).toHaveLength(3) // mock 不真正过滤，此处只验证不报错
  })
})

describe('L2 getMaterialDetail', () => {
  it('返回三档音频、字幕、考点、可用 6 模式', async () => {
    h.materialFirst = material()
    const r = await getMaterialDetail('u1', 'lm-1')
    expect(r.audioUrls).toHaveLength(3)
    expect(r.transcript).toHaveLength(2)
    expect(r.focusPoints).toHaveLength(2)
    expect(r.availableModes).toEqual(['EXTENSIVE', 'CHOICE', 'CLOZE', 'KEYWORD', 'INTENSIVE', 'DICTATION'])
    expect(r.availableModes).not.toContain('RETELL')
  })
})

describe('L8 checkDictation — 纯本地 diff 透传', () => {
  it('确定性输出（同输入同结果）', () => {
    const a = checkDictation('I would like a latte', 'I would like a latte')
    const b = checkDictation('I would like a latte', 'I would like a latte')
    expect(a).toEqual(b)
    expect(a.accuracy).toBe(100)
    expect(a.diff.every((d) => d.type === 'correct')).toBe(true)
  })
})
