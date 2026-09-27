/**
 * Seed: placement questions (60) from prisma/data/placement-questions.csv → questions
 * Idempotent: upsert by (stem, category) natural key.
 */
import { Prisma, type QuestionType, type Difficulty, type ExamType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { DATA_DIR, readCsv, log, warn } from './shared'

interface PlacementRow {
  type: string
  category: string
  difficulty: string
  examType: string
  stem: string
  options: string
  answer: string
  explanation: string
  knowledgePoints: string
  dimension: string
  material: string
}

const QUESTION_TYPES = new Set<string>([
  'SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'CLOZE', 'MATCHING',
  'SHORT_ANSWER', 'ESSAY', 'TRANSLATION', 'DICTATION', 'RETELL', 'SUMMARY',
])
const DIFFICULTIES = new Set<string>(['EASY', 'MEDIUM', 'HARD'])
const EXAM_TYPES = new Set<string>(['PLACEMENT', 'CET4', 'CET6'])

function parseJsonSafe(raw: string): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export async function seedQuestions(): Promise<number> {
  const rows = readCsv(`${DATA_DIR}/placement-questions.csv`) as unknown as PlacementRow[]
  if (rows.length === 0) {
    warn('placement-questions.csv is empty — skip question seed')
    return 0
  }

  let count = 0
  for (const row of rows) {
    if (!row.stem || !row.answer) continue
    const type = QUESTION_TYPES.has(row.type) ? (row.type as QuestionType) : 'SINGLE_CHOICE'
    const difficulty = DIFFICULTIES.has(row.difficulty) ? (row.difficulty as Difficulty) : 'MEDIUM'
    const examType = EXAM_TYPES.has(row.examType) ? (row.examType as ExamType) : 'PLACEMENT'
    const options = parseJsonSafe(row.options) ?? undefined
    const knowledgePoints = parseJsonSafe(row.knowledgePoints) ?? undefined
    const dimension = row.dimension || 'general'

    const existing = await prisma.question.findFirst({
      where: { stem: row.stem, category: row.category },
      select: { id: true },
    })
    const data = {
      type,
      category: row.category || 'placement',
      difficulty,
      examType,
      stem: row.stem,
      options: (options ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      answer: row.answer,
      explanation: row.explanation || null,
      knowledgePoints: (knowledgePoints ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      material: undefined,
      discrimination: 0.5 + Math.random() * 0.4, // 0.5-0.9
      irtDifficulty: difficulty === 'EASY' ? -1 : difficulty === 'HARD' ? 1 : 0,
      tags: [dimension] as Prisma.InputJsonValue,
      source: 'seed',
      status: 'PUBLISHED' as const,
    }
    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data })
    } else {
      await prisma.question.create({ data })
    }
    count += 1
  }
  log(`questions: ${count} placement questions seeded`)
  return count
}

// Allow standalone execution
if (process.argv[1] && process.argv[1].includes('seed-questions')) {
  seedQuestions()
    .catch((e) => {
      warn(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
