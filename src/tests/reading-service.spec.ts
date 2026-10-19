/**
 * reading-service.spec.ts — 阅读服务层单测（T15）。
 *
 * 覆盖策略：mock Prisma 与用户时区解析（与 listening-service.spec.ts 同套路），
 * 验证**编排与判分汇总逻辑**，不验证 SQL 本身：
 *   - R1 列表的筛选/facets/进度回填；
 *   - R2 详情的题目**不含答案**（防作弊）与 location 透传；
 *   - R3 判分（单选字母/多选集合）+ 错题写 wrong_questions + 当日统计；
 *   - R4 AI 降级 → degraded=true（前端隐藏区块）；
 *   - 划词直查（词典，0 AI）与断点续读 upsert。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface ArticleRow {
  id: string
  title: string
  category: string
  difficulty: string
  cefrLevel: string | null
  wordCount: number
  readingMinutes: number
  tags?: unknown
  contentBlocks?: unknown
  keyWords?: unknown
  sentences?: unknown
  sourceName?: string | null
  sourceUrl?: string | null
  questions?: Array<{
    id: string
    type: string
    stem: string
    options?: unknown
    answer: string
    explanation: string | null
    location?: unknown
    sortOrder?: number
  }>
}

const h = vi.hoisted(() => ({
  articleFirst: null as ArticleRow | null,
  articles: [] as ArticleRow[],
  records: [] as Array<{
    userId: string
    articleId: string
    progress: number
    lastBlockIndex: number
    quizResult: unknown
    highlights: unknown
  }>,
  recordUnique: null as { progress: number; lastBlockIndex: number; quizResult: unknown; highlights: unknown } | null,
  vocabRow: null as Record<string, unknown> | null,
  /** 已存在的错题行（模拟「同题重复错」） */
  wrongExisting: null as { id: string; errorCount: number } | null,
  wrongCreates: [] as Array<Record<string, unknown>>,
  wrongFinds: [] as Array<Record<string, unknown>>,
  wrongUpdates: [] as Array<Record<string, unknown>>,
  recordUpserts: [] as Array<Record<string, unknown>>,
  statUpserts: [] as Array<Record<string, unknown>>,
  aiReading: { degraded: true, data: null as unknown },
}))

vi.mock('@/lib/db', () => {
  const tx = {
    readingRecord: {
      upsert: vi.fn(async (a: { where: unknown; update: unknown; create: unknown }) => {
        h.recordUpserts.push(a)
        return { progress: 100, lastBlockIndex: 2 }
      }),
    },
    wrongQuestion: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => {
        h.wrongFinds.push(a.where)
        return h.wrongExisting
      }),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.wrongCreates.push(a.data)
        return { id: 'wq-1' }
      }),
      update: vi.fn(async (a: { where: unknown; data: Record<string, unknown> }) => {
        h.wrongUpdates.push(a.data)
        return {}
      }),
    },
    dailyLearningStat: {
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.statUpserts.push(a)
        return {}
      }),
    },
  }
  const prisma = {
    readingArticle: {
      findFirst: vi.fn(async () => h.articleFirst),
      findMany: vi.fn(async () => h.articles),
      count: vi.fn(async () => h.articles.length),
    },
    readingRecord: {
      findMany: vi.fn(async () => h.records),
      findUnique: vi.fn(async () => h.recordUnique),
      upsert: vi.fn(async (a: { where: unknown; update: unknown; create: unknown }) => {
        h.recordUpserts.push(a)
        return { progress: (a.update as { progress?: number })?.progress ?? 0, lastBlockIndex: 2 }
      }),
      update: vi.fn(async () => ({ highlights: [] })),
    },
    wrongQuestion: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => {
        h.wrongFinds.push(a.where)
        return h.wrongExisting
      }),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.wrongCreates.push(a.data)
        return { id: 'wq-1' }
      }),
      update: vi.fn(async (a: { where: unknown; data: Record<string, unknown> }) => {
        h.wrongUpdates.push(a.data)
        return {}
      }),
    },
    dailyLearningStat: {
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.statUpserts.push(a)
        return {}
      }),
    },
    vocabulary: {
      findUnique: vi.fn(async () => h.vocabRow),
    },
    $transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  }
  return { prisma }
})

vi.mock('@/lib/utils/user-date', () => ({ userToday: vi.fn(async () => '2026-01-01') }))

vi.mock('@/services/ai/ai.service', () => ({
  aiService: {
    explainReading: vi.fn(async () => ({ data: h.aiReading.data, degraded: h.aiReading.degraded })),
  },
}))

import {
  explainSentence,
  getArticleDetail,
  gradeReadingQuestion,
  listArticles,
  lookupWord,
  saveReadingProgress,
  submitQuiz,
} from '@/services/reading.service'

const BLOCKS = [
  { index: 0, en: 'Reading every day builds vocabulary slowly but surely.', zh: '每天阅读能缓慢但切实地积累词汇。' },
  { index: 1, en: 'Researchers found that twenty minutes a night is enough.', zh: '研究者发现每晚二十分钟已然足够。' },
]

function article(over: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: 'ra-1',
    title: 'The Habit of Daily Reading',
    category: 'education',
    difficulty: 'MEDIUM',
    cefrLevel: 'B1',
    wordCount: 240,
    readingMinutes: 2,
    tags: ['education', 'MEDIUM'],
    contentBlocks: BLOCKS,
    keyWords: [{ word: 'vocabulary', pos: 'n.', meaning: '词汇' }],
    sentences: [{ sentence: BLOCKS[0]!.en, structure: 'SVO', translation: BLOCKS[0]!.zh }],
    sourceName: null,
    sourceUrl: null,
    questions: [
      {
        id: 'rq-1',
        type: 'SINGLE_CHOICE',
        stem: 'Which statement best summarises the first paragraph?',
        options: ['A. Reading builds vocabulary.', 'B. Reading is useless.', 'C. Reading is cheap.', 'D. Reading is old.'],
        answer: 'A',
        explanation: '首段主旨即选项 A。',
        location: { blockIndex: 0, charStart: 0, charEnd: 50 },
        sortOrder: 0,
      },
      {
        id: 'rq-2',
        type: 'MULTI_CHOICE',
        stem: 'Which of the following are TRUE?',
        options: ['A. Twenty minutes is enough.', 'B. Reading is harmful.'],
        answer: 'A',
        explanation: '只有 A 正确。',
        location: { blockIndex: 1, charStart: 0, charEnd: 60 },
        sortOrder: 1,
      },
    ],
    ...over,
  }
}

describe('判分（确定性，0 AI 依赖）', () => {
  it('单选：字母精确命中；容忍 "A." / "a" / "A " 写法', () => {
    expect(gradeReadingQuestion('SINGLE_CHOICE', 'A', 'A')).toBe(true)
    expect(gradeReadingQuestion('SINGLE_CHOICE', 'a', 'A')).toBe(true)
    expect(gradeReadingQuestion('SINGLE_CHOICE', 'A.', 'A')).toBe(true)
    expect(gradeReadingQuestion('SINGLE_CHOICE', 'B', 'A')).toBe(false)
    expect(gradeReadingQuestion('TRUE_FALSE', 'T', 'T')).toBe(true)
  })

  it('多选：按集合比对，忽略顺序与分隔符', () => {
    expect(gradeReadingQuestion('MULTI_CHOICE', 'A,C', 'C,A')).toBe(true)
    expect(gradeReadingQuestion('MULTI_CHOICE', 'A C', 'A,C')).toBe(true)
    expect(gradeReadingQuestion('MULTI_CHOICE', 'A', 'A,C')).toBe(false)
    expect(gradeReadingQuestion('MULTI_CHOICE', 'A,C,D', 'A,C')).toBe(false)
  })
})

describe('R1 listArticles', () => {
  beforeEach(() => {
    h.articles = [article(), article({ id: 'ra-2', category: 'tech', difficulty: 'HARD' })]
    h.records = []
  })

  it('返回文章 + facets + 分页信息', async () => {
    const r = await listArticles('u1', { page: 1, pageSize: 20 })
    expect(r.articles).toHaveLength(2)
    expect(r.total).toBe(2)
    expect(r.facets.categories.map((c) => c.value).sort()).toEqual(['education', 'tech'])
  })

  it('进度回填：quizDone / quizAccuracy 来自 reading_records', async () => {
    h.records = [{ userId: 'u1', articleId: 'ra-1', progress: 60, lastBlockIndex: 1, quizResult: { score: 50, total: 2, correctCount: 1 }, highlights: [] }]
    const r = await listArticles('u1', {})
    const first = r.articles.find((a) => a.id === 'ra-1')
    expect(first?.progress).toBe(60)
    expect(first?.quizDone).toBe(true)
    expect(first?.quizAccuracy).toBe(50)
    const second = r.articles.find((a) => a.id === 'ra-2')
    expect(second?.quizDone).toBe(false)
    expect(second?.quizAccuracy).toBeNull()
  })

  it('脏数据 quizResult（total<=0）→ 视为未做', async () => {
    h.records = [{ userId: 'u1', articleId: 'ra-1', progress: 0, lastBlockIndex: 0, quizResult: { score: 0, total: 0 }, highlights: null }]
    const r = await listArticles('u1', {})
    expect(r.articles[0]?.quizDone).toBe(false)
  })
})

describe('R2 getArticleDetail', () => {
  beforeEach(() => {
    h.articleFirst = article()
    h.recordUnique = null
  })

  it('返回正文/重点词/长难句/题目 + location 透传', async () => {
    const r = await getArticleDetail('u1', 'ra-1')
    expect(r.contentBlocks).toHaveLength(2)
    expect(r.keyWords).toHaveLength(1)
    expect(r.sentences).toHaveLength(1)
    expect(r.questions).toHaveLength(2)
    expect(r.questions[0]?.location).toEqual({ blockIndex: 0, charStart: 0, charEnd: 50 })
  })

  it('**防作弊**：题目里不得出现 answer / explanation', async () => {
    const r = await getArticleDetail('u1', 'ra-1')
    const json = JSON.stringify(r.questions)
    expect(json).not.toContain('"A"')
    expect(json).not.toContain('explanation')
    expect(json).not.toContain('首段主旨')
  })

  it('断点续读字段来自 reading_records', async () => {
    h.recordUnique = { progress: 42, lastBlockIndex: 1, quizResult: { score: 100, total: 1, correctCount: 1 }, highlights: [] }
    const r = await getArticleDetail('u1', 'ra-1')
    expect(r.progress).toBe(42)
    expect(r.lastBlockIndex).toBe(1)
    expect(r.quizResult?.correctCount).toBe(1)
  })

  it('location 脏数据 → null（前端隐藏定位按钮，不崩）', async () => {
    h.articleFirst = article({
      questions: [{ id: 'rq-1', type: 'SINGLE_CHOICE', stem: 's', options: ['A'], answer: 'A', explanation: null, location: { blockIndex: -3 }, sortOrder: 0 }],
    })
    const r = await getArticleDetail('u1', 'ra-1')
    expect(r.questions[0]?.location).toBeNull()
  })

  it('文章不存在 → 404', async () => {
    h.articleFirst = null
    await expect(getArticleDetail('u1', 'nope')).rejects.toThrow(/阅读文章不存在/)
  })
})

describe('R3 submitQuiz — 判分 + 错题本 + 统计', () => {
  beforeEach(() => {
    h.articleFirst = article()
    h.wrongCreates = []
    h.wrongFinds = []
    h.recordUpserts = []
    h.statUpserts = []
  })

  it('判分汇总：score/correctCount/accuracy 与逐题结果', async () => {
    const r = await submitQuiz('u1', 'ra-1', {
      answers: [
        { questionId: 'rq-1', userAnswer: 'A' },
        { questionId: 'rq-2', userAnswer: 'B' },
      ],
    })
    expect(r.total).toBe(2)
    expect(r.correctCount).toBe(1)
    expect(r.accuracy).toBe(50)
    expect(r.answers[0]?.isCorrect).toBe(true)
    expect(r.answers[1]?.isCorrect).toBe(false)
    // 报告里带正确答案与解析（提交后才允许出现）
    expect(r.answers[1]?.correctAnswer).toBe('A')
    expect(r.answers[1]?.explanation).toBe('只有 A 正确。')
  })

  it('验收 3：错题自动写入 wrong_questions（source=reading）', async () => {
    const r = await submitQuiz('u1', 'ra-1', {
      answers: [
        { questionId: 'rq-1', userAnswer: 'B' },
        { questionId: 'rq-2', userAnswer: 'A' },
      ],
    })
    expect(r.wrongCount).toBe(1)
    expect(h.wrongCreates).toHaveLength(1)
    expect(h.wrongCreates[0]).toMatchObject({
      userId: 'u1',
      source: 'reading',
      refType: 'reading_question',
      refId: 'rq-1',
      userAnswer: 'B',
      correctAnswer: 'A',
    })
  })

  it('同题重复错 → 累加 errorCount 而不是新建行', async () => {
    h.wrongExisting = { id: 'wq-9', errorCount: 2 }
    h.wrongCreates = []
    h.wrongUpdates = []
    await submitQuiz('u1', 'ra-1', { answers: [{ questionId: 'rq-1', userAnswer: 'B' }] })
    expect(h.wrongCreates).toHaveLength(0)
    expect(h.wrongUpdates).toHaveLength(1)
    expect(h.wrongUpdates[0]).toMatchObject({ errorCount: 3 })
    h.wrongExisting = null
  })

  it('未知题目 id 被跳过，不让整次提交失败', async () => {
    const r = await submitQuiz('u1', 'ra-1', {
      answers: [
        { questionId: 'rq-1', userAnswer: 'A' },
        { questionId: 'ghost', userAnswer: 'A' },
      ],
    })
    expect(r.total).toBe(1)
    expect(r.correctCount).toBe(1)
  })

  it('reading_records.quizResult 与当日统计同事务写入', async () => {
    await submitQuiz('u1', 'ra-1', { answers: [{ questionId: 'rq-1', userAnswer: 'A' }], durationSec: 90 })
    expect(h.recordUpserts).toHaveLength(1)
    const upd = h.recordUpserts[0]?.update as { quizResult: { score: number; total: number }; progress: number }
    expect(upd.quizResult).toMatchObject({ score: 100, total: 1 })
    expect(upd.progress).toBe(100)
    expect(h.statUpserts).toHaveLength(1)
    const stat = h.statUpserts[0]?.update as { readingCount: { increment: number } }
    expect(stat.readingCount.increment).toBe(1)
  })
})

describe('R4 explainSentence — AI 降级即 degraded', () => {
  beforeEach(() => {
    h.articleFirst = article()
  })

  it('AI 不可用 → degraded=true、explanation=null（前端隐藏区块）', async () => {
    h.aiReading = { degraded: true, data: null }
    const r = await explainSentence('u1', 'ra-1', { sentence: 'Reading every day builds vocabulary.' })
    expect(r.degraded).toBe(true)
    expect(r.explanation).toBeNull()
  })

  it('AI 可用 → 返回讲解文本', async () => {
    h.aiReading = { degraded: false, data: { explanation: '本句主干为 Reading builds vocabulary。' } }
    const r = await explainSentence('u1', 'ra-1', { sentence: 'Reading every day builds vocabulary.' })
    expect(r.degraded).toBe(false)
    expect(r.explanation).toContain('主干')
  })

  it('AI 返回非字符串 → 视为降级（不把脏数据透给前端）', async () => {
    h.aiReading = { degraded: false, data: { foo: 'bar' } }
    const r = await explainSentence('u1', 'ra-1', { sentence: 'x' })
    expect(r.degraded).toBe(true)
    expect(r.explanation).toBeNull()
  })

  it('AI 抛错 → 捕获并降级（不 500）', async () => {
    const { aiService } = await import('@/services/ai/ai.service')
    vi.mocked(aiService.explainReading).mockRejectedValueOnce(new Error('boom') as never)
    const r = await explainSentence('u1', 'ra-1', { sentence: 'x' })
    expect(r.degraded).toBe(true)
  })
})

describe('划词直查（词典，0 AI）', () => {
  beforeEach(() => {
    h.vocabRow = null
  })

  it('命中：返回音标/词性/释义/例句', async () => {
    h.vocabRow = {
      word: 'vocabulary',
      lemma: 'vocabulary',
      phoneticUk: '/vəʊ/',
      phoneticUs: '/voʊ/',
      pos: ['n.'],
      definitions: [{ pos: 'n.', zh: '词汇' }],
      examples: [{ en: 'Build your vocabulary.', zh: '积累词汇。' }],
    }
    const r = await lookupWord('Vocabulary')
    expect(r.found).toBe(true)
    expect(r.lemma).toBe('vocabulary')
    expect(r.definitions[0]?.zh).toBe('词汇')
    expect(r.examples).toHaveLength(1)
  })

  it('未命中：found=false，不抛错（前端提示未收录）', async () => {
    const r = await lookupWord('zzzznotaword')
    expect(r.found).toBe(false)
    expect(r.definitions).toEqual([])
  })

  it('空/非法输入 → VALIDATION_ERROR', async () => {
    await expect(lookupWord('   ')).rejects.toThrow(/有效的英文单词/)
    await expect(lookupWord('123')).rejects.toThrow(/有效的英文单词/)
  })
})

describe('断点续读 saveReadingProgress', () => {
  beforeEach(() => {
    h.articleFirst = article()
    h.statUpserts = []
  })

  it('upsert reading_records 并钳制 progress 到 0-100', async () => {
    const r = await saveReadingProgress('u1', 'ra-1', { progress: 150, lastBlockIndex: 3, readSeconds: 30 })
    expect(r.progress).toBe(100)
    expect(h.recordUpserts.length).toBeGreaterThan(0)
  })

  it('readSeconds>0 → 计入当日阅读统计', async () => {
    await saveReadingProgress('u1', 'ra-1', { progress: 10, readSeconds: 45 })
    expect(h.statUpserts).toHaveLength(1)
  })

  it('文章不存在 → 404', async () => {
    h.articleFirst = null
    await expect(saveReadingProgress('u1', 'nope', { progress: 10 })).rejects.toThrow(/阅读文章不存在/)
  })
})
