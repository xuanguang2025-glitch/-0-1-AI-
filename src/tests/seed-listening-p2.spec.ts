/**
 * seed-listening-p2.spec.ts — LISTENING_P2 落库接线回归（QA 第五轮 P1）。
 *
 * QA 第五轮报「`LISTENING_P2` 导入量为 0——60 篇新材料不入库、
 * `ListeningAudioAsset` 无行」。根因是当时 `seed-listening-p2.ts` 还是未提交 WIP，
 * `index.ts` 里既没 import 也没调用。
 *
 * 本 spec 用三层断言把这件事钉死，避免再次「只写文件不接线」：
 *   ① 编排层：`SEED_STEPS` 里必须有 `listening-p2`、顺序在 `content` 之后、且是函数；
 *   ② 数据层：`LISTENING_P2` 60 篇、id 唯一、强度分布 20/15/14/11；
 *   ③ 写库层：mock 掉 `@/lib/db` 后实跑 `seedListeningP2()`，
 *      断言 60 次材料 upsert + 每篇题目 upsert + **只为磁盘上真实存在的 mp3**
 *      登记音频资产（不造假死链、也不静默跳过已有文件）。
 *
 * 真实落库计数见 `npm run db:seed` 日志（PG 可用时）：
 *   `[seed] listening-p2: 60 materials (+N audio assets)` / `listening=60`。
 */
import fs from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  materialUpserts: [] as Array<{ where: unknown; create: unknown; update: unknown }>,
  questionUpserts: [] as Array<{ where: unknown; create: unknown; update: unknown }>,
  questionDeletes: [] as Array<{ where: unknown }>,
  assetUpserts: [] as Array<{ where: unknown; create: unknown; update: unknown }>,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    listeningMaterial: {
      upsert: vi.fn(async (a: { where: unknown; create: unknown; update: unknown }) => {
        h.materialUpserts.push(a)
        return {}
      }),
    },
    listeningQuestion: {
      upsert: vi.fn(async (a: { where: unknown; create: unknown; update: unknown }) => {
        h.questionUpserts.push(a)
        return {}
      }),
      deleteMany: vi.fn(async (a: { where: unknown }) => {
        h.questionDeletes.push(a)
        return { count: 0 }
      }),
    },
    listeningAudioAsset: {
      upsert: vi.fn(async (a: { where: unknown; create: unknown; update: unknown }) => {
        h.assetUpserts.push(a)
        return {}
      }),
    },
  },
}))

import { RATES, rateTag, slugify } from '../../scripts/gen-listening-audio'
import { LISTENING_P2 } from '../../prisma/seed/data/listening-p2'
import { seedListeningP2 } from '../../prisma/seed/seed-listening-p2'
import { SEED_STEPS, seedStepNames } from '../../prisma/seed/steps'

const AUDIO_DIR = path.resolve(process.cwd(), 'public', 'audio', 'listening')

/** 磁盘上真实存在、且 seed 会去登记的 mp3 数量（独立复算，避免用被测逻辑反推期望） */
function expectedAssetCount(): number {
  let n = 0
  for (const m of LISTENING_P2) {
    const slug = slugify(m.title)
    for (const rate of RATES) {
      if (fs.existsSync(path.join(AUDIO_DIR, `${slug}_${rateTag(rate)}.mp3`))) n += 1
    }
  }
  return n
}

describe('seed 编排接线（QA 第五轮 P1：LISTENING_P2 导入量为 0）', () => {
  it('SEED_STEPS 含 listening-p2，顺序在 content 之后、questions 之前', () => {
    const names = seedStepNames()
    expect(names).toContain('listening-p2')
    expect(names.indexOf('content')).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('content')).toBeLessThan(names.indexOf('listening-p2'))
    expect(names.indexOf('listening-p2')).toBeLessThan(names.indexOf('questions'))
  })

  it('每一步都是可执行函数（防止「只 import 定义不调用」）', () => {
    expect(SEED_STEPS.length).toBeGreaterThanOrEqual(8)
    for (const step of SEED_STEPS) {
      expect(typeof step.run, `step ${step.name} 的 run 必须是函数`).toBe('function')
      expect(step.name.length).toBeGreaterThan(0)
    }
  })
})

describe('LISTENING_P2 数据完整性', () => {
  it('60 篇、id 唯一、强度分布 20/15/14/11（非均匀 15×4）', () => {
    expect(LISTENING_P2).toHaveLength(60)
    expect(new Set(LISTENING_P2.map((m) => m.id)).size).toBe(60)
    const dist = new Map<number, number>()
    for (const m of LISTENING_P2) dist.set(m.intensityLevel, (dist.get(m.intensityLevel) ?? 0) + 1)
    expect(dist.get(1)).toBe(20)
    expect(dist.get(2)).toBe(15)
    expect(dist.get(3)).toBe(14)
    expect(dist.get(4)).toBe(11)
  })

  it('每篇都有字幕行、至少 1 道题、考点结构合法', () => {
    for (const m of LISTENING_P2) {
      expect(m.lines.length, `${m.id} 字幕行`).toBeGreaterThan(0)
      expect(m.questions.length, `${m.id} 题目`).toBeGreaterThanOrEqual(1)
      expect(m.title.length, `${m.id} 标题`).toBeGreaterThan(0)
      for (const fp of m.focusPoints) {
        expect(['new', 'key', 'phrase', 'grammar']).toContain(fp.type)
      }
    }
  })
})

describe('seedListeningP2 写库行为', () => {
  beforeEach(() => {
    h.materialUpserts.length = 0
    h.questionUpserts.length = 0
    h.questionDeletes.length = 0
    h.assetUpserts.length = 0
  })

  it('写 60 篇材料 + 每篇题目，并清理历史题目', async () => {
    const count = await seedListeningP2()
    expect(count).toBe(60)
    expect(h.materialUpserts).toHaveLength(60)
    // 每篇都删掉「不属于本次」的历史题（幂等覆盖的前提）
    expect(h.questionDeletes).toHaveLength(60)
    expect(h.questionUpserts.length).toBe(
      LISTENING_P2.reduce((n, m) => n + m.questions.length, 0),
    )
    // 材料 id 与数据文件一一对应（不是空转）
    const ids = h.materialUpserts.map((u) => (u.create as { id: string }).id)
    expect(new Set(ids)).toEqual(new Set(LISTENING_P2.map((m) => m.id)))
  })

  it('音频资产只为磁盘上真实存在的 mp3 登记（不造假死链，也不静默跳过）', async () => {
    const expected = expectedAssetCount()
    await seedListeningP2()
    expect(h.assetUpserts).toHaveLength(expected)
    if (expected > 0) {
      // 有音频就必须登记，且带真实时长与 isTts 标记
      const first = h.assetUpserts[0]?.create as { durationSec: number; isTts: boolean; url: string }
      expect(first.durationSec).toBeGreaterThan(0)
      expect(first.isTts).toBe(true)
      expect(first.url).toMatch(/^\/audio\/listening\/.+_\d{3}\.mp3$/)
    }
  })

  it('幂等：重复执行写库次数一致（upsert 而非 create）', async () => {
    await seedListeningP2()
    const first = { m: h.materialUpserts.length, q: h.questionUpserts.length, a: h.assetUpserts.length }
    h.materialUpserts.length = 0
    h.questionUpserts.length = 0
    h.assetUpserts.length = 0
    await seedListeningP2()
    expect(h.materialUpserts.length).toBe(first.m)
    expect(h.questionUpserts.length).toBe(first.q)
    expect(h.assetUpserts.length).toBe(first.a)
  })
})
