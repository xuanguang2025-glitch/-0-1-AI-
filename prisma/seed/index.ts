/**
 * Seed orchestrator — run all seeds in dependency order.
 * Idempotent: safe to re-run; each sub-seed upserts by its natural key.
 *
 * Order: roles → admin → vocabulary → content → listening-p2 → questions → ai → achievements
 * (步骤清单见 ./steps.ts，新增 seed 必须登记到那里，否则不会被执行)
 */
import { PrismaClient } from '@prisma/client'

import { SEED_STEPS } from './steps'
import { log, warn } from './shared'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const startedAt = Date.now()
  log(`seed start — driver=${process.env.DB_DRIVER ?? 'postgres'}`)

  for (const step of SEED_STEPS) {
    await step.run()
  }

  // ---- summary counts ----
  const [
    users, roles, words, books, listening, reading, grammarTopics,
    grammarQuestions, writingTasks, questions, capabilityConfigs, prompts, achievements,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.roleModel.count(),
    prisma.vocabulary.count(),
    prisma.vocabularyBook.count(),
    prisma.listeningMaterial.count(),
    prisma.readingArticle.count(),
    prisma.grammarTopic.count(),
    prisma.grammarQuestion.count(),
    prisma.writingTask.count(),
    prisma.question.count(),
    prisma.aiCapabilityConfig.count(),
    prisma.aiPrompt.count(),
    prisma.achievement.count(),
  ])
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  log('==== seed summary ====')
  log(`users=${users} roles=${roles} words=${words} books=${books}`)
  log(`listening=${listening} reading=${reading} grammarTopics=${grammarTopics} grammarQuestions=${grammarQuestions} writing=${writingTasks}`)
  log(`placementQuestions=${questions} aiConfigs=${capabilityConfigs} aiPrompts=${prompts} achievements=${achievements}`)
  log(`seed done in ${seconds}s`)
}

main()
  .catch((e) => {
    warn(e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
