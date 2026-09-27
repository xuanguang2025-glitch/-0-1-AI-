/**
 * Seed · 词库：CET-4 3000 / CET-6 2000（幂等，`createMany + skipDuplicates` 按 lemma 唯一键）。
 *
 * 数据源优先级：
 *  1. `prisma/data/cet4-words.csv` + `cet6-words.csv`（由 `npm run db:fetch:vocab` + `db:build:vocab`
 *     从 ECDICT 生成）
 *  2. 若不存在 → 回退到内置 `fallback-words.csv`（200 词，手写真实音标/释义），并打警告。
 */
import path from 'path'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

import { chunk, DATA_DIR, log, readCsv, splitTranslation, warn } from './shared'

interface VocabRow {
  word: string
  lemma: string
  phoneticUs: string
  phoneticUk: string
  pos: string[]
  definitions: Array<{ pos: string; zh: string; en: string }>
  exchange: Record<string, string>
  tags: string[]
  frequencyRank: number | null
  cefrLevel: 'B1' | 'B2'
  difficulty: 'MEDIUM' | 'HARD'
  source: string
}

interface LevelResult {
  level: 'cet4' | 'cet6'
  rows: VocabRow[]
  source: 'ecdict' | 'fallback'
}

const BOOKS: Record<'cet4' | 'cet6', { slug: string; name: string }> = {
  cet4: { slug: 'cet4-core', name: 'CET-4 核心词汇' },
  cet6: { slug: 'cet6-core', name: 'CET-6 核心词汇' },
}

function parseGeneratedCsv(file: string, level: 'cet4' | 'cet6'): VocabRow[] {
  const raw = readCsv(file)
  return raw.map((row) => {
    const safeParse = <T,>(value: string | undefined, fallback: T): T => {
      if (!value) return fallback
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }
    const rank = Number.parseInt(row.frequencyRank ?? '', 10)
    return {
      word: row.word ?? '',
      lemma: (row.lemma ?? row.word ?? '').toLowerCase(),
      phoneticUs: row.phoneticUs ?? '',
      phoneticUk: row.phoneticUk ?? '',
      pos: safeParse<string[]>(row.pos, []),
      definitions: safeParse<Array<{ pos: string; zh: string; en: string }>>(row.definitions, []),
      exchange: safeParse<Record<string, string>>(row.exchange, {}),
      tags: safeParse<string[]>(row.tags, [level]),
      frequencyRank: Number.isNaN(rank) ? null : rank,
      cefrLevel: (level === 'cet4' ? 'B1' : 'B2') as VocabRow['cefrLevel'],
      difficulty: (level === 'cet4' ? 'MEDIUM' : 'HARD') as VocabRow['difficulty'],
      source: row.source ?? 'ecdict',
    }
  }).filter((row) => row.word.length > 0)
}

/** fallback 词表：word,phonetic,translation,tags（手写 200 词）。 */
function parseFallbackCsv(file: string): VocabRow[] {
  const raw = readCsv(file)
  return raw.map((row) => {
    const word = row.word ?? ''
    const definitions = splitTranslation(row.translation ?? '').map((item) => ({
      pos: item.pos,
      zh: item.zh,
      en: '',
    }))
    return {
      word,
      lemma: word.toLowerCase(),
      phoneticUs: row.phonetic ?? '',
      phoneticUk: '',
      pos: definitions.map((d) => d.pos).filter(Boolean),
      definitions,
      exchange: {},
      tags: (row.tags ?? 'cet4').split(/\s+/).filter(Boolean),
      frequencyRank: null,
      cefrLevel: row.tags === 'cet6' ? 'B2' as const : 'B1' as const,
      difficulty: row.tags === 'cet6' ? 'HARD' as const : 'MEDIUM' as const,
      source: 'fallback',
    }
  }).filter((row) => row.word.length > 0)
}

export async function seedVocabulary(): Promise<{ cet4: number; cet6: number; source: string }> {
  const cet4File = path.join(DATA_DIR, 'cet4-words.csv')
  const cet6File = path.join(DATA_DIR, 'cet6-words.csv')
  const fallbackFile = path.join(DATA_DIR, 'fallback-words.csv')

  const hasGenerated = readCsv(cet4File).length > 0 && readCsv(cet6File).length > 0
  const levels: LevelResult[] = hasGenerated
    ? [
        { level: 'cet4', rows: parseGeneratedCsv(cet4File, 'cet4'), source: 'ecdict' },
        { level: 'cet6', rows: parseGeneratedCsv(cet6File, 'cet6'), source: 'ecdict' },
      ]
    : (() => {
        warn('未找到 cet4-words.csv / cet6-words.csv —— 使用 fallback 词表（200 词）。')
        warn('当前为 fallback 词表，请运行 `npm run db:fetch:vocab` 补齐 5000 词。')
        const fallback = parseFallbackCsv(fallbackFile)
        return [
          { level: 'cet4' as const, rows: fallback.filter((r) => r.tags.includes('cet4')), source: 'fallback' as const },
          { level: 'cet6' as const, rows: fallback.filter((r) => r.tags.includes('cet6')), source: 'fallback' as const },
        ]
      })()

  const books: Array<{ slug: string; name: string; level: 'cet4' | 'cet6'; count: number }> = []
  let source = levels[0]?.source ?? 'fallback'

  for (const { level, rows } of levels) {
    if (rows.length === 0) continue
    const data = rows.map((row) => ({
      word: row.word,
      lemma: row.lemma,
      phoneticUk: row.phoneticUk || null,
      phoneticUs: row.phoneticUs || null,
      pos: row.pos.length > 0 ? row.pos : Prisma.JsonNull,
      definitions: row.definitions.length > 0 ? row.definitions : [{ pos: '', zh: row.word, en: '' }],
      examples: Prisma.JsonNull,
      synonyms: Prisma.JsonNull,
      antonyms: Prisma.JsonNull,
      collocations: Prisma.JsonNull,
      derivatives: Object.keys(row.exchange).length > 0 ? row.exchange : Prisma.JsonNull,
      rootAffix: null,
      mnemonic: null,
      cefrLevel: row.cefrLevel,
      difficulty: row.difficulty,
      frequencyRank: row.frequencyRank,
      tags: row.tags,
      source: row.source,
      status: 'PUBLISHED' as const,
    }))

    for (const batch of chunk(data, 500)) {
      await prisma.vocabulary.createMany({ data: batch, skipDuplicates: true })
    }

    // 关联词书（幂等：unique(bookId, vocabularyId) + skipDuplicates）
    const { slug, name } = BOOKS[level]
    
    const book = await prisma.vocabularyBook.upsert({
      where: { slug },
      update: { name, examType: level === 'cet4' ? 'CET4' : 'CET6', status: 'PUBLISHED' },
      create: {
        slug,
        name,
        examType: level === 'cet4' ? 'CET4' : 'CET6',
        cefrLevel: level === 'cet4' ? 'B1' : 'B2',
        description:
          level === 'cet4'
            ? '大学英语四级核心词汇，按词频分级，含音标与结构化释义。'
            : '大学英语六级核心词汇（不含四级重叠词），按词频分级。',
        status: 'PUBLISHED',
        sortOrder: level === 'cet4' ? 1 : 2,
      },
    })

    const lemmas = rows.map((row) => row.lemma)
    const vocabRows = await prisma.vocabulary.findMany({
      where: { lemma: { in: lemmas } },
      select: { id: true, lemma: true },
    })
    const idByLemma = new Map(vocabRows.map((row) => [row.lemma, row.id]))
    const orderIndexByLemma = new Map(rows.map((row, index) => [row.lemma, index]))
    const items = vocabRows
      .map((row) => ({
        bookId: book.id,
        vocabularyId: idByLemma.get(row.lemma) ?? '',
        orderIndex: orderIndexByLemma.get(row.lemma) ?? 0,
      }))
      .filter((item) => item.vocabularyId !== '')
    for (const batch of chunk(items, 500)) {
      await prisma.vocabularyBookItem.createMany({ data: batch, skipDuplicates: true })
    }
    await prisma.vocabularyBook.update({ where: { id: book.id }, data: { wordCount: items.length } })

    books.push({ slug, name, level, count: items.length })
    log(`${level}: ${items.length} words (source=${source}, book=${slug})`)
  }

  if (books.length === 0) warn('词库 seed 未写入任何数据')
  return {
    cet4: books.find((b) => b.level === 'cet4')?.count ?? 0,
    cet6: books.find((b) => b.level === 'cet6')?.count ?? 0,
    source,
  }
}

