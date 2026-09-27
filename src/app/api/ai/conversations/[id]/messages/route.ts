/**
 * GET    /api/ai/conversations/[id]/messages — 消息分页（按时间正序返回）。
 * DELETE /api/ai/conversations/[id]/messages?messageId=xx — 删除单条消息（软删由 favorite 替代，Phase 1 物理）。
 */
import { withAuth, ok } from '@/lib/api/handler'
import { buildMeta } from '@/lib/api/pagination'
import { errNotFound } from '@/lib/api/errors'
import { prisma } from '@/lib/db'

async function assertOwned(id: string, userId: string): Promise<void> {
  const conv = await prisma.aiConversation.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  })
  if (!conv) throw errNotFound('会话不存在')
}

export const GET = withAuth<{ id: string }, unknown>(
  async (ctx) => {
    await assertOwned(ctx.params.id!, ctx.auth!.userId)
    const where = { conversationId: ctx.params.id! }
    const [total, rows] = await Promise.all([
      prisma.aiMessage.count({ where }),
      prisma.aiMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: ctx.page.skip,
        take: ctx.page.take,
      }),
    ])
    return ok({ items: rows }, { meta: buildMeta(ctx.page, total), traceId: ctx.traceId })
  },
)

type DeleteInput = { messageId: string }

export const DELETE = withAuth<{ id: string }, unknown>(
  async (ctx) => {
    await assertOwned(ctx.params.id!, ctx.auth!.userId)
    const input = ctx.data as DeleteInput
    await prisma.aiMessage.deleteMany({
      where: { id: input.messageId, conversationId: ctx.params.id! },
    })
    return ok(null, { traceId: ctx.traceId })
  },
)
