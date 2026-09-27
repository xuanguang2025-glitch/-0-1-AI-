/**
 * GET  /api/ai/conversations — 会话列表（分页）。
 * POST /api/ai/conversations — 新建会话。
 */
import { z } from 'zod'
import { withAuth, ok, created } from '@/lib/api/handler'
import { buildMeta } from '@/lib/api/pagination'
import { prisma } from '@/lib/db'

const createSchema = z.object({
  type: z.enum(['TUTOR', 'SPEAKING_PARTNER', 'WORD_EXPLAINER', 'GRAMMAR_EXPLAINER', 'READING_EXPLAINER']).default('TUTOR'),
  title: z.string().trim().max(50).optional(),
})

export const GET = withAuth(
  async (ctx) => {
    const [total, rows] = await Promise.all([
      prisma.aiConversation.count({ where: { userId: ctx.auth!.userId, deletedAt: null } }),
      prisma.aiConversation.findMany({
        where: { userId: ctx.auth!.userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        skip: ctx.page.skip,
        take: ctx.page.take,
        select: {
          id: true, type: true, title: true, messageCount: true,
          tokensUsed: true, lastMessageAt: true, updatedAt: true,
        },
      }),
    ])
    return ok({ items: rows }, { meta: buildMeta(ctx.page, total), traceId: ctx.traceId })
  },
)

export const POST = withAuth(
  async (ctx) => {
    const conv = await prisma.aiConversation.create({
      data: { userId: ctx.auth!.userId, type: ctx.data.type, title: ctx.data.title },
      select: { id: true, type: true, title: true, createdAt: true },
    })
    return created(conv, { traceId: ctx.traceId })
  },
  { bodySchema: createSchema },
)
