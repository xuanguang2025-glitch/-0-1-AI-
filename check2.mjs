import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const t = await p.placementTest.findUnique({ where: { id: 'cmujmutr3000c1bxwhuzd90g7' } })
console.log('status:', t?.status, '| overall:', t?.overallScore, '| cefr:', t?.cefrLevel, '| submittedAt:', t?.submittedAt?.toISOString() ?? null)
const ac = await p.placementAnswer.count({ where: { testId: 'cmujmutr3000c1bxwhuzd90g7' } }).catch(() => 'n/a')
console.log('answers:', ac)
console.log('ai_call_logs:', await p.aiCallLog.count())
await p.$disconnect()
