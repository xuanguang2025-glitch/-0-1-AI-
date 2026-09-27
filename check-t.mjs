import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const t = await p.placementTest.findUnique({ where: { id: 'cmujmutr3000c1bxwhuzd90g7' }, include: { _count: { select: { answers: true } } } })
console.log('status:', t?.status, '| answers:', t?._count.answers, '| overall:', t?.overallScore, '| cefr:', t?.cefrLevel, '| submittedAt:', t?.submittedAt?.toISOString())
const logs = await p.aiCallLog.count()
console.log('ai_call_logs total:', logs)
await p.$disconnect()
