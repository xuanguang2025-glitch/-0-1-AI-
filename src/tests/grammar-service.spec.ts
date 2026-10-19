/**
 * grammar-service.spec.ts — 语法服务层单测（T16）。
 *
 * 覆盖策略：mock Prisma 与用户时区解析，验证**编排与判分汇总逻辑**：
 *   - G1 树组装（parent/children，种子为平铺根节点）；
 *   - G2 详情的 Json 解析与掌握度透传；
 *   - G3 练习题**不含答案**（防作弊）；
 *   - G4 判分 + 错题本（source='grammar'）+ **掌握度=累计正确率** + 当日统计；
 *   - G5 AI 降级 → **静态知识点兜底 source='static'**（验收 3）；
 *   - 判分纯函数的字母容错。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface TopicRow {
  id: string
  name: string
  slug: string
  category: string
  difficulty: string
  parentId: string | null
  orderIndex: number
  content?: unknown
  examples?: unknown
  errorExamples?: unknown
  description?: string | null
  questions?: Array<{
    id: string
    type: string
    stem: string
    options?: unknown
    answer: string
    explanation: string | null
    sortOrder?: number
  }>
  _count?: { questions: number }
}

const h = vi.hoisted(() => ({
  topicFirst: null as TopicRow | null,
  topics: [] as TopicRow[],
  progresses: [] as Array<{ topicId: string; mastery: number; attemptCount: number; correctCount: number }>,
  progressUnique: null as { mastery: number; attemptCount: number; correctCount: number } | null,
  wrongCreates: [] as Array<Record<string, unknown>>,
  wrongUpdates: [] as Array<Record<string, unknown>>,
  progressUpserts: [] as Array<Record<string, unknown>>,
  statUpserts: [] as Array<Record<string, unknown>>,
  aiGrammar: { degraded: true, data: null as unknown },
}))

vi.mock('@/lib/db', () => {
  const tx = {
    wrongQuestion: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.wrongCreates.push(a.data)
        return { id: 'wq-1' }
      }),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.wrongUpdates.push(a.data)
        return {}
      }),
    },
    userGrammarProgress: {
      findUnique: vi.fn(async () => h.progressUnique),
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.progressUpserts.push(a)
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
    grammarTopic: {
      findFirst: vi.fn(async () => h.topicFirst),
      findMany: vi.fn(async () => h.topics),
    },
    grammarQuestion: {
      findMany: vi.fn(async () => h.topicFirst?.questions ?? []),
    },
    userGrammarProgress: {
      findMany: vi.fn(async () => h.progresses),
      findUnique: vi.fn(async () => h.progressUnique),
      upsert: vi.fn(async (a: Record<string, unknown>) => {
        h.progressUpserts.push(a)
        return {}
      }),
    },
    wrongQuestion: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        h.wrongCreates.push(a.data)
        return { id: 'wq-1' }
      }),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
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
    $transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  }
  return { prisma }
})

vi.mock('@/lib/utils/user-date', () => ({ userToday: vi.fn(async () => '2026-01-01') }))

vi.mock('@/services/ai/ai.service', () => ({
  aiService: {
    explainGrammar: vi.fn(async () => ({ data: h.aiGrammar.data, degraded: h.aiGrammar.degraded })),
  },
}))

import {
  explainTopic,
  getExercises,
  getTopicDetail,
  gradeGrammarQuestion,
  listTopics,
  submitExercises,
} from '@/services/grammar.service'

const CONTENT = [
  { title: '基本结构', content: '现在完成时 have/has + 过去分词。' },
  { title: '用法', content: '表示过去发生并持续到现在的动作。' },
]
const EXAMPLES = [{ en: 'I have finished it.', zh: '我已经做完了。', structure: 'have + done' }]
const ERRORS = [{ wrong: 'I have finish it.', right: 'I have finished it.', reason: '过去分词形式错误。' }]

function topic(over: Partial<TopicRow> = {}): TopicRow {
  return {
    id: 'gt-1',
    name: '现在完成时',
    slug: 'present-perfect',
    category: '时态',
    difficulty: 'MEDIUM',
    parentId: null,
    orderIndex: 0,
    description: '表示过去动作对现在的影响。',
    content: CONTENT,
    examples: EXAMPLES,
    errorExamples: ERRORS,
    questions: [
      {
        id: 'gq-1-1',
        type: 'SINGLE_CHOICE',
        stem: 'She ___ her homework.',
        options: ['A. has finished', 'B. have finish', 'C. has finish', 'D. have finished'],
        answer: 'A',
        explanation: '第三人称单数用 has + 过去分词 finished。',
        sortOrder: 0,
      },
      {
        id: 'gq-1-2',
        type: 'SINGLE_CHOICE',
        stem: 'They ___ here since 2020.',
        options: ['A. has lived', 'B. have lived', 'C. has live', 'D. have live'],
        answer: 'B',
        explanation: '复数主语用 have + 过去分词 lived。',
        sortOrder: 1,
      },
    ],
    _count: { questions: 2 },
    ...over,
  }
}

describe('判分（确定性，0 AI 依赖）', () => {
  it('字母精确命中，容忍大小写与标点', () => {
    expect(gradeGrammarQuestion('A', 'A')).toBe(true)
    expect(gradeGrammarQuestion('a', 'A')).toBe(true)
    expect(gradeGrammarQuestion('A.', 'A')).toBe(true)
    expect(gradeGrammarQuestion('B', 'A')).toBe(false)
  })
})

describe('G1 listTopics — 树组装', () => {
  beforeEach(() => {
    h.progresses = []
  })

  it('14 个主题（parentId 均为 null）→ 14 个根节点、无嵌套', async () => {
    h.topics = Array.from({ length: 14 }, (_, i) => topic({ id: `gt-${i + 1}`, slug: `t-${i + 1}`, orderIndex: i, _count: { questions: 4 } }))
    const r = await listTopics('u1')
    expect(r.total).toBe(14)
    expect(r.topics).toHaveLength(14)
    expect(r.topics.every((t) => t.children.length === 0)).toBe(true)
    // 按 orderIndex 升序
    expect(r.topics.map((t) => t.orderIndex)).toEqual([...Array(14).keys()])
  })

  it('有子节点时挂到父节点下（缩进由前端按 depth 渲染）', async () => {
    h.topics = [topic({ id: 'gt-1' }), topic({ id: 'gt-2', parentId: 'gt-1', slug: 'child' })]
    const r = await listTopics('u1')
    expect(r.topics).toHaveLength(1)
    expect(r.topics[0]?.children.map((c) => c.id)).toEqual(['gt-2'])
  })

  it('掌握度来自 user_grammar_progress；未练习为 null', async () => {
    h.topics = [topic({ id: 'gt-1' }), topic({ id: 'gt-2', slug: 'b' })]
    h.progresses = [{ topicId: 'gt-1', mastery: 80, attemptCount: 3, correctCount: 12 }]
    const r = await listTopics('u1')
    expect(r.topics[0]?.mastery).toBe(80)
    expect(r.topics[0]?.mastered).toBe(true)
    expect(r.topics[1]?.mastery).toBeNull()
    expect(r.topics[1]?.mastered).toBe(false)
  })
})

describe('G2 getTopicDetail', () => {
  beforeEach(() => {
    h.topicFirst = topic()
    h.progressUnique = null
  })

  it('解析知识点/例句/错误示例 + 掌握度', async () => {
    const r = await getTopicDetail('u1', 'gt-1')
    expect(r.name).toBe('现在完成时')
    expect(r.content).toHaveLength(2)
    expect(r.content[0]?.title).toBe('基本结构')
    expect(r.examples[0]?.structure).toBe('have + done')
    expect(r.errorExamples[0]?.reason).toContain('过去分词')
    expect(r.questionCount).toBe(2)
    expect(r.mastery).toBeNull()
  })

  it('Json 脏数据被安全过滤', async () => {
    h.topicFirst = topic({
      content: [{ title: 'x' }, null, 'bad', { content: 'ok' }],
      examples: [{ en: 1 }, { en: 'fine', zh: '好', structure: 's' }],
      errorExamples: [{ wrong: 'a' }, { wrong: 'a', right: 'b', reason: 'r' }],
    })
    const r = await getTopicDetail('u1', 'gt-1')
    expect(r.content).toHaveLength(1)
    expect(r.content[0]?.content).toBe('ok')
    expect(r.examples).toHaveLength(1)
    expect(r.errorExamples).toHaveLength(1)
  })

  it('不存在 → 404', async () => {
    h.topicFirst = null
    await expect(getTopicDetail('u1', 'nope')).rejects.toThrow(/语法知识点不存在/)
  })
})

describe('G3 getExercises — 不含答案', () => {
  beforeEach(() => {
    h.topicFirst = topic()
  })

  it('按 count 取题且**不含 answer/explanation**', async () => {
    const r = await getExercises('u1', 'gt-1', 5)
    expect(r.total).toBe(2)
    expect(r.questions).toHaveLength(2)
    const json = JSON.stringify(r.questions)
    expect(json).not.toContain('"A"')
    expect(json).not.toContain('explanation')
    expect(json).not.toContain('过去分词')
  })

  it('count 钳制到 1-20', async () => {
    const r = await getExercises('u1', 'gt-1', 999)
    expect(r.questions.length).toBeLessThanOrEqual(20)
  })
})

describe('G4 submitExercises — 判分 + 错题本 + 掌握度', () => {
  beforeEach(() => {
    h.topicFirst = topic()
    h.progressUnique = null
    h.wrongCreates = []
    h.wrongUpdates = []
    h.progressUpserts = []
    h.statUpserts = []
  })

  it('判分汇总与逐题解析', async () => {
    const r = await submitExercises('u1', 'gt-1', {
      answers: [
        { questionId: 'gq-1-1', userAnswer: 'A' },
        { questionId: 'gq-1-2', userAnswer: 'A' },
      ],
    })
    expect(r.total).toBe(2)
    expect(r.correctCount).toBe(1)
    expect(r.accuracy).toBe(50)
    expect(r.answers[0]?.isCorrect).toBe(true)
    expect(r.answers[1]?.correctAnswer).toBe('B')
  })

  it('验收 2：错题写入 wrong_questions（source=grammar）', async () => {
    const r = await submitExercises('u1', 'gt-1', { answers: [{ questionId: 'gq-1-1', userAnswer: 'B' }] })
    expect(r.wrongCount).toBe(1)
    expect(h.wrongCreates).toHaveLength(1)
    expect(h.wrongCreates[0]).toMatchObject({
      userId: 'u1',
      source: 'grammar',
      refType: 'grammar_question',
      refId: 'gq-1-1',
      userAnswer: 'B',
      correctAnswer: 'A',
    })
  })

  it('验收 4：掌握度=题目级累计正确率（不是单次分数）', async () => {
    // 历史：累计答 12 题对 9 题 = 75%
    h.progressUnique = { mastery: 75, attemptCount: 12, correctCount: 9 }
    const r = await submitExercises('u1', 'gt-1', {
      answers: [
        { questionId: 'gq-1-1', userAnswer: 'A' },
        { questionId: 'gq-1-2', userAnswer: 'B' },
      ],
    })
    // 本次 2/2 全对 → 累计 11/14 ≈ 79%
    expect(r.correctCount).toBe(2)
    expect(r.attemptCount).toBe(14)
    expect(r.mastery).toBe(79)
    expect(r.mastered).toBe(false) // 79 < 80
    expect(h.progressUpserts).toHaveLength(1)
    const upd = h.progressUpserts[0]?.update as { mastery: number; attemptCount: number; correctCount: number }
    expect(upd).toMatchObject({ mastery: 79, attemptCount: 14, correctCount: 11 })
  })

  it('累计达标 → mastered=true（≥80% 且累计答题 ≥3）', async () => {
    // 历史：累计答 3 题对 2 题 ≈ 67%
    h.progressUnique = { mastery: 67, attemptCount: 3, correctCount: 2 }
    const r = await submitExercises('u1', 'gt-1', {
      answers: [
        { questionId: 'gq-1-1', userAnswer: 'A' },
        { questionId: 'gq-1-2', userAnswer: 'B' },
      ],
    })
    // (2+2)/(3+2) = 80%
    expect(r.mastery).toBe(80)
    expect(r.attemptCount).toBe(5)
    expect(r.mastered).toBe(true)
  })

  it('当日语法统计同事务写入', async () => {
    await submitExercises('u1', 'gt-1', { answers: [{ questionId: 'gq-1-1', userAnswer: 'A' }] })
    expect(h.statUpserts).toHaveLength(1)
    const upd = h.statUpserts[0]?.update as { grammarCount: { increment: number }; correctCount: { increment: number } }
    expect(upd.grammarCount.increment).toBe(1)
    expect(upd.correctCount.increment).toBe(1)
  })

  it('未知题目 id 被跳过', async () => {
    const r = await submitExercises('u1', 'gt-1', {
      answers: [
        { questionId: 'gq-1-1', userAnswer: 'A' },
        { questionId: 'ghost', userAnswer: 'A' },
      ],
    })
    expect(r.total).toBe(1)
  })
})

describe('G5 explainTopic — 验收 3：Mock 时静态兜底', () => {
  beforeEach(() => {
    h.topicFirst = topic()
  })

  it('AI 不可用 → source=static，讲解由知识点+例句拼装（页面完整）', async () => {
    h.aiGrammar = { degraded: true, data: null }
    const r = await explainTopic('u1', 'gt-1')
    expect(r.source).toBe('static')
    expect(r.explanation).toContain('【现在完成时】核心要点')
    expect(r.explanation).toContain('基本结构')
    expect(r.explanation).toContain('I have finished it.')
  })

  it('AI 可用 → source=ai 且用 AI 文本', async () => {
    h.aiGrammar = { degraded: false, data: { explanation: 'AI 讲解：现在完成时强调对现在的影响。' } }
    const r = await explainTopic('u1', 'gt-1')
    expect(r.source).toBe('ai')
    expect(r.explanation).toContain('AI 讲解')
  })

  it('AI 返回脏数据 → 回落 static', async () => {
    h.aiGrammar = { degraded: false, data: { foo: 1 } }
    const r = await explainTopic('u1', 'gt-1')
    expect(r.source).toBe('static')
  })

  it('AI 抛错 → 捕获并回落 static（不 500）', async () => {
    const { aiService } = await import('@/services/ai/ai.service')
    vi.mocked(aiService.explainGrammar).mockRejectedValueOnce(new Error('boom') as never)
    const r = await explainTopic('u1', 'gt-1')
    expect(r.source).toBe('static')
  })

  it('指定 pointTitle → 只讲解该要点', async () => {
    h.aiGrammar = { degraded: true, data: null }
    const r = await explainTopic('u1', 'gt-1', { pointTitle: '用法' })
    expect(r.pointTitle).toBe('用法')
    expect(r.explanation).toContain('用法')
    expect(r.explanation).not.toContain('基本结构')
  })
})
