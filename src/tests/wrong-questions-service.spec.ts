/**
 * wrong-questions-service.spec.ts — 错题本服务单测（错题本闭环）。
 *
 * 覆盖：列表筛选（来源/掌握状态/分页）、sourceCounts 聚合、
 * 复习闭环（标记已掌握幂等保留首次时间 / 重新打开）、404。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  updated: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
  count: 0,
}))

vi.mock('@/lib/db', () => {
  /** 简版 where 过滤（真实 Prisma 在 DB 侧做；mock 在内存做同样语义） */
  function applyWhere(where: Record<string, unknown>): Array<Record<string, unknown>> {
    return h.rows.filter((r) => {
      if (where.userId !== undefined && r.userId !== where.userId) return false
      if (where.source !== undefined && r.source !== where.source) return false
      const m = where.masteredAt as { not?: unknown } | null | undefined
      if (m !== undefined) {
        if (m !== null && typeof m === 'object' && 'not' in m) {
          // { not: null } ≙ masterdAt 非空；与行状态不一致则剔除
          if ((r.masteredAt === null) === (m.not === null)) return false
        } else if ((m === null) !== (r.masteredAt === null)) return false
      }
      return true
    })
  }

  const prisma = {
    wrongQuestion: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => applyWhere(a.where)),
      count: vi.fn(async (a: { where: Record<string, unknown> }) => applyWhere(a.where).length),
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>()
        for (const r of applyWhere({ userId: 'u1', masteredAt: null })) {
          const s = String(r.source)
          counts.set(s, (counts.get(s) ?? 0) + 1)
        }
        return [...counts.entries()].map(([source, c]) => ({ source, _count: { _all: c } }))
      }),
      findFirst: vi.fn(async (a: { where: { id: string; userId: string } }) =>
        h.rows.find((r) => r.id === a.where.id && r.userId === a.where.userId) ?? null,
      ),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        h.updated.push(a)
        const row = h.rows.find((r) => r.id === a.where.id)
        if (row !== undefined && 'masteredAt' in a.data) row.masteredAt = a.data.masteredAt
        return { masteredAt: row?.masteredAt ?? null }
      }),
    },
  }
  return { prisma }
})

import { listWrongQuestions, markMastered, reopenQuestion } from '@/services/wrong-questions.service'

function row(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'wq-1',
    source: 'reading',
    refType: 'reading_question',
    refId: 'rq-1',
    stem: 'Which is correct?',
    options: ['A', 'B'],
    userAnswer: 'A',
    correctAnswer: 'B',
    explanation: 'exp',
    aiExplanation: null,
    aiCategory: 'careless',
    errorCount: 2,
    lastWrongAt: new Date('2026-01-01T00:00:00Z'),
    masteredAt: null,
    isFavorite: false,
    userId: 'u1',
    ...over,
  }
}

describe('错题本列表', () => {
  beforeEach(() => {
    h.rows = [row(), row({ id: 'wq-2', source: 'grammar', masteredAt: new Date('2026-01-02T00:00:00Z') }), row({ id: 'wq-3', source: 'grammar', errorCount: 1 })]
    h.count = h.rows.length
    h.updated = []
  })

  it('返回全部 + sourceCounts 只统计未掌握', async () => {
    const r = await listWrongQuestions('u1', {})
    expect(r.items).toHaveLength(3)
    expect(r.total).toBe(3)
    const grammar = r.sourceCounts.find((s) => s.source === 'grammar')
    expect(grammar?.count).toBe(1) // wq-2 已掌握不计入
    expect(r.sourceCounts.find((s) => s.source === 'reading')?.count).toBe(1)
  })

  it('按来源筛选（非法来源被忽略，不 500）', async () => {
    const byGrammar = await listWrongQuestions('u1', { source: 'grammar' })
    expect(byGrammar.items.every((i) => i.source === 'grammar')).toBe(true)

    const byInvalid = await listWrongQuestions('u1', { source: 'hacker' })
    expect(byInvalid.items).toHaveLength(3)
  })

  it('按掌握状态筛选', async () => {
    const pending = await listWrongQuestions('u1', { mastered: false })
    expect(pending.items.map((i) => i.id)).toEqual(['wq-1', 'wq-3'])
    const done = await listWrongQuestions('u1', { mastered: true })
    expect(done.items.map((i) => i.id)).toEqual(['wq-2'])
  })

  it('DTO 字段映射（options 数组化、ISO 时间、aiCategory 透传）', async () => {
    const r = await listWrongQuestions('u1', {})
    expect(r.items[0]?.options).toEqual(['A', 'B'])
    expect(r.items[0]?.lastWrongAt).toBe('2026-01-01T00:00:00.000Z')
    expect(r.items[0]?.masteredAt).toBeNull()
    expect(r.items[1]?.masteredAt).toBe('2026-01-02T00:00:00.000Z')
    expect(r.items[0]?.aiCategory).toBe('careless')
  })
})

describe('错题复习闭环', () => {
  beforeEach(() => {
    h.rows = [row()]
    h.updated = []
  })

  it('标记已掌握 → masteredAt 落库', async () => {
    const r = await markMastered('u1', 'wq-1')
    expect(r.masteredAt).not.toBeNull()
    expect(h.updated[0]?.data.masteredAt).toBeInstanceOf(Date)
  })

  it('重复标记幂等：保留首次掌握时间', async () => {
    const first = await markMastered('u1', 'wq-1')
    const second = await markMastered('u1', 'wq-1')
    expect(second.masteredAt).toBe(first.masteredAt)
  })

  it('重新打开 → masteredAt=null', async () => {
    await markMastered('u1', 'wq-1')
    const r = await reopenQuestion('u1', 'wq-1')
    expect(r.masteredAt).toBeNull()
    expect(h.rows[0]?.masteredAt).toBeNull()
  })

  it('不存在 / 他人错题 → 404', async () => {
    await expect(markMastered('u1', 'ghost')).rejects.toThrow(/错题不存在/)
    // 属于 u2 的错题对 u1 不可见
    h.rows = [row({ userId: 'u2' })]
    await expect(markMastered('u1', 'wq-1')).rejects.toThrow(/错题不存在/)
  })
})
