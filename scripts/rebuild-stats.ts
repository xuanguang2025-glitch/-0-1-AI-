/**
 * `npm run stats:rebuild` —— 从 LearningRecord / VocabularyReview 重算
 * daily_learning_stats（T10 运维工具）：用于手工补数或修正脏数据。
 *
 * 策略：全量重算最近 N 天（默认 90）。每天：
 *   wordsLearned  = LearningRecord(activityType=vocab_learn) 当日 value 合计
 *   wordsReviewed = VocabularyReview 当日条数
 *   correctCount  = VocabularyReview 当日 isCorrect
 *   wrongCount    = VocabularyReview 当日 !isCorrect
 *   xpEarned      = LearningRecord 当日 xpEarned 合计
 *   studySeconds  = LearningRecord 当日 durationSec 合计
 */
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const prisma = new PrismaClient()

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

interface DayAgg {
  learned: number
  reviewed: number
  correct: number
  wrong: number
  xp: number
  seconds: number
}

async function main(): Promise<void> {
  const days = Number(process.argv[2] ?? 90)
  const end = today()
  const start = addDays(end, -days)
  console.log(`[stats:rebuild] rebuilding ${start} .. ${end} (${days}d)`)

  const since = new Date(`${start}T00:00:00Z`)
  const users = await prisma.user.findMany({ select: { id: true } })
  let rows = 0

  for (const { id: userId } of users) {
    const [records, reviews] = await Promise.all([
      prisma.learningRecord.findMany({
        where: { userId, occurredAt: { gte: since } },
        select: { occurredAt: true, activityType: true, durationSec: true, value: true, xpEarned: true },
      }),
      prisma.vocabularyReview.findMany({
        where: { userId, occurredAt: { gte: since } },
        select: { occurredAt: true, isCorrect: true },
      }),
    ])

    const byDay = new Map<string, DayAgg>()
    const touch = (date: string): DayAgg => {
      let row = byDay.get(date)
      if (!row) {
        row = { learned: 0, reviewed: 0, correct: 0, wrong: 0, xp: 0, seconds: 0 }
        byDay.set(date, row)
      }
      return row
    }

    for (const r of records) {
      const row = touch(r.occurredAt.toISOString().slice(0, 10))
      row.seconds += r.durationSec
      row.xp += r.xpEarned
      if (r.activityType === 'vocab_learn') row.learned += r.value
    }
    for (const r of reviews) {
      const row = touch(r.occurredAt.toISOString().slice(0, 10))
      row.reviewed += 1
      if (r.isCorrect) row.correct += 1
      else row.wrong += 1
    }

    for (const [date, agg] of byDay) {
      await prisma.dailyLearningStat.upsert({
        where: { userId_date: { userId, date } },
        update: {
          studySeconds: agg.seconds,
          wordsLearned: agg.learned,
          wordsReviewed: agg.reviewed,
          correctCount: agg.correct,
          wrongCount: agg.wrong,
          xpEarned: agg.xp,
        },
        create: {
          userId,
          date,
          studySeconds: agg.seconds,
          wordsLearned: agg.learned,
          wordsReviewed: agg.reviewed,
          correctCount: agg.correct,
          wrongCount: agg.wrong,
          xpEarned: agg.xp,
        },
      })
      rows += 1
    }
  }

  console.log(`[stats:rebuild] done: ${rows} stat row(s) upserted`)
}

main()
  .catch((err) => {
    console.error('[stats:rebuild] failed:', err)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
